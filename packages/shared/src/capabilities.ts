export type ZoneType =
  | 'HAND'
  | 'DRAW_PILE'
  | 'DISCARD_PILE'
  | 'TRICK_TABLE'
  | 'COMMUNITY'
  | 'REVEALED';

export type ZoneVisibility = 'PRIVATE_OWNER' | 'PUBLIC' | 'HIDDEN';

export interface ZoneDefinition {
  id: string;
  name: string;
  type: ZoneType;
  visibility: ZoneVisibility;
  perPlayer?: boolean;
  maxCards?: number;
}

export type ConditionType =
  | 'MATCH_TOP_CARD'
  | 'IS_ACTIVE_PLAYER'
  | 'HAS_MIN_CARDS'
  | 'EVALUATE_CARD_HIERARCHY'
  | 'IS_BET_PENDING'
  | 'STATE_EQUALS'
  | 'CAN_CALL_ENVIDO'
  | 'CAN_CALL_TRUCO'
  | 'SUM_TARGET'
  | 'VALID_CAPTURE'
  | 'CUSTOM';

export interface ConditionDefinition {
  type: ConditionType;
  params?: Record<string, unknown>;
}

export type EffectType =
  | 'SKIP'
  | 'REVERSE'
  | 'DRAW_CARDS'
  | 'CHOOSE_COLOR'
  | 'SWAP_HANDS'
  | 'DISCARD_ALL_COLOR'
  | 'MOVE_CARD'
  | 'DEAL_CARDS'
  | 'ADVANCE_TURN'
  | 'SET_ACTIVE_COLOR'
  | 'SET_STATE_VAR'
  | 'RESOLVE_TRICK'
  | 'SCORE_ENVIDO'
  | 'RESOLVE_BET'
  | 'AWARD_POINTS'
  | 'CHANGE_PHASE'
  | 'RESET_ROUND'
  | 'PROMPT_CHOICE'
  | 'CAPTURE_CARDS'
  | 'DROP_TO_TABLE'
  | 'DEAL_COMMUNITY'
  | 'EVALUATE_ROUND_SCORING';

export interface EffectDefinition {
  type: EffectType;
  params?: Record<string, unknown>;
}

export type StandardActionId =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'CHOOSE_COLOR'
  | 'PASS_TURN'
  | 'CALL_BET'
  | 'RESPOND_BET'
  | 'FOLD'
  | 'CALL_ENVIDO'
  | 'CALL_REAL_ENVIDO'
  | 'CALL_FALTA_ENVIDO'
  | 'CALL_TRUCO'
  | 'CALL_RETRUCO'
  | 'CALL_VALE_CUATRO'
  | 'QUIERO'
  | 'NO_QUIERO';

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  phase?: string;
  requiredConditions?: ConditionDefinition[];
  effects?: EffectDefinition[];
  payloadSchema?: Record<string, unknown>;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  allowedActions: string[];
  onEnter?: EffectDefinition[];
  onExit?: EffectDefinition[];
  nextPhase?: string;
}

export interface WinConditionDefinition {
  type: 'EMPTY_HAND' | 'SCORE_THRESHOLD' | 'LAST_REMAINING';
  targetScore?: number;
}

export interface DeckPresetSummary {
  id: string;
  name: string;
  description: string;
  totalCards: number;
}

export interface CapabilityManifest {
  actions: ActionDefinition[];
  conditions: Array<{ type: ConditionType; description: string }>;
  effects: Array<{ type: EffectType; description: string }>;
  zones: ZoneDefinition[];
  deckPresets: DeckPresetSummary[];
}