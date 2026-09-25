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
    id: 'EL_ENVIDO_ESTA_PRIMERO',
    name: 'El Envido está primero',
    description: 'Cantar envido en respuesta a un truco cantado en primera mano.',
    requiredConditions: [{ type: 'CAN_CALL_ENVIDO' }],
  },
  {
    id: 'CALL_FLOR',
    name: 'Cantar Flor',
    description: 'Declarar tener 3 cartas del mismo palo (3 puntos o desafío).',
    requiredConditions: [{ type: 'CAN_CALL_FLOR' }],
  },
  {
    id: 'CALL_CONTRA_FLOR',
    name: 'Cantar Contraflor',
    description: 'Redoblar el desafío de flor a 6 puntos.',
    requiredConditions: [{ type: 'CAN_CALL_CONTRA_FLOR' }],
  },
  {
    id: 'CALL_CONTRA_FLOR_AL_RESTO',
    name: 'Contraflor al Resto',
    description: 'Desafiar la flor por los puntos restantes para ganar el chico.',
    requiredConditions: [{ type: 'CAN_CALL_CONTRA_FLOR' }],
  },
  {
    id: 'CON_FLOR_QUIERO',
    name: 'Con Flor Quiero',
    description: 'Aceptar el envite de flor rival (4 o 6 puntos al ganador).',
    requiredConditions: [{ type: 'IS_BET_PENDING' }],
  },
  {
    id: 'CON_FLOR_ME_ACHICO',
    name: 'Con Flor Me Achico',
    description: 'Rechazar el envite de flor rival otorgando los puntos de rechazo.',
    requiredConditions: [{ type: 'IS_BET_PENDING' }],
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
  {
    id: 'CAPTURE_CARDS',
    name: 'Capture Cards',
    description: 'Play a card from hand to capture matching cards from the community table.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    payloadSchema: { cardId: 'string', tableCardIds: 'string[]' },
  },
  {
    id: 'DROP_CARD',
    name: 'Drop Card To Table',
    description: 'Place a card from hand onto the community table without capturing.',
    requiredConditions: [{ type: 'IS_ACTIVE_PLAYER' }],
    payloadSchema: { cardId: 'string' },
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
  {
    type: 'SUM_TARGET',
    description: 'The sum of played and selected table cards matches the required target.',
  },
  {
    type: 'VALID_CAPTURE',
    description: 'The selected cards form a valid capture combination.',
  },
];

export const BUILTIN_EFFECTS: Array<{ type: EffectType; description: string }> = [
  { type: 'SKIP', description: 'Skip the next player in the turn order.' },
  { type: 'REVERSE', description: 'Reverse the direction of play.' },
  { type: 'DRAW_CARDS', description: 'Make the target player draw one or more cards.' },
  { type: 'CHOOSE_COLOR', description: 'Ask the acting player to choose a new active color.' },
  { type: 'SWAP_HANDS', description: 'Swap the acting player hand with the next player hand.' },
  {
    type: 'DISCARD_ALL_COLOR',
    description: 'Discard every card of a given color from the acting player hand.',
  },
  { type: 'PROMPT_CHOICE', description: 'Pause the turn until the player answers a choice prompt.' },
  { type: 'MOVE_CARD', description: 'Move a card between zones.' },
  { type: 'DEAL_CARDS', description: 'Deal cards from the draw pile.' },
  { type: 'ADVANCE_TURN', description: 'Advance the active turn by a number of steps.' },
  { type: 'SET_ACTIVE_COLOR', description: 'Override the active matching color.' },
  { type: 'RESOLVE_TRICK', description: 'Score the cards currently on the trick table and determine trick winner or parda.' },
  { type: 'SCORE_ENVIDO', description: 'Calculates envido points and awards them to the highest hand or mano on tie.' },
  { type: 'SCORE_FLOR', description: 'Calculates flor points and awards them to the highest hand or mano on tie.' },
  { type: 'RESOLVE_BET', description: 'Resolves an accepted or rejected bet and updates current stakes.' },
  { type: 'AWARD_POINTS', description: 'Add points to a player score.' },
  { type: 'CHANGE_PHASE', description: 'Transition to another game phase.' },
  { type: 'RESET_ROUND', description: 'Clear round state and continue playing.' },
  { type: 'CAPTURE_CARDS', description: 'Transfer played and captured cards to player trick/capture pile.' },
  { type: 'DROP_TO_TABLE', description: 'Move card from player hand to community table.' },
  { type: 'DEAL_COMMUNITY', description: 'Deal cards to the community zone.' },
  { type: 'EVALUATE_ROUND_SCORING', description: 'Calculate round scores based on captured cards and majorities.' },
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