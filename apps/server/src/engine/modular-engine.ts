import { randomInt } from 'node:crypto';
import type {
  Card,
  ConditionDefinition,
  EffectDefinition,
  GameMode,
  GameSchemaDefinition,
  PhaseDefinition,
  PlayerPublicInfo,
  PublicGameState,
  SubmissionRoundState,
} from './types.js';
import { GameEngine, InternalPlayer } from './state-machine.js';
import { getBuiltinAction } from './capabilities/registry.js';
import { validateCardPlay } from './validator.js';
import {
  calculateEnvidoPoints,
  calculateFaltaEnvidoPoints,
  checkHasFlor,
  calculateFlorPoints,
  resolveFlorWinner,
  calculateFlorBetPoints,
  getCardHierarchyValue,
  resolveTrickWinner,
  resolveRoundWinner,
  TRUCO_CARD_HIERARCHY,
} from '@al-mazo/shared';
import { decideBotMove } from './bot.js';
import {
  calculateEscobaValues,
  checkInitialTableSpecialRule,
  scoreEscobaMatchRound,
} from '../games/escoba/definition.js';

export interface ActionResult {
  success: boolean;
  result?: unknown;
}

export interface InternalSubmissionEntry {
  id: string;
  cards: Card[];
  playerId: string;
}

export interface InternalSubmissionRoundState {
  phase: SubmissionRoundState['phase'];
  judgeId: string;
  promptCard: Card | null;
  requiredPicks: number;
  expectedSubmitters: string[];
  submittedPlayerIds: string[];
  submissions: InternalSubmissionEntry[];
  winnerSubmissionId: string | null;
  winnerPlayerId: string | null;
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

export interface FlorState {
  state: 'AVAILABLE' | 'PENDING' | 'RESOLVED' | 'REJECTED' | 'DISABLED';
  currentCall: 'FLOR' | 'CONTRA_FLOR' | 'CONTRA_FLOR_AL_RESTO' | null;
  callerId: string | null;
  challengedId: string | null;
  pointsAtStake: number;
  pointsIfRefused: number;
  winnerId: string | null;
  pointsAwarded: number;
  playersWithFlor: string[];
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
  savedPreBetTurnIndex?: number;
}

export interface TrucoCustomState {
  round: number;
  manoPlayerId: string;
  targetScore: number;
  currentTrick: number;
  roundTricks: RoundTrickRecord[];
  trickWins: Record<string, number>;
  flor: FlorState;
  envido: EnvidoState;
  truco: TrucoBetState;
  pendingBet: {
    type: 'FLOR' | 'ENVIDO' | 'TRUCO';
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

  // Truco bet state that was paused because rival responded "El envido está primero"
  protected savedTrucoBet: TrucoBetState | null = null;

  // Judge/submission round state for simultaneous hidden-answer games
  protected promptPile: Card[] = [];
  protected promptDiscard: Card[] = [];
  protected answerDiscard: Card[] = [];
  protected submissionRound: InternalSubmissionRoundState | null = null;

  protected florState: FlorState = {
    state: 'AVAILABLE',
    currentCall: null,
    callerId: null,
    challengedId: null,
    pointsAtStake: 0,
    pointsIfRefused: 0,
    winnerId: null,
    pointsAwarded: 0,
    playersWithFlor: [],
  };

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

  // Community and capture zone state
  protected tableCards: Card[] = [];
  protected capturedCards: Record<string, Card[]> = {};
  protected escobas: Record<string, number> = {};
  protected lastCapturePlayerId: string | null = null;
  protected dealerIndex = 0;
  protected dealerPlayerId: string | null = null;

  constructor(definition: GameSchemaDefinition) {
    super(definition);
    this.customState = { ...(definition.rules.customState ?? {}) };
    this.targetScore =
      definition.rules.targetScore ??
      (definition.rules.winCondition.type === 'SCORE_THRESHOLD'
        ? definition.rules.winCondition.targetScore ?? 30
        : 30);
  }

  private get phases(): PhaseDefinition[] | undefined {
    return this.definition.rules.phases;
  }

  /**
   * Infers the table mode from schema markers when the editor did not set an
   * explicit `rules.gameMode`.
   */
  private detectGameMode(): GameMode {
    const rules = this.definition.rules;
    const hasTrickActions = rules.phases?.some((p) =>
      p.allowedActions.some((a) =>
        ['CALL_ENVIDO', 'CALL_TRUCO', 'CALL_FLOR', 'QUIERO', 'NO_QUIERO'].includes(a)
      )
    );
    const hasOnlyTrickZone =
      rules.zones?.some((z) => z.type === 'TRICK_TABLE') &&
      !rules.zones?.some((z) => z.type === 'DISCARD_PILE');
    const isTrucoLike =
      Boolean(rules.cardHierarchy) && (rules.matchingProperties?.length ?? 0) === 0;

    if (hasTrickActions || hasOnlyTrickZone || isTrucoLike) return 'TRICK';

    const isPrompt = Boolean(
      rules.phases?.some((phase) => phase.allowedActions.includes('REVEAL_CARD'))
    );
    if (isPrompt) return 'PROMPT';

    if (
      rules.zones?.some((z) => z.type === 'COMMUNITY') ||
      rules.customState?.initialTableCards !== undefined ||
      this.definition.slug === 'escoba-del-15'
    ) {
      return 'COMMUNITY';
    }

    return 'DISCARD';
  }

  public get isSubmissionGame(): boolean {
    return Boolean(this.definition.rules.submission);
  }

  private get submissionConfig(): GameSchemaDefinition['rules']['submission'] | undefined {
    return this.definition.rules.submission;
  }

  /**
   * Explains to the client which table layout/flow corresponds to this game.
   * An explicit `rules.gameMode` from the editor wins over the heuristics so
   * start/play/bot routing and the client table always agree.
   */
  public get gameMode(): GameMode {
    return this.definition.rules.gameMode ?? this.detectGameMode();
  }

  public get isRoundTrickGame(): boolean {
    return this.gameMode === 'TRICK';
  }

  public isCommunityGame(): boolean {
    return this.gameMode === 'COMMUNITY';
  }

  public get isPromptGame(): boolean {
    return this.gameMode === 'PROMPT';
  }

  public override start(): void {
    const minPlayers = this.definition.rules.minPlayers ?? 2;
    if (this.players.length < minPlayers) {
      throw new Error(`At least ${minPlayers} players required to start`);
    }

    // Initialize match-wide state BEFORE dealing: startCommunityGame() may
    // award initial-deal Escobas that must not be overwritten afterwards.
    this.scores = {};
    for (const player of this.players) {
      this.scores[player.id] = 0;
    }
    this.customState = { ...(this.definition.rules.customState ?? {}) };
    this.trickCards = [];
    this.activeBets = {};
    this.round = 1;

    if (this.isRoundTrickGame) {
      this.status = 'IN_PROGRESS';
      this.manoIndex = 0;
      this.startNewRound();
    } else if (this.isCommunityGame()) {
      this.startCommunityGame();
    } else {
      super.start();
    }

    if (this.isCommunityGame()) {
      this.syncCommunityState();
    }

    if (this.submissionConfig) {
      this.prepareSubmissionDecks();
      this.submissionRound = {
        phase: 'PREPARE',
        judgeId: this.players[this.currentTurnIndex]?.id ?? this.players[0]?.id ?? '',
        promptCard: null,
        requiredPicks: Math.max(1, this.submissionConfig.defaultPicks),
        expectedSubmitters: [],
        submittedPlayerIds: [],
        submissions: [],
        winnerSubmissionId: null,
        winnerPlayerId: null,
      };
      this.currentPhase = null;

      if (!this.phases || this.phases.length === 0) {
        this.applyEffect({ type: 'DRAW_PROMPT' }, null, {});
        this.applyEffect({ type: 'OPEN_SUBMISSIONS' }, null, {});
      }
    }

    const phases = this.phases;
    if (phases && phases.length > 0 && !this.isRoundTrickGame) {
      this.enterPhase(phases[0].id);
    }
  }

  public startNewRound(): void {
    this.deckManager.generateFromConfig(this.definition.deckConfig);
    this.deckManager.shuffle();

    const handSize = this.definition.rules.initialHandSize ?? 3;
    const playersWithFlor: string[] = [];
    for (const p of this.players) {
      p.hand = this.deckManager.drawMultiple(handSize);
      if (checkHasFlor(p.hand)) {
        playersWithFlor.push(p.id);
      }
    }

    this.currentTrick = 1;
    this.trickCards = [];
    this.roundTricks = [];
    this.currentTurnIndex = this.manoIndex;
    const manoPlayer = this.players[this.manoIndex];
    this.trickLeaderId = manoPlayer?.id ?? null;
    this.preBetTurnIndex = this.manoIndex;
    this.currentPhase = this.phases?.[0]?.id ?? 'ENVIDO_PHASE';
    this.savedTrucoBet = null;

    this.florState = {
      state: 'AVAILABLE',
      currentCall: null,
      callerId: null,
      challengedId: null,
      pointsAtStake: 0,
      pointsIfRefused: 0,
      winnerId: null,
      pointsAwarded: 0,
      playersWithFlor,
    };

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

  protected startCommunityGame(): void {
    this.deckManager.generateFromConfig(this.definition.deckConfig);

    // Deal initial hands
    const handSize = this.definition.rules.initialHandSize ?? 3;
    for (const player of this.players) {
      player.hand = this.deckManager.drawMultiple(handSize);
      player.hasDrawnThisTurn = false;
    }

    this.discardPile = [];
    this.activeColor = null;
    this.currentTurnIndex = 0;
    this.turnDirection = 1;
    this.status = 'IN_PROGRESS';

    const tableCount = Number(this.definition.rules.customState?.initialTableCards ?? 4);
    this.tableCards = this.deckManager.drawMultiple(tableCount);

    this.dealerIndex = this.players.length - 1;
    this.dealerPlayerId = this.players[this.dealerIndex]?.id ?? null;
    this.currentTurnIndex = 0; // First player ('mano') starts

    this.capturedCards = {};
    this.escobas = {};
    for (const player of this.players) {
      this.capturedCards[player.id] = [];
      this.escobas[player.id] = 0;
    }
    this.lastCapturePlayerId = null;

    // Check special initial deal rule for Escoba (if table sums to 15 or 30)
    if (this.definition.slug === 'escoba-del-15') {
      this.checkEscobaInitialDeal();
    }
  }

  protected checkEscobaInitialDeal(): void {
    const special = checkInitialTableSpecialRule(this.tableCards);
    if (special.capturesAll && this.dealerPlayerId) {
      this.capturedCards[this.dealerPlayerId].push(...this.tableCards);
      this.escobas[this.dealerPlayerId] =
        (this.escobas[this.dealerPlayerId] ?? 0) + special.escobas;
      this.scores[this.dealerPlayerId] =
        (this.scores[this.dealerPlayerId] ?? 0) + special.escobas;
      this.tableCards = [];
      this.lastCapturePlayerId = this.dealerPlayerId;
      this.customState.lastEscobaBy = this.dealerPlayerId;
    }
  }

  /**
   * Splits the freshly dealt mixed deck into prompt and answer piles,
   * returning any prompt card accidentally dealt to a hand.
   */
  private prepareSubmissionDecks(): void {
    const config = this.submissionConfig;
    if (!config) return;

    this.deckManager.returnCards(this.discardPile);
    this.discardPile = [];
    this.promptPile = this.deckManager.extract((card) => card.type === config.promptCardType);
    this.promptDiscard = [];
    this.answerDiscard = [];

    const handSize = this.definition.rules.initialHandSize ?? 10;
    for (const player of this.players) {
      player.hand = player.hand.filter((card) => card.type !== config.promptCardType);
      while (player.hand.length < handSize) {
        const card = this.deckManager.draw();
        if (!card) break;
        player.hand.push(card);
      }
    }
  }

  private getPublicSubmissionState(): SubmissionRoundState | null {
    const round = this.submissionRound;
    if (!round) return null;

    const isRevealed = round.phase === 'JUDGING' || round.phase === 'RESOLVED';
    const submissions = isRevealed
      ? round.submissions.map((entry) => ({
          id: entry.id,
          cards: entry.cards.map((card) => ({ ...card })),
          ...(entry.id === round.winnerSubmissionId ? { playerId: entry.playerId } : {}),
        }))
      : [];

    return {
      phase: round.phase,
      judgeId: round.judgeId,
      promptCard: round.promptCard ? { ...round.promptCard } : null,
      requiredPicks: round.requiredPicks,
      expectedSubmitters: [...round.expectedSubmitters],
      submittedPlayerIds: [...round.submittedPlayerIds],
      submissions,
      winnerSubmissionId: round.winnerSubmissionId,
      winnerPlayerId: round.winnerPlayerId,
    };
  }

  /** Players who owe an action right now, or undefined for turn-based games. */
  public getAwaitingPlayerIds(): string[] | undefined {
    if (!this.isSubmissionGame) return undefined;
    const round = this.submissionRound;
    if (!round || this.status !== 'IN_PROGRESS') return [];

    if (round.phase === 'COLLECTING') {
      return round.expectedSubmitters.filter(
        (playerId) => !round.submittedPlayerIds.includes(playerId)
      );
    }
    return round.judgeId ? [round.judgeId] : [];
  }

  private shuffleSubmissions(): void {
    const submissions = this.submissionRound?.submissions;
    if (!submissions) return;
    for (let i = submissions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [submissions[i], submissions[j]] = [submissions[j], submissions[i]];
    }
  }

  /**
   * Deterministic fallback used when a human runs out of turn time.
   */
  public executeAutoTurn(playerId: string): void {
    const round = this.submissionRound;
    if (!this.isSubmissionGame || !round || this.status !== 'IN_PROGRESS') return;
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    if (round.phase === 'COLLECTING' && round.expectedSubmitters.includes(playerId)) {
      if (!round.submittedPlayerIds.includes(playerId)) {
        const cardIds = player.hand.slice(0, round.requiredPicks).map((card) => card.id);
        if (cardIds.length === round.requiredPicks) {
          this.executeAction(playerId, 'SUBMIT_CARDS', { cardIds });
        }
      }
      return;
    }

    if (round.judgeId !== playerId) return;

    if (round.phase === 'JUDGING') {
      const submission = round.submissions[0];
      if (submission) {
        this.executeAction(playerId, 'PICK_SUBMISSION', { submissionId: submission.id });
      }
      return;
    }

    this.executeAction(playerId, 'CONFIRM_PHASE');
  }

  private executeSubmissionBotTurn(bot: InternalPlayer): void {
    const round = this.submissionRound;
    if (!round) return;

    if (round.phase === 'COLLECTING' && round.expectedSubmitters.includes(bot.id)) {
      if (!round.submittedPlayerIds.includes(bot.id)) {
        const shuffled = [...bot.hand];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const cardIds = shuffled.slice(0, round.requiredPicks).map((card) => card.id);
        if (cardIds.length === round.requiredPicks) {
          this.executeAction(bot.id, 'SUBMIT_CARDS', { cardIds });
        }
      }
      return;
    }

    if (round.judgeId !== bot.id) return;

    if (round.phase === 'JUDGING' && round.submissions.length > 0) {
      const submission = round.submissions[randomInt(round.submissions.length)];
      this.executeAction(bot.id, 'PICK_SUBMISSION', { submissionId: submission.id });
      return;
    }

    this.executeAction(bot.id, 'CONFIRM_PHASE');
  }

  /**
   * Keeps a submission round playable when the judge or a submitter leaves:
   * reassigns the judge, drops their pending answer and closes the round if
   * every remaining submitter already answered.
   */
  private handleSubmissionPlayerRemoval(playerId: string): void {
    const round = this.submissionRound;
    if (!round || this.status !== 'IN_PROGRESS') return;

    round.submissions = round.submissions.filter((entry) => entry.playerId !== playerId);
    round.submittedPlayerIds = round.submittedPlayerIds.filter((id) => id !== playerId);
    round.expectedSubmitters = round.expectedSubmitters.filter((id) => id !== playerId);

    if (round.judgeId === playerId) {
      round.judgeId = this.players[0]?.id ?? '';
      round.winnerSubmissionId = null;
      round.winnerPlayerId = null;
    }

    if (round.phase === 'COLLECTING' && round.expectedSubmitters.length > 0) {
      const allReceived = round.expectedSubmitters.every((id) =>
        round.submittedPlayerIds.includes(id)
      );
      if (allReceived) {
        round.phase = 'JUDGING';
        if (this.phases?.length) this.changePhase();
      }
    }
  }

  public override removePlayer(
    id: string,
    policy: 'DISCARD_AND_CONTINUE' | 'ABORT_MATCH' = 'DISCARD_AND_CONTINUE'
  ): void {
    super.removePlayer(id, policy);
    this.handleSubmissionPlayerRemoval(id);
  }

  public getStatus(): 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' {
    return this.status;
  }

  public getWinnerId(): string | null {
    return this.winnerId;
  }

  public override getPublicState(): PublicGameState {
    if (!this.isRoundTrickGame) {
      const base = super.getPublicState();

      if (this.isSubmissionGame) {
        return {
          ...base,
          currentPhase: this.currentPhase,
          scores: { ...this.scores },
          customState: { ...this.customState },
          trickCards: [],
          activeBets: { ...this.activeBets },
          discardPileCount: this.answerDiscard.length,
          awaitingPlayerIds: this.getAwaitingPlayerIds(),
          submission: this.getPublicSubmissionState(),
        };
      }

      return {
        ...base,
        currentPhase: this.currentPhase,
        scores: { ...this.scores },
        customState: { ...this.customState },
        tableCards: this.tableCards.map((card) => ({ ...card })),
        trickCards: this.trickCards.map((entry) => ({
          playerId: entry.playerId,
          card: entry.isTapada
            ? { id: entry.card.id, type: 'TAPADA', value: 'TAPADA', color: 'TAPADA' }
            : { ...entry.card },
        })),
        activeBets: { ...this.activeBets },
        gameMode: this.gameMode,
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
    if (this.florState.state === 'PENDING') {
      pendingBet = {
        type: 'FLOR' as const,
        call: this.florState.currentCall ?? 'FLOR',
        callerId: this.florState.callerId!,
        challengedId: this.florState.challengedId!,
        pointsAtStake: this.florState.pointsAtStake,
        pointsIfRefused: this.florState.pointsIfRefused,
      };
    } else if (this.envidoState.state === 'PENDING') {
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
      flor: { ...this.florState },
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
      scores: { ...this.scores },
      pendingChoice: null,
      currentPhase: this.currentPhase,
      trickCards: this.trickCards.map((tc) => ({
        playerId: tc.playerId,
        card: tc.isTapada
          ? { id: tc.card.id, type: 'TAPADA', value: 'TAPADA', color: 'TAPADA' }
          : tc.card,
      })),
      customState: {
        ...this.customState,
        ...(this.isRoundTrickGame ? (customState as unknown as Record<string, unknown>) : {}),
      },
      activeBets: {
        flor: this.florState,
        envido: this.envidoState,
        truco: this.trucoState,
        ...this.activeBets,
      },
      tableCards: this.tableCards.map((card) => ({ ...card })),
      gameMode: this.gameMode,
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

    if (
      this.florState.state === 'PENDING' ||
      this.envidoState.state === 'PENDING' ||
      this.trucoState.state === 'PENDING'
    ) {
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

    if (this.currentTrick === 1) {
      if (this.trickCards.length >= this.players.length - 1) {
        if (this.envidoState.state === 'AVAILABLE') this.envidoState.state = 'DISABLED';
        if (this.florState.state === 'AVAILABLE') this.florState.state = 'DISABLED';
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
    const roundWinnerId = resolveRoundWinner(this.roundTricks, manoPlayerId);

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

  /**
   * Flor Handlers
   */
  protected handleCallFlor(playerId: string): { success: boolean; result?: unknown } {
    if (this.currentTrick !== 1) {
      throw new Error('La Flor solo se puede cantar en la primera baza');
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !checkHasFlor(player.hand)) {
      throw new Error('No tenés Flor (se requieren 3 cartas del mismo palo)');
    }

    // Singing flor disables envido
    this.envidoState.state = 'DISABLED';

    // If Truco was pending, suspend it
    if (this.trucoState.state === 'PENDING') {
      this.savedTrucoBet = {
        ...this.trucoState,
        savedPreBetTurnIndex: this.preBetTurnIndex,
      };
      this.trucoState.state = 'AVAILABLE';
    }

    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const rivalHasFlor = checkHasFlor(rival.hand);

    if (!rivalHasFlor) {
      // Flor solitaria: otorga 3 puntos automáticos
      this.scores[playerId] = (this.scores[playerId] ?? 0) + 3;
      this.florState = {
        state: 'RESOLVED',
        currentCall: 'FLOR',
        callerId: playerId,
        challengedId: rival.id,
        pointsAtStake: 3,
        pointsIfRefused: 3,
        winnerId: playerId,
        pointsAwarded: 3,
        playersWithFlor: [playerId],
      };
      this.lastActionText = `¡${player.name} cantó FLOR! (+3 pts)`;

      if (this.scores[playerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = playerId;
        return { success: true, result: { call: 'FLOR', points: 3, winnerId: playerId } };
      }

      if (this.savedTrucoBet) {
        const savedPreBet = this.savedTrucoBet.savedPreBetTurnIndex;
        this.trucoState = { ...this.savedTrucoBet };
        this.savedTrucoBet = null;
        if (savedPreBet !== undefined) {
          this.preBetTurnIndex = savedPreBet;
        }
        this.currentTurnIndex = this.players.findIndex(
          (p) => p.id === this.trucoState.challengedId
        );
        this.lastActionText += `. Ahora resta responder al ${this.trucoState.currentLevel}!`;
      }

      return { success: true, result: { call: 'FLOR', points: 3, winnerId: playerId } };
    }

    // Both players have Flor: starts Flor challenge
    this.preBetTurnIndex = this.currentTurnIndex;
    this.florState = {
      state: 'PENDING',
      currentCall: 'FLOR',
      callerId: playerId,
      challengedId: rival.id,
      pointsAtStake: 4,
      pointsIfRefused: 3,
      winnerId: null,
      pointsAwarded: 0,
      playersWithFlor: [playerId, rival.id],
    };

    this.currentTurnIndex = this.players.findIndex((p) => p.id === rival.id);
    this.lastActionText = `¡${player.name} cantó FLOR! ${rival.name} debe responder.`;
    return { success: true, result: { call: 'FLOR', pointsAtStake: 4 } };
  }

  protected handleCallContraFlor(
    playerId: string,
    isAlResto = false
  ): { success: boolean; result?: unknown } {
    if (this.florState.state !== 'PENDING') {
      throw new Error('Solo se puede cantar Contraflor ante un canto previo de Flor');
    }
    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const callType = isAlResto ? 'CONTRA_FLOR_AL_RESTO' : 'CONTRA_FLOR';
    const { stake, refused } = calculateFlorBetPoints(
      callType,
      this.scores,
      this.targetScore
    );

    this.florState.currentCall = callType;
    this.florState.callerId = playerId;
    this.florState.challengedId = rival.id;
    this.florState.pointsAtStake = stake;
    this.florState.pointsIfRefused = refused;

    this.currentTurnIndex = this.players.findIndex((p) => p.id === rival.id);
    const callerName = this.players.find((p) => p.id === playerId)?.name ?? 'Jugador';
    this.lastActionText = `¡${callerName} cantó ${isAlResto ? 'CONTRAFLOR AL RESTO' : 'CONTRAFLOR'}!`;

    return { success: true, result: { call: callType, pointsAtStake: stake } };
  }

  protected resolveFlorResponse(
    playerId: string,
    accept: boolean
  ): { success: boolean; result?: unknown } {
    const callerId = this.florState.callerId!;
    const responder = this.players.find((p) => p.id === playerId);
    const caller = this.players.find((p) => p.id === callerId);

    if (accept) {
      const p1 = this.players[0];
      const p2 = this.players[1];
      const flor1 = calculateFlorPoints(p1.hand);
      const flor2 = calculateFlorPoints(p2.hand);
      const manoId = this.players[this.manoIndex].id;

      const { winnerId } = resolveFlorWinner(
        { id: p1.id, points: flor1 },
        { id: p2.id, points: flor2 },
        manoId
      );

      const points = this.florState.pointsAtStake;
      this.scores[winnerId] = (this.scores[winnerId] ?? 0) + points;

      this.florState.state = 'RESOLVED';
      this.florState.winnerId = winnerId;
      this.florState.pointsAwarded = points;

      const winnerPlayer = this.players.find((p) => p.id === winnerId);
      this.lastActionText = `Flor querida: ${p1.name} (${flor1}) vs ${p2.name} (${flor2}). Ganó ${winnerPlayer?.name} (+${points} pts)`;

      if (this.scores[winnerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = winnerId;
        return { success: true, result: { winnerId, points } };
      }

      if (this.savedTrucoBet) {
        const savedPreBet = this.savedTrucoBet.savedPreBetTurnIndex;
        this.trucoState = { ...this.savedTrucoBet };
        this.savedTrucoBet = null;
        if (savedPreBet !== undefined) {
          this.preBetTurnIndex = savedPreBet;
        }
        this.currentTurnIndex = this.players.findIndex(
          (p) => p.id === this.trucoState.challengedId
        );
        this.lastActionText += `. Ahora resta responder al ${this.trucoState.currentLevel}!`;
        return { success: true, result: { winnerId, points } };
      }

      this.currentTurnIndex = this.preBetTurnIndex;
      this.currentPhase = 'TRICK_PLAY';
      return { success: true, result: { winnerId, points } };
    } else {
      const points = this.florState.pointsIfRefused;
      this.scores[callerId] = (this.scores[callerId] ?? 0) + points;

      this.florState.state = 'REJECTED';
      this.florState.winnerId = callerId;
      this.florState.pointsAwarded = points;

      this.lastActionText = `${responder?.name} dijo: Con flor me achico. ${caller?.name} suma ${points} pt(s)`;

      if (this.scores[callerId] >= this.targetScore) {
        this.status = 'FINISHED';
        this.winnerId = callerId;
        return { success: true, result: { winnerId: callerId, points } };
      }

      if (this.savedTrucoBet) {
        const savedPreBet = this.savedTrucoBet.savedPreBetTurnIndex;
        this.trucoState = { ...this.savedTrucoBet };
        this.savedTrucoBet = null;
        if (savedPreBet !== undefined) {
          this.preBetTurnIndex = savedPreBet;
        }
        this.currentTurnIndex = this.players.findIndex(
          (p) => p.id === this.trucoState.challengedId
        );
        this.lastActionText += `. Ahora resta responder al ${this.trucoState.currentLevel}!`;
        return { success: true, result: { winnerId: callerId, points } };
      }

      this.currentTurnIndex = this.preBetTurnIndex;
      this.currentPhase = 'TRICK_PLAY';
      return { success: true, result: { winnerId: callerId, points } };
    }
  }

  /**
   * Envido Handlers
   */
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

    // "El Envido está primero": if rival shouted Truco in trick 1, suspend Truco bet!
    if (this.trucoState.state === 'PENDING') {
      this.savedTrucoBet = {
        ...this.trucoState,
        savedPreBetTurnIndex: this.preBetTurnIndex,
      };
      this.trucoState.state = 'AVAILABLE';
    }

    const rival = this.players.find((p) => p.id !== playerId);
    if (!rival) throw new Error('No rival found');

    const history = [...this.envidoState.callHistory, callType];
    const { stake, refused } = this.calculateEnvidoBetPoints(history);

    // Solo el primer canto fija el turno a restaurar: una subida de apuesta la
    // responde el rival, pero el turno pendiente sigue siendo el del cantador
    // original (si no, al resolver la cadena el turno salta al jugador equivocado).
    const isRaise = this.envidoState.state === 'PENDING';
    if (!isRaise) {
      this.preBetTurnIndex = this.currentTurnIndex;
    }
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
    if (this.florState.state === 'PENDING') {
      if (this.florState.challengedId !== playerId) {
        throw new Error('No es tu turno de responder a la Flor');
      }
      if (raise) {
        const formatted = raise.startsWith('CALL_') ? raise.replace('CALL_', '') : raise;
        if (formatted === 'CONTRA_FLOR') return this.handleCallContraFlor(playerId, false);
        if (formatted === 'CONTRA_FLOR_AL_RESTO') return this.handleCallContraFlor(playerId, true);
        throw new Error(`Canto no válido para subir flor: ${raise}`);
      }
      return this.resolveFlorResponse(playerId, accept);
    }

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

      // Check if Truco was suspended by "El Envido está primero"
      if (this.savedTrucoBet) {
        const savedPreBet = this.savedTrucoBet.savedPreBetTurnIndex;
        this.trucoState = { ...this.savedTrucoBet };
        this.savedTrucoBet = null;
        if (savedPreBet !== undefined) {
          this.preBetTurnIndex = savedPreBet;
        }
        this.currentTurnIndex = this.players.findIndex(
          (p) => p.id === this.trucoState.challengedId
        );
        this.lastActionText += `. Ahora resta responder al ${this.trucoState.currentLevel}!`;
        return { success: true, result: { winnerId: envidoWinnerId, points, playerTantos } };
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

      if (this.savedTrucoBet) {
        const savedPreBet = this.savedTrucoBet.savedPreBetTurnIndex;
        this.trucoState = { ...this.savedTrucoBet };
        this.savedTrucoBet = null;
        if (savedPreBet !== undefined) {
          this.preBetTurnIndex = savedPreBet;
        }
        this.currentTurnIndex = this.players.findIndex(
          (p) => p.id === this.trucoState.challengedId
        );
        this.lastActionText += `. Ahora resta responder al ${this.trucoState.currentLevel}!`;
        return { success: true, result: { winnerId: callerId, points } };
      }

      this.currentTurnIndex = this.preBetTurnIndex;
      this.currentPhase = 'TRICK_PLAY';
      return { success: true, result: { winnerId: callerId, points } };
    }
  }

  /**
   * Truco Handlers
   */
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

    // Igual que en Envido: subir Truco no debe pisar el turno que se estaba
    // disputando antes de la cadena de cantos.
    const isRaise = this.trucoState.state === 'PENDING';
    if (!isRaise) {
      this.preBetTurnIndex = this.currentTurnIndex;
    }
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

    if (this.isSubmissionGame) {
      this.executeSubmissionBotTurn(bot);
      return;
    }

    if (!this.isRoundTrickGame) {
      const move = decideBotMove(
        bot.hand,
        this.getTopDiscardCard(),
        this.activeColor,
        this.definition.rules,
        this.pendingDrawCount
      );
      if (move) {
        this.playCard(botId, move.cardId, move.chosenColor);
      } else {
        this.drawCard(botId);
      }
      return;
    }

    // 1. Respond to pending Flor if challenged
    if (this.florState.state === 'PENDING' && this.florState.challengedId === botId) {
      if (checkHasFlor(bot.hand)) {
        this.executeAction(botId, 'CON_FLOR_QUIERO');
      } else {
        this.executeAction(botId, 'CON_FLOR_ME_ACHICO');
      }
      return;
    }

    // 2. Respond to pending Envido if challenged
    if (this.envidoState.state === 'PENDING' && this.envidoState.challengedId === botId) {
      const botTantos = calculateEnvidoPoints(bot.hand);
      if (botTantos >= 26) {
        this.executeAction(botId, 'QUIERO');
      } else {
        this.executeAction(botId, 'NO_QUIERO');
      }
      return;
    }

    // 3. Respond to pending Truco if challenged
    if (this.trucoState.state === 'PENDING' && this.trucoState.challengedId === botId) {
      // Check if bot can and wants to call "El envido está primero"
      if (this.currentTrick === 1 && this.envidoState.state === 'AVAILABLE') {
        const botTantos = calculateEnvidoPoints(bot.hand);
        if (botTantos >= 28) {
          this.executeAction(botId, 'CALL_ENVIDO');
          return;
        }
      }

      const hierarchy = this.definition.rules.cardHierarchy ?? TRUCO_CARD_HIERARCHY;
      const highCards = bot.hand.filter((c) => getCardHierarchyValue(c, hierarchy) >= 9).length;
      if (highCards >= 1 || this.roundTricks.some((t) => t.winnerId === botId)) {
        this.executeAction(botId, 'QUIERO');
      } else {
        this.executeAction(botId, 'NO_QUIERO');
      }
      return;
    }

    // 4. Turn to play or call
    if (this.players[this.currentTurnIndex]?.id !== botId) return;

    // Check if bot has Flor in trick 1
    if (
      this.currentTrick === 1 &&
      (this.florState.state === 'AVAILABLE' || this.florState.state === 'DISABLED') &&
      checkHasFlor(bot.hand)
    ) {
      this.executeAction(botId, 'CALL_FLOR');
      return;
    }

    const hierarchy = this.definition.rules.cardHierarchy ?? TRUCO_CARD_HIERARCHY;

    // Check if bot wants to call Envido in trick 1
    if (
      this.currentTrick === 1 &&
      this.envidoState.state === 'AVAILABLE' &&
      !checkHasFlor(bot.hand)
    ) {
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

  public captureCards(
    playerId: string,
    cardId: string,
    tableCardIds: string[]
  ): { captured: Card[]; escoba: boolean } {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    const handIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
    if (handIndex === -1) {
      throw new Error('Card not found in hand');
    }
    const [handCard] = currentPlayer.hand.splice(handIndex, 1);

    // Validate table cards
    const tableCardsToCapture: Card[] = [];
    for (const tid of tableCardIds) {
      const idx = this.tableCards.findIndex((c) => c.id === tid);
      if (idx === -1) {
        // Revert hand card
        currentPlayer.hand.splice(handIndex, 0, handCard);
        throw new Error(`Table card ${tid} not found on table`);
      }
      tableCardsToCapture.push(this.tableCards[idx]);
    }

    // Validate sum for Escoba
    if (this.definition.slug === 'escoba-del-15') {
      const valid = calculateEscobaValues(handCard, tableCardsToCapture);
      if (!valid) {
        currentPlayer.hand.splice(handIndex, 0, handCard);
        throw new Error('Selected cards do not sum to 15');
      }
    }

    // Remove from table
    for (const tid of tableCardIds) {
      const idx = this.tableCards.findIndex((c) => c.id === tid);
      if (idx !== -1) {
        this.tableCards.splice(idx, 1);
      }
    }

    const captured = [handCard, ...tableCardsToCapture];
    if (!this.capturedCards[playerId]) {
      this.capturedCards[playerId] = [];
    }
    this.capturedCards[playerId].push(...captured);
    this.lastCapturePlayerId = playerId;

    // Check Escoba: table was swept clean
    const isEscoba = this.tableCards.length === 0;
    if (isEscoba) {
      this.escobas[playerId] = (this.escobas[playerId] ?? 0) + 1;
      this.scores[playerId] = (this.scores[playerId] ?? 0) + 1;
      this.customState.lastEscobaBy = playerId;
      this.checkScoreWin(playerId);
    }

    this.advanceTurn(1);
    this.checkDealOrRoundEnd();
    this.syncCommunityState();

    return { captured, escoba: isEscoba };
  }

  public dropCard(playerId: string, cardId: string): { droppedCard: Card } {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    const handIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
    if (handIndex === -1) {
      throw new Error('Card not found in hand');
    }
    const [handCard] = currentPlayer.hand.splice(handIndex, 1);
    this.tableCards.push(handCard);

    this.advanceTurn(1);
    this.checkDealOrRoundEnd();
    this.syncCommunityState();

    return { droppedCard: handCard };
  }

  protected checkDealOrRoundEnd(): void {
    if (this.status !== 'IN_PROGRESS') return;

    const allHandsEmpty = this.players.every((p) => p.hand.length === 0);
    if (!allHandsEmpty) return;

    // Check if more cards in draw pile
    if (this.deckManager.count > 0) {
      const handSize = this.definition.rules.initialHandSize ?? 3;
      for (const player of this.players) {
        player.hand = this.deckManager.drawMultiple(handSize);
      }
      this.customState.dealNumber = Number(this.customState.dealNumber ?? 1) + 1;
      return;
    }

    // Draw pile is empty -> End of Round ("Últimas")!
    this.endCommunityRound();
  }

  protected endCommunityRound(): void {
    // 1. Last captor sweeps remaining table cards
    if (this.tableCards.length > 0) {
      const recipientId =
        this.lastCapturePlayerId ??
        this.players[this.dealerIndex]?.id ??
        this.players[0].id;
      if (!this.capturedCards[recipientId]) {
        this.capturedCards[recipientId] = [];
      }
      this.capturedCards[recipientId].push(...this.tableCards);
      this.customState.lastSweepRecipient = recipientId;
      this.customState.lastSweepCardsCount = this.tableCards.length;
      this.tableCards = [];
    }

    // 2. Score the round
    if (this.definition.slug === 'escoba-del-15') {
      const result = scoreEscobaMatchRound(this.capturedCards, this.escobas);
      this.customState.lastRoundResult = result;

      // Handle auto-loss
      if (result.autoLossPlayerId) {
        const otherPlayer = this.players.find((p) => p.id !== result.autoLossPlayerId);
        this.status = 'FINISHED';
        this.winnerId = otherPlayer?.id ?? null;
        return;
      }

      // Add non-escoba points to scores (escobas were already awarded when made)
      for (const player of this.players) {
        const pScore = result.playerScores[player.id];
        if (pScore) {
          const roundNonEscobaPoints =
            pScore.roundPoints - pScore.pointsBreakdown.escobas;
          this.scores[player.id] =
            (this.scores[player.id] ?? 0) + roundNonEscobaPoints;
        }
      }
    }

    // 3. Check win condition
    const target =
      this.definition.rules.targetScore ??
      this.definition.rules.winCondition.targetScore ??
      15;
    let highestScore = -1;
    let highestPlayerId: string | null = null;
    let someoneReachedTarget = false;

    for (const player of this.players) {
      const s = this.scores[player.id] ?? 0;
      if (s >= target) {
        someoneReachedTarget = true;
      }
      if (s > highestScore) {
        highestScore = s;
        highestPlayerId = player.id;
      }
    }

    if (someoneReachedTarget && highestPlayerId) {
      this.status = 'FINISHED';
      this.winnerId = highestPlayerId;
      return;
    }

    // 4. Start Next Round!
    this.startNextCommunityRound();
  }

  protected startNextCommunityRound(): void {
    this.customState.round = Number(this.customState.round ?? 1) + 1;
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.dealerPlayerId = this.players[this.dealerIndex]?.id ?? null;

    // Reset deck and deal
    this.deckManager.generateFromConfig(this.definition.deckConfig);
    const handSize = this.definition.rules.initialHandSize ?? 3;
    for (const player of this.players) {
      player.hand = this.deckManager.drawMultiple(handSize);
    }
    const tableCount = Number(this.definition.rules.customState?.initialTableCards ?? 4);
    this.tableCards = this.deckManager.drawMultiple(tableCount);

    this.capturedCards = {};
    this.escobas = {};
    for (const player of this.players) {
      this.capturedCards[player.id] = [];
      this.escobas[player.id] = 0;
    }
    this.lastCapturePlayerId = null;

    // Next round starts with player after dealer ('mano')
    this.currentTurnIndex = (this.dealerIndex + 1) % this.players.length;

    if (this.definition.slug === 'escoba-del-15') {
      this.checkEscobaInitialDeal();
    }

    this.syncCommunityState();
  }

  protected syncCommunityState(): void {
    this.customState.tableCards = this.tableCards.map((c) => ({ ...c }));
    this.customState.escobas = { ...this.escobas };
    const counts: Record<string, number> = {};
    for (const pid of Object.keys(this.capturedCards)) {
      counts[pid] = this.capturedCards[pid].length;
    }
    this.customState.capturedCounts = counts;
    this.customState.dealerPlayerId = this.dealerPlayerId;
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

      case 'REVEAL_CARD': {
        const revealed = this.deckManager.draw();
        if (!revealed) return null;
        this.discardPile.push(revealed);
        if (revealed.color && revealed.color !== 'ANY') {
          this.activeColor = revealed.color;
        }
        return revealed;
      }

      case 'END_GAME': {
        const winner = String(params.winner ?? payload.winner ?? 'NONE').toUpperCase();
        this.status = 'FINISHED';
        this.winnerId = winner === 'ACTOR' ? actorId : null;
        return { winnerId: this.winnerId };
      }

      case 'SCORE_ENVIDO': {
        const callerId = this.envidoState.callerId;
        const challengedId = this.envidoState.challengedId;
        if (!callerId || !challengedId) return null;
        return this.resolveEnvidoResponse(challengedId, true);
      }

      case 'SCORE_FLOR': {
        const challengedId = this.florState.challengedId;
        if (!challengedId) return null;
        return this.resolveFlorResponse(challengedId, true);
      }

      case 'RESOLVE_BET': {
        const accept = Boolean(params.accept ?? payload.accept ?? true);
        const challengedId =
          this.florState.challengedId ??
          this.envidoState.challengedId ??
          this.trucoState.challengedId;
        if (!challengedId) return null;
        return this.handleRespondBet(challengedId, accept);
      }

      case 'DEAL_COMMUNITY': {
        const count = Number(params.count ?? payload.count ?? 4);
        const drawn = this.deckManager.drawMultiple(count);
        this.tableCards.push(...drawn);
        this.syncCommunityState();
        return drawn;
      }

      case 'DROP_TO_TABLE': {
        const cardId = String(params.cardId ?? payload.cardId ?? '');
        if (actorId && cardId) {
          return this.dropCard(actorId, cardId);
        }
        return null;
      }

      case 'CAPTURE_CARDS': {
        const cardId = String(params.cardId ?? payload.cardId ?? '');
        const tableCardIds = Array.isArray(payload.tableCardIds)
          ? payload.tableCardIds.map(String)
          : [];
        if (actorId && cardId) {
          return this.captureCards(actorId, cardId, tableCardIds);
        }
        return null;
      }

      case 'EVALUATE_ROUND_SCORING': {
        this.endCommunityRound();
        return this.customState.lastRoundResult;
      }

      case 'OPEN_SUBMISSIONS': {
        const round = this.submissionRound;
        const config = this.submissionConfig;
        if (!round || !config) return null;

        const expected = this.players
          .filter((player) => !config.excludeJudge || player.id !== round.judgeId)
          .map((player) => player.id);
        round.phase = 'COLLECTING';
        round.expectedSubmitters = expected;
        round.submittedPlayerIds = [];
        round.submissions = [];
        round.winnerSubmissionId = null;
        round.winnerPlayerId = null;

        if (expected.length === 0 && this.phases?.length) {
          this.changePhase();
        }
        return expected;
      }

      case 'AWARD_SUBMISSION': {
        const round = this.submissionRound;
        if (!round?.winnerPlayerId) return null;

        const amount = Math.max(1, this.submissionConfig?.pointsPerWin ?? 1);
        this.scores[round.winnerPlayerId] = (this.scores[round.winnerPlayerId] ?? 0) + amount;
        round.phase = 'RESOLVED';

        const winner = this.players.find((p) => p.id === round.winnerPlayerId);
        this.lastActionText = `${winner?.name ?? 'Jugador'} se llevó la ronda (+${amount})`;
        this.checkScoreWin(round.winnerPlayerId);
        return { playerId: round.winnerPlayerId, amount };
      }

      case 'REFILL_HANDS': {
        if (this.status !== 'IN_PROGRESS') return null;

        const target = this.definition.rules.initialHandSize ?? 10;
        for (const player of this.players) {
          while (player.hand.length < target) {
            if (this.deckManager.count === 0) {
              if (this.answerDiscard.length === 0) break;
              this.deckManager.returnCards(this.answerDiscard);
              this.answerDiscard = [];
            }
            const card = this.deckManager.draw();
            if (!card) break;
            player.hand.push(card);
          }
        }
        return target;
      }

      case 'DRAW_PROMPT': {
        const round = this.submissionRound;
        const config = this.submissionConfig;
        if (!round || !config || this.status !== 'IN_PROGRESS') return null;

        if (round.promptCard) {
          this.promptDiscard.push(round.promptCard);
        }
        if (this.promptPile.length === 0 && this.promptDiscard.length > 0) {
          this.promptPile.push(...this.promptDiscard);
          this.promptDiscard = [];
        }

        const prompt = this.promptPile.pop();
        if (!prompt) {
          this.status = 'FINISHED';
          this.winnerId = this.getLeadingPlayerId();
          return null;
        }

        const judgeId = this.players[this.currentTurnIndex]?.id ?? this.players[0]?.id ?? '';
        this.submissionRound = {
          phase: 'PREPARE',
          judgeId,
          promptCard: prompt,
          requiredPicks: config.picksFromPrompt
            ? Math.max(1, Number(prompt.metadata?.picks ?? config.defaultPicks))
            : Math.max(1, config.defaultPicks),
          expectedSubmitters: [],
          submittedPlayerIds: [],
          submissions: [],
          winnerSubmissionId: null,
          winnerPlayerId: null,
        };
        this.lastActionText = `${this.players.find((p) => p.id === judgeId)?.name ?? 'El juez'} lee la consigna`;
        return prompt.id;
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
      if (
        actionType === 'QUIERO' ||
        actionType === 'NO_QUIERO' ||
        actionType === 'CON_FLOR_QUIERO' ||
        actionType === 'CON_FLOR_ME_ACHICO'
      ) {
        if (
          phase.allowedActions.includes('RESPOND_BET') ||
          phase.allowedActions.includes(actionType)
        ) {
          return null;
        }
      }
      if (actionType === 'PLAY_CARD') {
        if (
          this.florState.state === 'PENDING' ||
          this.envidoState.state === 'PENDING' ||
          this.trucoState.state === 'PENDING'
        ) {
          return 'Hay una apuesta pendiente que debe ser respondida primero';
        }
        return null;
      }
      if (
        actionType === 'CALL_TRUCO' ||
        actionType === 'CALL_RETRUCO' ||
        actionType === 'CALL_VALE_CUATRO'
      ) {
        if (this.florState.state === 'PENDING' || this.envidoState.state === 'PENDING') {
          return 'Hay un envite pendiente que debe resolverse primero';
        }
        return null;
      }
      if (actionType === 'EL_ENVIDO_ESTA_PRIMERO') {
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
      case 'CAPTURE_CARDS': {
        const cardId = String(payload.cardId ?? '');
        const tableCardIds = Array.isArray(payload.tableCardIds)
          ? payload.tableCardIds.map(String)
          : [];
        return this.captureCards(playerId, cardId, tableCardIds);
      }

      case 'DROP_CARD': {
        const cardId = String(payload.cardId ?? '');
        return this.dropCard(playerId, cardId);
      }

      case 'PLAY_CARD': {
        const cardId = String(payload.cardId ?? '');
        const tableCardIds = Array.isArray(payload.tableCardIds)
          ? payload.tableCardIds.map(String)
          : [];
        if (tableCardIds.length > 0) {
          return this.captureCards(playerId, cardId, tableCardIds);
        }
        if (this.isCommunityGame()) {
          return this.dropCard(playerId, cardId);
        }
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

      case 'CALL_FLOR':
        return this.handleCallFlor(playerId);

      case 'CALL_CONTRA_FLOR':
        return this.handleCallContraFlor(playerId, false);

      case 'CALL_CONTRA_FLOR_AL_RESTO':
        return this.handleCallContraFlor(playerId, true);

      case 'CON_FLOR_QUIERO':
        return this.resolveFlorResponse(playerId, true);

      case 'CON_FLOR_ME_ACHICO':
        return this.resolveFlorResponse(playerId, false);

      case 'CALL_ENVIDO':
      case 'EL_ENVIDO_ESTA_PRIMERO':
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
          this.florState.state === 'PENDING' ||
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
        if (this.florState.state === 'PENDING') {
          return this.resolveFlorResponse(playerId, true);
        }
        return this.handleRespondBet(playerId, true);

      case 'NO_QUIERO':
        if (this.florState.state === 'PENDING') {
          return this.resolveFlorResponse(playerId, false);
        }
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

      case 'SUBMIT_CARDS': {
        const round = this.submissionRound;
        if (!round || round.phase !== 'COLLECTING') {
          throw new Error('No hay una ronda de respuestas abierta');
        }
        if (!round.expectedSubmitters.includes(playerId)) {
          throw new Error('No te corresponde enviar respuestas en esta ronda');
        }
        if (round.submittedPlayerIds.includes(playerId)) {
          throw new Error('Ya enviaste tus respuestas');
        }

        const player = this.players.find((p) => p.id === playerId);
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.map(String) : [];
        if (!player || cardIds.length !== round.requiredPicks) {
          throw new Error(`Debés enviar ${round.requiredPicks} carta(s)`);
        }
        if (new Set(cardIds).size !== cardIds.length) {
          throw new Error('No podés repetir la misma carta');
        }

        const cards: Card[] = [];
        for (const cardId of cardIds) {
          const index = player.hand.findIndex((card) => card.id === cardId);
          if (index === -1) throw new Error('Carta no encontrada en tu mano');
          cards.push(player.hand.splice(index, 1)[0]);
        }

        this.answerDiscard.push(...cards);
        round.submissions.push({
          id: `sub_${round.submissions.length + 1}_${randomInt(1_000_000)}`,
          cards,
          playerId,
        });
        round.submittedPlayerIds.push(playerId);
        this.lastActionText = `${player.name} envió su respuesta`;

        const allReceived = round.expectedSubmitters.every((id) =>
          round.submittedPlayerIds.includes(id)
        );
        if (allReceived) {
          this.shuffleSubmissions();
          round.phase = 'JUDGING';
          if (this.phases?.length) this.changePhase();
        }
        return { submitted: cards.length };
      }

      case 'PICK_SUBMISSION': {
        const round = this.submissionRound;
        if (!round || round.phase !== 'JUDGING') {
          throw new Error('No hay respuestas para juzgar');
        }
        const submissionId = String(payload.submissionId ?? '');
        const chosen = round.submissions.find((entry) => entry.id === submissionId);
        if (!chosen) throw new Error('Respuesta no encontrada');

        round.winnerSubmissionId = chosen.id;
        round.winnerPlayerId = chosen.playerId;
        const winner = this.players.find((p) => p.id === chosen.playerId);
        this.lastActionText = `El juez eligió la respuesta de ${winner?.name ?? 'un jugador'}`;

        if (!this.phases || this.phases.length === 0) {
          this.applyEffect({ type: 'AWARD_SUBMISSION' }, null, {});
          if (this.status === 'IN_PROGRESS') {
            this.applyEffects(
              [
                { type: 'REFILL_HANDS' },
                { type: 'ADVANCE_TURN', params: { step: 1 } },
                { type: 'RESET_ROUND' },
                { type: 'DRAW_PROMPT' },
                { type: 'OPEN_SUBMISSIONS' },
              ],
              null
            );
          }
        }

        return { submissionId: chosen.id, playerId: chosen.playerId };
      }

      case 'EXCHANGE_CARDS': {
        const config = this.submissionConfig;
        if (!config?.judgeExchange) {
          throw new Error('El recambio de cartas no está habilitado');
        }
        if (this.submissionRound?.judgeId !== playerId) {
          throw new Error('Solo el juez puede recambiar cartas');
        }

        const player = this.players.find((p) => p.id === playerId);
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.map(String) : [];
        if (!player || cardIds.length === 0) {
          throw new Error('Elegí al menos una carta para recambiar');
        }
        if (new Set(cardIds).size !== cardIds.length) {
          throw new Error('No podés repetir la misma carta');
        }

        const discarded: Card[] = [];
        for (const cardId of cardIds) {
          const index = player.hand.findIndex((card) => card.id === cardId);
          if (index === -1) throw new Error('Carta no encontrada en tu mano');
          discarded.push(player.hand.splice(index, 1)[0]);
        }

        let drawn = 0;
        while (drawn < discarded.length) {
          if (this.deckManager.count === 0) {
            if (this.answerDiscard.length === 0) break;
            this.deckManager.returnCards(this.answerDiscard);
            this.answerDiscard = [];
          }
          const card = this.deckManager.draw();
          if (!card) break;
          player.hand.push(card);
          drawn += 1;
        }

        this.answerDiscard.push(...discarded);
        this.lastActionText = `${player.name} recambió ${drawn} carta(s)`;
        return { exchanged: drawn };
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

      case 'HAS_DRAW_PILE_CARDS':
        return this.deckManager.count > 0;

      case 'EVALUATE_CARD_HIERARCHY': {
        const hierarchy = this.definition.rules.cardHierarchy;
        if (!hierarchy) return false;
        const player = this.players.find((p) => p.id === playerId);
        const card = player?.hand.find((c) => c.id === String(payload.cardId ?? ''));
        return !!card && card.value !== undefined && String(card.value) in hierarchy;
      }

      case 'CAN_CALL_FLOR': {
        const player = this.players.find((p) => p.id === playerId);
        return (
          this.currentTrick === 1 &&
          Boolean(player && checkHasFlor(player.hand)) &&
          (this.florState.state === 'AVAILABLE' || this.florState.state === 'DISABLED')
        );
      }

      case 'CAN_CALL_CONTRA_FLOR':
        return (
          this.florState.state === 'PENDING' &&
          this.florState.challengedId === playerId
        );

      case 'CAN_CALL_ENVIDO':
        return (
          this.currentTrick === 1 &&
          this.florState.state !== 'PENDING' &&
          this.florState.state !== 'RESOLVED' &&
          (this.envidoState.state === 'AVAILABLE' ||
            (this.envidoState.state === 'PENDING' &&
              this.envidoState.challengedId === playerId))
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
          this.florState.state === 'PENDING' ||
          this.envidoState.state === 'PENDING' ||
          this.trucoState.state === 'PENDING' ||
          this.customState.betPending === true
        );

      case 'VALID_CAPTURE':
      case 'SUM_TARGET': {
        const cardId = String(payload.cardId ?? '');
        const tableCardIds = Array.isArray(payload.tableCardIds)
          ? payload.tableCardIds.map(String)
          : [];
        const player = this.players.find((p) => p.id === playerId);
        const handCard = player?.hand.find((c) => c.id === cardId);
        if (!handCard || tableCardIds.length === 0) return false;
        const tableCards = this.tableCards.filter((c) => tableCardIds.includes(c.id));
        if (tableCards.length !== tableCardIds.length) return false;
        return calculateEscobaValues(handCard, tableCards);
      }

      case 'IS_JUDGE':
        return this.submissionRound?.judgeId === playerId;

      case 'CAN_SUBMIT': {
        const round = this.submissionRound;
        return Boolean(
          round &&
            round.phase === 'COLLECTING' &&
            round.expectedSubmitters.includes(playerId) &&
            !round.submittedPlayerIds.includes(playerId)
        );
      }

      case 'ALL_SUBMISSIONS_RECEIVED': {
        const round = this.submissionRound;
        return Boolean(
          round &&
            round.expectedSubmitters.length > 0 &&
            round.expectedSubmitters.every((id) => round.submittedPlayerIds.includes(id))
        );
      }

      case 'CAN_PICK_SUBMISSION':
        return Boolean(
          this.submissionRound?.phase === 'JUDGING' &&
            this.submissionRound.judgeId === playerId
        );

      default:
        return true;
    }
  }

  private getLeadingPlayerId(): string | null {
    let leaderId: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const player of this.players) {
      const score = this.scores[player.id] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        leaderId = player.id;
      }
    }
    return leaderId;
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