import type {
  Card,
  ConditionDefinition,
  EffectDefinition,
  GameSchemaDefinition,
  PhaseDefinition,
  PlayerPublicInfo,
  PublicGameState,
} from './types.js';
import { GameEngine, InternalPlayer } from './state-machine.js';
import { getBuiltinAction } from './capabilities/registry.js';
import { validateCardPlay } from './validator.js';
import {
  calculateEnvidoPoints,
  calculateFaltaEnvidoPoints,
  getCardHierarchyValue,
  resolveTrickWinner,
  resolveRoundWinner,
  TRUCO_CARD_HIERARCHY,
} from '@al-mazo/shared';
import { decideBotMove } from './bot.js';

export interface ActionResult {
  success: boolean;
  result?: unknown;
}

export interface TrickPlayEntry {
  playerId: string;
  card: Card;
  isTapada?: boolean;
}

export interface RoundTrickRecord {
  trickNumber: number;
  cards: TrickPlayEntry[];
  winnerId: string | 'EMPATE' | null;
}

export interface EnvidoState {
  state: 'AVAILABLE' | 'PENDING' | 'RESOLVED' | 'REJECTED' | 'DISABLED';
  currentCall: 'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO' | null;
  callerId: string | null;
  challengedId: string | null;
  callHistory: string[];
  pointsAtStake: number;
  pointsIfRefused: number;
  winnerId: string | null;
  pointsAwarded: number;
  playerTantos: Record<string, number>;
}

export interface TrucoBetState {
  state: 'AVAILABLE' | 'PENDING' | 'RESOLVED' | 'REJECTED';
  currentLevel: 'TRUCO' | 'RETRUCO' | 'VALE_CUATRO' | null;
  points: number;
  pointsIfRefused: number;
  callerId: string | null;
  challengedId: string | null;
  lastCallerId: string | null;
}

export interface TrucoCustomState {
  round: number;
  manoPlayerId: string;
  targetScore: number;
  currentTrick: number;
  roundTricks: RoundTrickRecord[];
  trickWins: Record<string, number>;
  envido: EnvidoState;
  truco: TrucoBetState;
  pendingBet: {
    type: 'ENVIDO' | 'TRUCO';
    call: string;
    callerId: string;
    challengedId: string;
    pointsAtStake: number;
    pointsIfRefused: number;
  } | null;
  lastActionText: string;
  [key: string]: unknown;
}

export class ModularGameEngine extends GameEngine {
  protected currentPhase: string | null = null;
  protected customState: Record<string, unknown> = {};
  protected scores: Record<string, number> = {};
  protected trickCards: TrickPlayEntry[] = [];
  protected activeBets: Record<string, unknown> = {};

  // Trick and round-based match state
  protected manoIndex = 0;
  protected round = 1;
  protected targetScore = 30;
  protected currentTrick = 1;
  protected roundTricks: RoundTrickRecord[] = [];
  protected trickLeaderId: string | null = null;
  protected lastActionText = '';
  protected preBetTurnIndex = 0;

  protected envidoState: EnvidoState = {
    state: 'AVAILABLE',
    currentCall: null,
    callerId: null,
    challengedId: null,
    callHistory: [],
    pointsAtStake: 0,
    pointsIfRefused: 0,
    winnerId: null,
    pointsAwarded: 0,
    playerTantos: {},
  };

  protected trucoState: TrucoBetState = {
    state: 'AVAILABLE',
    currentLevel: null,
    points: 1,
    pointsIfRefused: 0,
    callerId: null,
    challengedId: null,
    lastCallerId: null,
  };

  constructor(definition: GameSchemaDefinition) {
    super(definition);
    this.targetScore =
      definition.rules.targetScore ??
      (definition.rules.winCondition.type === 'SCORE_THRESHOLD'
        ? definition.rules.winCondition.targetScore ?? 30
        : 30);
  }

  private get phases(): PhaseDefinition[] | undefined {
    return this.definition.rules.phases;
  }

  public get isRoundTrickGame(): boolean {
    const rules = this.definition.rules;
    const hasTrickActions = rules.phases?.some((p) =>
      p.allowedActions.some((a) =>
        ['CALL_ENVIDO', 'CALL_TRUCO', 'QUIERO', 'NO_QUIERO'].includes(a)
      )
    );
    const hasOnlyTrickZone =
      rules.zones?.some((z) => z.type === 'TRICK_TABLE') &&
      !rules.zones?.some((z) => z.type === 'DISCARD_PILE');
    const isTrucoLike =
      Boolean(rules.cardHierarchy) && (rules.matchingProperties?.length ?? 0) === 0;

    return Boolean(
      hasTrickActions ||
      hasOnlyTrickZone ||
      isTrucoLike ||
      this.definition.slug === 'truco'
    );
  }

  public override start(): void {
    if (this.isRoundTrickGame) {
      if (this.players.length < (this.definition.rules.minPlayers ?? 2)) {
        throw new Error(
          `At least ${this.definition.rules.minPlayers ?? 2} players required to start`
        );
      }
      this.status = 'IN_PROGRESS';
      this.scores = {};
      for (const p of this.players) {
        this.scores[p.id] = 0;
      }
      this.manoIndex = 0;
      this.round = 1;
      this.startNewRound();
    } else {
      super.start();

      this.scores = {};
      for (const player of this.players) {
        this.scores[player.id] = 0;
      }
      this.customState = { ...(this.definition.rules.customState ?? {}) };
      this.trickCards = [];
      this.activeBets = {};

      const phases = this.phases;
      if (phases && phases.length > 0) {
        this.enterPhase(phases[0].id);
      }
    }
  }

  public startNewRound(): void {
    this.deckManager.generateFromConfig(this.definition.deckConfig);
    this.deckManager.shuffle();

    const handSize = this.definition.rules.initialHandSize ?? 3;
    for (const p of this.players) {
      p.hand = this.deckManager.drawMultiple(handSize);
    }

    this.currentTrick = 1;
    this.trickCards = [];
    this.roundTricks = [];
    this.currentTurnIndex = this.manoIndex;
    const manoPlayer = this.players[this.manoIndex];
    this.trickLeaderId = manoPlayer?.id ?? null;
    this.preBetTurnIndex = this.manoIndex;
    this.currentPhase = this.phases?.[0]?.id ?? 'ENVIDO_PHASE';

    this.envidoState = {
      state: 'AVAILABLE',
      currentCall: null,
      callerId: null,
      challengedId: null,
      callHistory: [],
      pointsAtStake: 0,
      pointsIfRefused: 0,
      winnerId: null,
      pointsAwarded: 0,
      playerTantos: {},
    };

    this.trucoState = {
      state: 'AVAILABLE',
      currentLevel: null,
      points: 1,
      pointsIfRefused: 0,
      callerId: null,
      challengedId: null,
      lastCallerId: null,
    };

    this.lastActionText = `Ronda ${this.round}. Mano: ${manoPlayer?.name ?? 'Jugador'}`;
  }

  public getStatus(): 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' {
    return this.status;
  }

  public getWinnerId(): string | null {
    return this.winnerId;
  }

  public override getPublicState(): PublicGameState {
    if (!this.isRoundTrickGame) {
      return {
        ...super.getPublicState(),
        currentPhase: this.currentPhase,
        scores: { ...this.scores },
        customState: { ...this.customState },
        trickCards: this.trickCards.map((entry) => ({
          playerId: entry.playerId,
          card: entry.isTapada
            ? { id: entry.card.id, type: 'TAPADA', value: 'TAPADA', color: 'TAPADA' }
            : { ...entry.card },
        })),
        activeBets: { ...this.activeBets },
      };
    }

    const playersPublic: PlayerPublicInfo[] = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isConnected: p.isConnected,
      seatIndex: index,
      isBot: p.isBot,
    }));

    const trickWins: Record<string, number> = { EMPATE: 0 };
    for (const p of this.players) {
      trickWins[p.id] = 0;
    }
    for (const t of this.roundTricks) {
      if (t.winnerId) {
        trickWins[t.winnerId] = (trickWins[t.winnerId] ?? 0) + 1;
      }
    }

    let pendingBet = null;
    if (this.envidoState.state === 'PENDING') {
      pendingBet = {
        type: 'ENVIDO' as const,
        call: this.envidoState.currentCall ?? 'ENVIDO',
        callerId: this.envidoState.callerId!,
        challengedId: this.envidoState.challengedId!,
        pointsAtStake: this.envidoState.pointsAtStake,
        pointsIfRefused: this.envidoState.pointsIfRefused,
      };
    } else if (this.trucoState.state === 'PENDING') {
      pendingBet = {
        type: 'TRUCO' as const,
        call: this.trucoState.currentLevel ?? 'TRUCO',
        callerId: this.trucoState.callerId!,
        challengedId: this.trucoState.challengedId!,
        pointsAtStake: this.trucoState.points,
        pointsIfRefused: this.trucoState.pointsIfRefused,
      };
    }

    const customState: TrucoCustomState = {
      round: this.round,
      manoPlayerId: this.players[this.manoIndex]?.id ?? '',
      targetScore: this.targetScore,
      currentTrick: this.currentTrick,
      roundTricks: this.roundTricks,
      trickWins,
      envido: { ...this.envidoState },
      truco: { ...this.trucoState },
      pendingBet,
      lastActionText: this.lastActionText,
      ...this.customState,
    };

    return {
      status: this.status,
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id ?? null,
      turnDirection: this.turnDirection,
      topDiscardCard: null,
      activeColor: null,
      drawPileCount: this.deckManager.count,
      discardPileCount: 0,
      players: playersPublic,
      winnerId: this.winnerId,
      pendingChoice: null,
      currentPhase: this.currentPhase,
      trickCards: this.trickCards.map((tc) => ({
        playerId: tc.playerId,
        card: tc.isTapada
          ? { id: tc.card.id, type: 'TAPADA', value: 'TAPADA', color: 'TAPADA' }
          : tc.card,
      })),
      scores: { ...this.scores },
      customState: customState as unknown as Record<string, unknown>,
      activeBets: {
        envido: this.envidoState,
        truco: this.trucoState,
        ...this.activeBets,
      },
    };
  }

  public executeAction(
    playerId: string,
    actionType: string,
    payload: Record<string, unknown> = {}
  ): ActionResult {
    try {
      const action = getBuiltinAction(actionType);
      if (!action) {
        return { success: false, result: `Unknown action: ${actionType}` };
      }

      const player = this.players.find((p) => p.id === playerId);
      if (!player) {
        return { success: false, result: `Player ${playerId} not found` };
      }

      const phaseError = this.checkPhaseAllows(actionType);
      if (phaseError) {
        return { success: false, result: phaseError };
      }

      for (const condition of action.requiredConditions ?? []) {
        if (!this.evaluateCondition(condition, playerId, payload)) {
          return { success: false, result: `Condition failed: ${condition.type}` };
        }
      }

      const result = this.dispatchAction(playerId, actionType, payload);
      this.applyEffects(action.effects, playerId, payload);
      return { success: true, result };
    } catch (error) {
      return { success: false, result: error instanceof Error ? error.message : String(error) };
    }
  }

  public override playCard(
    playerId: string,
    cardId: string,
    chosenColor?: string,
    isTapada = false
  ): void {
    if (!this.isRoundTrickGame) {
      super.playCard(playerId, cardId, chosenColor);
      return;
    }

    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }

    if (this.envidoState.state === 'PENDING' || this.trucoState.state === 'PENDING') {
      throw new Error('Hay una apuesta pendiente que debe ser respondida primero');
    }

    const currentPlayer = this.players[this.currentTurnIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error('Card not found in hand');
    }

    const [card] = currentPlayer.hand.splice(cardIndex, 1);

    if (this.currentTrick === 1 && this.envidoState.state === 'AVAILABLE') {
      if (this.trickCards.length === 1) {
        this.envidoState.state = 'DISABLED';
      }
    }

    this.trickCards.push({ playerId, card, isTapada });
    this.lastActionText = isTapada
      ? `${currentPlayer.name} jugó una carta tapada`
      : `${currentPlayer.name} jugó ${card.value} de ${card.color}`;

    if (this.trickCards.length < this.players.length) {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    } else {
      this.resolveRoundTrick();
    }
  }

  protected resolveRoundTrick(): void {
    const trickNum = this.currentTrick;
    const cards = [...this.trickCards];
    const hierarchy = this.definition.rules.cardHierarchy ?? TRUCO_CARD_HIERARCHY;

    const { winnerId: winningPlayerId } = resolveTrickWinner(cards, hierarchy);

    const record: RoundTrickRecord = {
      trickNumber: trickNum,
      cards,
      winnerId: winningPlayerId,
    };
    this.roundTricks.push(record);
    this.trickCards = [];

    const winnerName =
      winningPlayerId === 'EMPATE'
        ? 'Parda (Empate)'
        : this.players.find((p) => p.id === winningPlayerId)?.name ?? '';
    this.lastActionText = `Baza ${trickNum}: ${winnerName}`;

    const manoPlayerId = this.players[this.manoIndex]?.id ?? '';
    const roundWinnerId = resolveRoundWinner(
      this.roundTricks,
      manoPlayerId,
      this.players.map((p) => p.id)
    );

    if (roundWinnerId) {
      this.finishTrickRound(roundWinnerId);
    } else {
      this.currentTrick += 1;
      this.currentPhase = 'TRICK_PLAY';

      if (winningPlayerId !== 'EMPATE') {
        const nextLeaderIndex = this.players.findIndex((p) => p.id === winningPlayerId);
        this.currentTurnIndex = nextLeaderIndex >= 0 ? nextLeaderIndex : 0;
        this.trickLeaderId = winningPlayerId;
      } else {
        const leaderIndex = this.players.findIndex((p) => p.id === this.trickLeaderId);
        this.currentTurnIndex = leaderIndex >= 0 ? leaderIndex : this.manoIndex;
      }
    }
  }

  protected finishTrickRound(roundWinnerId: string): void {
    const points = this.trucoState.points;
    this.scores[roundWinnerId] = (this.scores[roundWinnerId] ?? 0) + points;

    const winner = this.players.find((p) => p.id === roundWinnerId);
    this.lastActionText = `${winner?.name ?? 'Jugador'} ganó la ronda (+${points} pt${points > 1 ? 's' : ''})`;

    if (this.scores[roundWinnerId] >= this.targetScore) {
      this.status = 'FINISHED';
      this.winnerId = roundWinnerId;
      return;
    }

    this.manoIndex = (this.manoIndex + 1) % this.players.length;
    this.round += 1;
    this.startNewRound();
  }

  protected resolveTrick(): { winnerId: string; points: number } | null {
    if (this.isRoundTrickGame) {
      this.resolveRoundTrick();
      return null;
    }
    if (this.trickCards.length === 0) return null;

    const hierarchy = this.definition.rules.cardHierarchy;
    let winner: { playerId: string; card: Card } | null = null;
    let best = Number.NEGATIVE_INFINITY;

    for (const entry of this.trickCards) {
      const raw = hierarchy ? hierarchy[String(entry.card.value)] : Number(entry.card.value);
      const strength = Number.isFinite(Number(raw)) ? Number(raw) : 0;
      if (strength > best) {
        best = strength;
        winner = entry;
      }
    }

    this.trickCards = [];
    if (!winner) return null;

    this.scores[winner.playerId] = (this.scores[winner.playerId] ?? 0) + 1;
    this.checkScoreWin(winner.playerId);
    return { winnerId: winner.playerId, points: 1 };
  }

  protected handleCallEnvido(
    playerId: string,
    callType: 'ENVIDO' | 'REAL_ENVIDO' | 'FALTA_ENVIDO'
  ): { success: boolean; result?: unknown } {
    if (this.currentTrick !== 1) {
      throw new Error('El Envido solo se puede cantar en la primera baza');
    }
    if (
      this.envidoState.state === 'RESOLVED' ||
      this.envidoState.state === 'REJECTED' ||
      this.envidoState.state === 'DISABLED'
    ) {
      throw new Error('El Envido ya no está disponible en esta ronda');
    }

    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const history = [...this.envidoState.callHistory, callType];
    const { stake, refused } = this.calculateEnvidoBetPoints(history);

    this.preBetTurnIndex = this.currentTurnIndex;
    this.envidoState = {
      state: 'PENDING',
      currentCall: callType,
      callerId: playerId,
      challengedId: rival.id,
      callHistory: history,
      pointsAtStake: stake,
      pointsIfRefused: refused,
      winnerId: null,
      pointsAwarded: 0,
      playerTantos: {},
    };

    this.currentTurnIndex = this.players.findIndex((p) => p.id === rival.id);

    const callerName = this.players.find((p) => p.id === playerId)?.name ?? 'Jugador';
    this.lastActionText = `¡${callerName} cantó ${callType.replace('_', ' ')}!`;

    return { success: true, result: { call: callType, pointsAtStake: stake } };
  }

  protected calculateEnvidoBetPoints(history: string[]): { stake: number; refused: number } {
    const key = history.join(' ');

    if (key.includes('FALTA_ENVIDO')) {
      const refused =
        key === 'FALTA_ENVIDO'
          ? 1
          : key === 'ENVIDO FALTA_ENVIDO'
          ? 2
          : key === 'REAL_ENVIDO FALTA_ENVIDO'
          ? 3
          : key === 'ENVIDO REAL_ENVIDO FALTA_ENVIDO'
          ? 5
          : key === 'ENVIDO ENVIDO REAL_ENVIDO FALTA_ENVIDO'
          ? 7
          : 2;

      const stake = calculateFaltaEnvidoPoints(this.scores, this.targetScore);
      return { stake, refused };
    }

    const BET_TABLE: Record<string, { stake: number; refused: number }> = {
      ENVIDO: { stake: 2, refused: 1 },
      REAL_ENVIDO: { stake: 3, refused: 1 },
      'ENVIDO ENVIDO': { stake: 4, refused: 2 },
      'ENVIDO REAL_ENVIDO': { stake: 5, refused: 2 },
      'ENVIDO ENVIDO REAL_ENVIDO': { stake: 7, refused: 4 },
    };

    return BET_TABLE[key] ?? { stake: 2, refused: 1 };
  }

  protected handleRespondBet(
    playerId: string,
    accept: boolean,
    raise?: string
  ): { success: boolean; result?: unknown } {
    if (this.envidoState.state === 'PENDING') {
      if (this.envidoState.challengedId !== playerId) {
        throw new Error('No es tu turno de responder al Envido');
      }

      if (raise) {
        const validRaises = ['ENVIDO', 'REAL_ENVIDO', 'FALTA_ENVIDO'];
        const formatted = raise.startsWith('CALL_') ? raise.replace('CALL_', '') : raise;
        if (!validRaises.includes(formatted)) {
          throw new Error(`Canto no válido para subir envido: ${raise}`);
        }
        return this.handleCallEnvido(playerId, formatted as any);
      }

      return this.resolveEnvidoResponse(playerId, accept);
    }

    if (this.trucoState.state === 'PENDING') {
      if (this.trucoState.challengedId !== playerId) {
        throw new Error('No es tu turno de responder al Truco');
      }

      if (raise) {
        const formatted = raise.startsWith('CALL_') ? raise.replace('CALL_', '') : raise;
        if (formatted === 'RETRUCO' || formatted === 'VALE_CUATRO') {
          return this.handleCallTruco(playerId, formatted);
        }
        throw new Error(`Canto no válido para subir truco: ${raise}`);
      }

      return this.resolveTrucoResponse(playerId, accept);
    }

    throw new Error('No hay apuestas pendientes para responder');
  }

  protected resolveEnvidoResponse(
    playerId: string,
    accept: boolean
  ): { success: boolean; result?: unknown } {
    const callerId = this.envidoState.callerId!;
    const responder = this.players.find((p) => p.id === playerId);
    const caller = this.players.find((p) => p.id === callerId);

    if (accept) {
      const playerTantos: Record<string, number> = {};
      for (const p of this.players) {
        playerTantos[p.id] = calculateEnvidoPoints(p.hand);
      }

      const p1 = this.players[0];
      const p2 = this.players[1];
      const t1 = playerTantos[p1.id];
      const t2 = playerTantos[p2.id];

      let envidoWinnerId: string;
      if (t1 > t2) {
        envidoWinnerId = p1.id;
      } else if (t2 > t1) {
        envidoWinnerId = p2.id;
      } else {
        envidoWinnerId = this.players[this.manoIndex].id;
      }

      const points = this.envidoState.pointsAtStake;
      this.scores[envidoWinnerId] = (this.scores[envidoWinnerId] ?? 0) + points;

      this.envidoState.state = 'RESOLVED';
      this.envidoState.winnerId = envidoWinnerId;
      this.envidoState.pointsAwarded = points;
      this.envidoState.playerTantos = playerTantos;

      const winnerPlayer = this.players.find((p) => p.id === envidoWinnerId);
      this.lastActionText = `Envido querido: ${p1.name} (${t1}) vs ${p2.name} (${t2}). Ganó ${winnerPlayer?.name} (+${points} pts)`;

      if (this.scores[envidoWinnerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = envidoWinnerId;
        return { success: true, result: { winnerId: envidoWinnerId, points } };
      }

      this.currentTurnIndex = this.preBetTurnIndex;
      this.currentPhase = 'TRICK_PLAY';
      return { success: true, result: { winnerId: envidoWinnerId, points, playerTantos } };
    } else {
      const points = this.envidoState.pointsIfRefused;
      this.scores[callerId] = (this.scores[callerId] ?? 0) + points;

      this.envidoState.state = 'REJECTED';
      this.envidoState.winnerId = callerId;
      this.envidoState.pointsAwarded = points;

      this.lastActionText = `${responder?.name} dijo: NO QUIERO. ${caller?.name} suma ${points} pt(s) de envido`;

      if (this.scores[callerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = callerId;
        return { success: true, result: { winnerId: callerId, points } };
      }

      this.currentTurnIndex = this.preBetTurnIndex;
      this.currentPhase = 'TRICK_PLAY';
      return { success: true, result: { winnerId: callerId, points } };
    }
  }

  protected handleCallTruco(
    playerId: string,
    level: 'TRUCO' | 'RETRUCO' | 'VALE_CUATRO'
  ): { success: boolean; result?: unknown } {
    if (this.trucoState.lastCallerId === playerId) {
      throw new Error('No podés subir tu propia apuesta de Truco');
    }

    if (level === 'TRUCO') {
      if (this.trucoState.currentLevel !== null) {
        throw new Error('El Truco ya fue cantado');
      }
    } else if (level === 'RETRUCO') {
      if (this.trucoState.currentLevel !== 'TRUCO') {
        throw new Error('Solo podés cantar Retruco sobre un Truco');
      }
    } else if (level === 'VALE_CUATRO') {
      if (this.trucoState.currentLevel !== 'RETRUCO') {
        throw new Error('Solo podés cantar Vale Cuatro sobre un Retruco');
      }
    }

    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const points = level === 'TRUCO' ? 2 : level === 'RETRUCO' ? 3 : 4;
    const pointsIfRefused = level === 'TRUCO' ? 1 : level === 'RETRUCO' ? 2 : 3;

    this.preBetTurnIndex = this.currentTurnIndex;
    this.trucoState = {
      state: 'PENDING',
      currentLevel: level,
      points,
      pointsIfRefused,
      callerId: playerId,
      challengedId: rival.id,
      lastCallerId: playerId,
    };

    this.currentTurnIndex = this.players.findIndex((p) => p.id === rival.id);

    const callerName = this.players.find((p) => p.id === playerId)?.name ?? 'Jugador';
    this.lastActionText = `¡${callerName} cantó ${level === 'VALE_CUATRO' ? 'VALE CUATRO' : level}!`;

    return { success: true, result: { level, points } };
  }

  protected resolveTrucoResponse(
    playerId: string,
    accept: boolean
  ): { success: boolean; result?: unknown } {
    const callerId = this.trucoState.callerId!;
    const responder = this.players.find((p) => p.id === playerId);
    const caller = this.players.find((p) => p.id === callerId);

    if (accept) {
      this.trucoState.state = 'RESOLVED';
      this.lastActionText = `${responder?.name} dijo: ¡QUIERO! (${this.trucoState.currentLevel})`;
      this.currentTurnIndex = this.preBetTurnIndex;
      return { success: true, result: { accepted: true, points: this.trucoState.points } };
    } else {
      const points = this.trucoState.pointsIfRefused;
      this.scores[callerId] = (this.scores[callerId] ?? 0) + points;

      this.lastActionText = `${responder?.name} dijo: NO QUIERO. ${caller?.name} gana la ronda (+${points} pt${points > 1 ? 's' : ''})`;

      if (this.scores[callerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = callerId;
        return { success: true, result: { winnerId: callerId, points } };
      }

      this.manoIndex = (this.manoIndex + 1) % this.players.length;
      this.round += 1;
      this.startNewRound();
      return { success: true, result: { winnerId: callerId, points } };
    }
  }

  protected handleFold(playerId: string): { success: boolean; result?: unknown } {
    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const points = this.trucoState.state === 'RESOLVED' ? this.trucoState.points : 1;
    this.scores[rival.id] = (this.scores[rival.id] ?? 0) + points;

    const foldingPlayer = this.players.find((p) => p.id === playerId);
    this.lastActionText = `${foldingPlayer?.name} se fue al mazo. ${rival.name} gana la ronda (+${points} pt${points > 1 ? 's' : ''})`;

    if (this.scores[rival.id] >= this.targetScore) {
      this.status = 'FINISHED';
      this.winnerId = rival.id;
      return { success: true, result: { foldedPlayerId: playerId, winnerId: rival.id } };
    }

    this.manoIndex = (this.manoIndex + 1) % this.players.length;
    this.round += 1;
    this.startNewRound();
    return { success: true, result: { foldedPlayerId: playerId, winnerId: rival.id } };
  }

  public executeBotTurn(botId: string): void {
    if (this.status !== 'IN_PROGRESS') return;

    const bot = this.players.find((p) => p.id === botId);
    if (!bot || !bot.isBot) return;

    if (!this.isRoundTrickGame) {
      const move = decideBotMove(
        bot.hand,
        this.getTopDiscardCard(),
        this.activeColor,
        this.definition.rules
      );
      if (move) {
        this.playCard(botId, move.cardId, move.chosenColor);
      } else {
        this.drawCard(botId);
      }
      return;
    }

    // 1. Respond to pending bet if challenged
    if (this.envidoState.state === 'PENDING' && this.envidoState.challengedId === botId) {
      const botTantos = calculateEnvidoPoints(bot.hand);
      if (botTantos >= 26) {
        this.executeAction(botId, 'QUIERO');
      } else {
        this.executeAction(botId, 'NO_QUIERO');
      }
      return;
    }

    if (this.trucoState.state === 'PENDING' && this.trucoState.challengedId === botId) {
      const hierarchy = this.definition.rules.cardHierarchy ?? TRUCO_CARD_HIERARCHY;
      const highCards = bot.hand.filter((c) => getCardHierarchyValue(c, hierarchy) >= 9).length;
      if (highCards >= 1 || this.roundTricks.some((t) => t.winnerId === botId)) {
        this.executeAction(botId, 'QUIERO');
      } else {
        this.executeAction(botId, 'NO_QUIERO');
      }
      return;
    }

    // 2. Turn to play or call
    if (this.players[this.currentTurnIndex]?.id !== botId) return;

    const hierarchy = this.definition.rules.cardHierarchy ?? TRUCO_CARD_HIERARCHY;

    // Check if bot wants to call Envido in trick 1
    if (this.currentTrick === 1 && this.envidoState.state === 'AVAILABLE') {
      const botTantos = calculateEnvidoPoints(bot.hand);
      if (botTantos >= 28) {
        this.executeAction(botId, 'CALL_ENVIDO');
        return;
      }
    }

    // Check if bot wants to call Truco
    if (this.trucoState.state === 'AVAILABLE' && this.trucoState.currentLevel === null) {
      const highCards = bot.hand.filter((c) => getCardHierarchyValue(c, hierarchy) >= 10).length;
      if (highCards >= 2 || (this.currentTrick >= 2 && this.roundTricks[0]?.winnerId === botId)) {
        this.executeAction(botId, 'CALL_TRUCO');
        return;
      }
    }

    // Play card
    if (bot.hand.length === 0) return;

    if (this.trickCards.length === 0) {
      const sorted = [...bot.hand].sort(
        (a, b) => getCardHierarchyValue(a, hierarchy) - getCardHierarchyValue(b, hierarchy)
      );
      this.playCard(botId, sorted[0].id);
    } else {
      const rivalCard = this.trickCards[0].card;
      const rivalVal = this.trickCards[0].isTapada
        ? 0
        : getCardHierarchyValue(rivalCard, hierarchy);

      const winningCards = bot.hand
        .filter((c) => getCardHierarchyValue(c, hierarchy) > rivalVal)
        .sort(
          (a, b) => getCardHierarchyValue(a, hierarchy) - getCardHierarchyValue(b, hierarchy)
        );

      if (winningCards.length > 0) {
        this.playCard(botId, winningCards[0].id);
      } else {
        const sorted = [...bot.hand].sort(
          (a, b) => getCardHierarchyValue(a, hierarchy) - getCardHierarchyValue(b, hierarchy)
        );
        this.playCard(botId, sorted[0].id);
      }
    }
  }

  protected enterPhase(phaseId: string): void {
    const phase = this.phases?.find((candidate) => candidate.id === phaseId);
    if (!phase) {
      throw new Error(`Unknown phase: ${phaseId}`);
    }
    this.currentPhase = phase.id;
    this.applyEffects(phase.onEnter, null);
  }

  protected changePhase(phaseId?: string): void {
    const phases = this.phases;
    if (!phases || phases.length === 0) return;

    const targetId = phaseId ?? this.getCurrentPhase()?.nextPhase;
    if (!targetId) return;

    const target = phases.find((candidate) => candidate.id === targetId);
    if (!target) return;

    this.applyEffects(this.getCurrentPhase()?.onExit, null);
    this.currentPhase = target.id;
    this.applyEffects(target.onEnter, null);
  }

  protected applyEffects(
    effects: EffectDefinition[] | undefined,
    actorId: string | null,
    payload: Record<string, unknown> = {}
  ): void {
    if (!effects) return;
    for (const effect of effects) {
      this.applyEffect(effect, actorId, payload);
    }
  }

  protected applyEffect(
    effect: EffectDefinition,
    actorId: string | null,
    payload: Record<string, unknown>
  ): unknown {
    const params = effect.params ?? {};

    switch (effect.type) {
      case 'MOVE_CARD': {
        const cardId = String(params.cardId ?? payload.cardId ?? '');
        const player = this.players.find((p) => p.id === actorId);
        if (!player) return null;
        const index = player.hand.findIndex((card) => card.id === cardId);
        if (index === -1) return null;
        const [card] = player.hand.splice(index, 1);
        if (String(params.to ?? 'TRICK_TABLE') === 'DISCARD_PILE') {
          this.discardPile.push(card);
        } else {
          this.trickCards.push({ playerId: player.id, card });
        }
        return card;
      }

      case 'DEAL_CARDS': {
        const count = Number(params.count ?? payload.count ?? 1);
        for (const player of this.players) {
          if (this.deckManager.count === 0 && this.definition.rules.reshuffleDiscardPile) {
            this.deckManager.recycleDiscard(this.discardPile);
          }
          player.hand.push(...this.deckManager.drawMultiple(count));
        }
        return count;
      }

      case 'ADVANCE_TURN':
        this.advanceTurn(Number(params.step ?? payload.step ?? 1));
        return null;

      case 'SET_ACTIVE_COLOR': {
        const color = String(params.color ?? payload.color ?? '');
        if (color) this.activeColor = color;
        return color || null;
      }

      case 'RESOLVE_TRICK':
        return this.resolveTrick();

      case 'AWARD_POINTS': {
        const target = String(params.playerId ?? payload.playerId ?? actorId ?? '');
        if (!target) return null;
        const amount = Number(params.amount ?? payload.amount ?? 1);
        this.scores[target] = (this.scores[target] ?? 0) + amount;
        this.checkScoreWin(target);
        return { playerId: target, amount };
      }

      case 'CHANGE_PHASE':
        this.changePhase(params.phase ? String(params.phase) : undefined);
        return this.currentPhase;

      case 'RESET_ROUND':
        this.resetRound();
        return null;

      case 'SCORE_ENVIDO': {
        const callerId = this.envidoState.callerId;
        const challengedId = this.envidoState.challengedId;
        if (!callerId || !challengedId) return null;
        return this.resolveEnvidoResponse(challengedId, true);
      }

      case 'RESOLVE_BET': {
        const accept = Boolean(params.accept ?? payload.accept ?? true);
        const challengedId = this.envidoState.challengedId ?? this.trucoState.challengedId;
        if (!challengedId) return null;
        return this.handleRespondBet(challengedId, accept);
      }

      default:
        return null;
    }
  }

  protected resetRound(): void {
    this.trickCards = [];
    this.activeBets = {};
    this.customState = { ...(this.definition.rules.customState ?? {}) };
    const round = Number(this.customState.round ?? 1);
    this.customState.round = round + 1;
  }

  protected setCustomState(key: string, value: unknown): void {
    this.customState[key] = value;
  }

  private getCurrentPhase(): PhaseDefinition | undefined {
    if (!this.currentPhase) return undefined;
    return this.phases?.find((phase) => phase.id === this.currentPhase);
  }

  private checkPhaseAllows(actionType: string): string | null {
    const phases = this.phases;
    if (!phases || phases.length === 0) return null;

    const phase = this.getCurrentPhase();
    if (!phase) return 'No active phase';

    if (this.isRoundTrickGame) {
      if (actionType === 'QUIERO' || actionType === 'NO_QUIERO') {
        if (
          phase.allowedActions.includes('RESPOND_BET') ||
          phase.allowedActions.includes(actionType)
        ) {
          return null;
        }
      }
      if (actionType === 'PLAY_CARD') {
        if (this.envidoState.state === 'PENDING' || this.trucoState.state === 'PENDING') {
          return 'Hay una apuesta pendiente que debe ser respondida primero';
        }
        return null;
      }
      if (
        actionType === 'CALL_TRUCO' ||
        actionType === 'CALL_RETRUCO' ||
        actionType === 'CALL_VALE_CUATRO'
      ) {
        if (this.envidoState.state === 'PENDING') {
          return 'Hay un envido pendiente';
        }
        return null;
      }
    }

    if (!phase.allowedActions.includes(actionType)) {
      return `Action ${actionType} not allowed in phase ${phase.id}`;
    }
    return null;
  }

  private dispatchAction(
    playerId: string,
    actionType: string,
    payload: Record<string, unknown>
  ): unknown {
    switch (actionType) {
      case 'PLAY_CARD': {
        const cardId = String(payload.cardId ?? '');
        const chosenColor = payload.chosenColor ? String(payload.chosenColor) : undefined;
        const isTapada = Boolean(payload.isTapada);
        const player = this.players.find((p) => p.id === playerId);
        const card = player?.hand.find((c) => c.id === cardId);
        this.playCard(playerId, cardId, chosenColor, isTapada);
        if (!this.isRoundTrickGame && card && this.definition.rules.cardHierarchy) {
          this.trickCards.push({ playerId, card });
        }
        return { playedCardId: cardId };
      }

      case 'DRAW_CARD':
        return this.drawCard(playerId);

      case 'CHOOSE_COLOR': {
        const color = String(payload.color ?? '');
        this.chooseColor(playerId, color);
        return { color };
      }

      case 'PASS_TURN':
        this.passTurn(playerId);
        return null;

      case 'CALL_BET': {
        const bet = { playerId, ...payload };
        this.activeBets[playerId] = bet;
        this.setCustomState('betPending', true);
        return bet;
      }

      case 'CALL_ENVIDO':
        return this.handleCallEnvido(playerId, 'ENVIDO');

      case 'CALL_REAL_ENVIDO':
        return this.handleCallEnvido(playerId, 'REAL_ENVIDO');

      case 'CALL_FALTA_ENVIDO':
        return this.handleCallEnvido(playerId, 'FALTA_ENVIDO');

      case 'CALL_TRUCO':
        return this.handleCallTruco(playerId, 'TRUCO');

      case 'CALL_RETRUCO':
        return this.handleCallTruco(playerId, 'RETRUCO');

      case 'CALL_VALE_CUATRO':
        return this.handleCallTruco(playerId, 'VALE_CUATRO');

      case 'RESPOND_BET': {
        if (
          this.isRoundTrickGame ||
          this.envidoState.state === 'PENDING' ||
          this.trucoState.state === 'PENDING'
        ) {
          const accept = Boolean(payload.accept);
          const raise = payload.raise ? String(payload.raise) : undefined;
          return this.handleRespondBet(playerId, accept, raise);
        }
        this.setCustomState('betPending', false);
        const response = { playerId, ...payload };
        this.activeBets[`response_${playerId}`] = response;
        return response;
      }

      case 'QUIERO':
        return this.handleRespondBet(playerId, true);

      case 'NO_QUIERO':
        return this.handleRespondBet(playerId, false);

      case 'FOLD': {
        if (this.isRoundTrickGame) {
          return this.handleFold(playerId);
        }
        const folded = Array.isArray(this.customState.folded)
          ? [...(this.customState.folded as string[])]
          : [];
        if (!folded.includes(playerId)) folded.push(playerId);
        this.setCustomState('folded', folded);
        return { folded: playerId };
      }

      default:
        return null;
    }
  }

  private evaluateCondition(
    condition: ConditionDefinition,
    playerId: string,
    payload: Record<string, unknown>
  ): boolean {
    switch (condition.type) {
      case 'IS_ACTIVE_PLAYER':
        return this.players[this.currentTurnIndex]?.id === playerId;

      case 'MATCH_TOP_CARD': {
        const player = this.players.find((p) => p.id === playerId);
        const card = player?.hand.find((c) => c.id === String(payload.cardId ?? ''));
        if (!card) return false;
        return validateCardPlay(
          card,
          this.getTopDiscardCard(),
          this.activeColor,
          this.definition.rules
        ).isValid;
      }

      case 'HAS_MIN_CARDS': {
        const player = this.players.find((p) => p.id === playerId);
        return !!player && player.hand.length >= Number(condition.params?.min ?? 1);
      }

      case 'EVALUATE_CARD_HIERARCHY': {
        const hierarchy = this.definition.rules.cardHierarchy;
        if (!hierarchy) return false;
        const player = this.players.find((p) => p.id === playerId);
        const card = player?.hand.find((c) => c.id === String(payload.cardId ?? ''));
        return !!card && card.value !== undefined && String(card.value) in hierarchy;
      }

      case 'CAN_CALL_ENVIDO':
        return (
          this.currentTrick === 1 &&
          (this.envidoState.state === 'AVAILABLE' ||
            (this.envidoState.state === 'PENDING' && this.envidoState.challengedId === playerId))
        );

      case 'CAN_CALL_TRUCO':
        return (
          this.trucoState.lastCallerId !== playerId &&
          (this.trucoState.state === 'AVAILABLE' ||
            this.trucoState.state === 'PENDING' ||
            this.trucoState.state === 'RESOLVED')
        );

      case 'IS_BET_PENDING':
        return (
          this.envidoState.state === 'PENDING' ||
          this.trucoState.state === 'PENDING' ||
          this.customState.betPending === true
        );

      default:
        return true;
    }
  }

  private checkScoreWin(playerId: string): void {
    const winCondition = this.definition.rules.winCondition;
    if (winCondition.type !== 'SCORE_THRESHOLD') return;
    const target = this.definition.rules.targetScore ?? winCondition.targetScore;
    if (target !== undefined && (this.scores[playerId] ?? 0) >= target) {
      this.status = 'FINISHED';
      this.winnerId = playerId;
    }
  }
}