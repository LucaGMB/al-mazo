import type {
  ActionDefinition,
  CapabilityManifest,
  ConditionType,
  EffectType,
  ZoneDefinition,
} from '../types.js';
import { getDeckPresetsSummary } from './deck-presets.js';

export const BUILTIN_ACTIONS: ActionDefinition[] = [
  {
    id: 'PLAY_CARD',
    name: 'Play Card',
    description: 'Play a card from the active player hand onto the table.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'MATCH_TOP_CARD' }],
    payloadSchema: { cardId: 'string', chosenColor: 'string?' },
  },
  {
    id: 'DRAW_CARD',
    name: 'Draw Card',
    description: 'Draw a card from the draw pile.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
  },
  {
    id: 'CHOOSE_COLOR',
    name: 'Choose Color',
    description: 'Resolve a pending color choice after playing a wild card.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    payloadSchema: { color: 'string' },
  },
  {
    id: 'PASS_TURN',
    name: 'Pass Turn',
    description: 'End the current turn after drawing.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    effects: [{ type: 'CHANGE_PHASE' }],
  },
  {
    id: 'CALL_BET',
    name: 'Call Bet',
    description: 'Place a bet while the game is in a betting phase.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    payloadSchema: { amount: 'number?' },
    effects: [{ type: 'CHANGE_PHASE' }],
  },
  {
    id: 'RESPOND_BET',
    name: 'Respond To Bet',
    description: 'Accept or raise a pending bet.',
    requiredConditions: [{ type: 'IS_BET_PENDING' }],
    payloadSchema: { accept: 'boolean?', raise: 'number?' },
    effects: [{ type: 'CHANGE_PHASE' }],
  },
  {
    id: 'FOLD',
    name: 'Fold',
    description: 'Forfeit the current hand or round.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    effects: [{ type: 'CHANGE_PHASE' }],
  },
  {
    id: 'CALL_ENVIDO',
    name: 'Cantar Envido',
    description: 'Apostar 2 tantos sobre los puntos de envido de la mano.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_ENVIDO' }],
    payloadSchema: { level: 'string?' },
  },
  {
    id: 'CALL_REAL_ENVIDO',
    name: 'Cantar Real Envido',
    description: 'Apostar 3 tantos sobre los puntos de envido de la mano.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_ENVIDO' }],
  },
  {
    id: 'CALL_FALTA_ENVIDO',
    name: 'Cantar Falta Envido',
    description: 'Apostar los puntos restantes para ganar la ronda o chico.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_ENVIDO' }],
  },
  {
    id: 'CALL_TRUCO',
    name: 'Cantar Truco',
    description: 'Apostar 2 puntos sobre la disputa de las bazas.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_TRUCO' }],
  },
  {
    id: 'CALL_RETRUCO',
    name: 'Cantar Retruco',
    description: 'Subir la apuesta de truco a 3 puntos.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_TRUCO' }],
  },
  {
    id: 'CALL_VALE_CUATRO',
    name: 'Cantar Vale Cuatro',
    description: 'Subir la apuesta de truco a 4 puntos.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }, { type: 'CAN_CALL_TRUCO' }],
  },
  {
    id: 'QUIERO',
    name: 'Quiero',
    description: 'Aceptar la apuesta o envite en curso.',
    requiredConditions: [{ type: 'IS_BET_PENDING' }],
  },
  {
    id: 'NO_QUIERO',
    name: 'No Quiero',
    description: 'Rechazar la apuesta o envite en curso.',
    requiredConditions: [{ type: 'IS_BET_PENDING' }],
  },
];

export const BUILTIN_CONDITIONS: Array<{ type: ConditionType; description: string }> = [
  { type: 'IS_ACTIVE_PLAYER', description: 'The acting player owns the current turn.' },
  { type: 'MATCH_TOP_CARD', description: 'The played card matches the top card by color or value.' },
  { type: 'HAS_MIN_CARDS', description: 'The acting player holds at least a minimum number of cards.' },
  {
    type: 'EVALUATE_CARD_HIERARCHY',
    description: 'Compares card strength using the definition card hierarchy.',
  },
  { type: 'IS_BET_PENDING', description: 'A bet is awaiting a response.' },
  { type: 'CAN_CALL_ENVIDO', description: 'Envido can only be called in trick 1 while available.' },
  { type: 'CAN_CALL_TRUCO', description: 'Truco can only be called or raised by the player with turn or privilege.' },
];

export const BUILTIN_EFFECTS: Array<{ type: EffectType; description: string }> = [
  { type: 'MOVE_CARD', description: 'Move a card between zones.' },
  { type: 'DEAL_CARDS', description: 'Deal cards from the draw pile.' },
  { type: 'ADVANCE_TURN', description: 'Advance the active turn by a number of steps.' },
  { type: 'SET_ACTIVE_COLOR', description: 'Override the active matching color.' },
  { type: 'RESOLVE_TRICK', description: 'Score the cards currently on the trick table and determine trick winner or parda.' },
  { type: 'SCORE_ENVIDO', description: 'Calculates envido points and awards them to the highest hand or mano on tie.' },
  { type: 'RESOLVE_BET', description: 'Resolves an accepted or rejected bet and updates current stakes.' },
  { type: 'AWARD_POINTS', description: 'Add points to a player score.' },
  { type: 'CHANGE_PHASE', description: 'Transition to another game phase.' },
  { type: 'RESET_ROUND', description: 'Clear round state and continue playing.' },
];

export const BUILTIN_ZONES: ZoneDefinition[] = [
  { id: 'hand', name: 'Hand', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
  { id: 'draw_pile', name: 'Draw Pile', type: 'DRAW_PILE', visibility: 'HIDDEN' },
  { id: 'discard_pile', name: 'Discard Pile', type: 'DISCARD_PILE', visibility: 'PUBLIC' },
  { id: 'trick_table', name: 'Trick Table', type: 'TRICK_TABLE', visibility: 'PUBLIC' },
  { id: 'community', name: 'Community', type: 'COMMUNITY', visibility: 'PUBLIC' },
  { id: 'revealed', name: 'Revealed', type: 'REVEALED', visibility: 'PUBLIC' },
];

export function getBuiltinAction(actionId: string): ActionDefinition | undefined {
  return BUILTIN_ACTIONS.find((action) => action.id === actionId);
}

export function getCapabilitiesManifest(): CapabilityManifest {
  return {
    actions: BUILTIN_ACTIONS.map((action) => ({ ...action })),
    conditions: BUILTIN_CONDITIONS.map((condition) => ({ ...condition })),
    effects: BUILTIN_EFFECTS.map((effect) => ({ ...effect })),
    zones: BUILTIN_ZONES.map((zone) => ({ ...zone })),
    deckPresets: getDeckPresetsSummary(),
  };
}