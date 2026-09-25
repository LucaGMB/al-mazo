import type {
  Card,
  ConditionDefinition,
  EffectDefinition,
  GameSchemaDefinition,
  PhaseDefinition,
  PublicGameState,
} from './types.js';
import { GameEngine } from './state-machine.js';
import { getBuiltinAction } from './capabilities/registry.js';
import { validateCardPlay } from './validator.js';

export interface ActionResult {
  success: boolean;
  result?: unknown;
}

export class ModularGameEngine extends GameEngine {
  protected currentPhase: string | null = null;
  protected customState: Record<string, unknown> = {};
  protected scores: Record<string, number> = {};
  protected trickCards: Array<{ playerId: string; card: Card }> = [];
  protected activeBets: Record<string, unknown> = {};

  constructor(definition: GameSchemaDefinition) {
    super(definition);
  }

  private get phases(): PhaseDefinition[] | undefined {
    return this.definition.rules.phases;
  }

  public override start(): void {
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

  public getStatus(): 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' {
    return this.status;
  }

  public getWinnerId(): string | null {
    return this.winnerId;
  }

  public override getPublicState(): PublicGameState {
    return {
      ...super.getPublicState(),
      currentPhase: this.currentPhase,
      scores: { ...this.scores },
      customState: { ...this.customState },
      trickCards: this.trickCards.map((entry) => ({ ...entry, card: { ...entry.card } })),
      activeBets: { ...this.activeBets },
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

      default:
        return null;
    }
  }

  protected resolveTrick(): { winnerId: string; points: number } | null {
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
        const player = this.players.find((p) => p.id === playerId);
        const card = player?.hand.find((c) => c.id === cardId);
        this.playCard(playerId, cardId, chosenColor);
        // ponytail: hierarchy presence marks a trick game; add an explicit rule flag if games need both
        if (card && this.definition.rules.cardHierarchy) {
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

      case 'RESPOND_BET': {
        this.setCustomState('betPending', false);
        const response = { playerId, ...payload };
        this.activeBets[`response_${playerId}`] = response;
        return response;
      }

      case 'FOLD': {
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
        return validateCardPlay(card, this.getTopDiscardCard(), this.activeColor, this.definition.rules)
          .isValid;
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

      case 'IS_BET_PENDING':
        return this.customState.betPending === true;

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