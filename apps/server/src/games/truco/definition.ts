import { GameSchemaDefinition } from '../../engine/types.js';
import {
  TRUCO_CARD_HIERARCHY,
  getCardHierarchyValue,
  calculateEnvidoPoints,
  calculateEnvidoScore,
  calculateFaltaEnvidoPoints,
  resolveTrickWinner,
  resolveRoundWinner,
  generateSpanishDeckTemplates,
  envidoCardValue,
} from '@al-mazo/shared';

export {
  TRUCO_CARD_HIERARCHY,
  getCardHierarchyValue,
  calculateEnvidoPoints,
  calculateEnvidoScore,
  calculateFaltaEnvidoPoints,
  resolveTrickWinner,
  resolveRoundWinner,
  generateSpanishDeckTemplates,
  envidoCardValue,
};

export const trucoDefinition: GameSchemaDefinition = {
  slug: 'truco',
  title: 'Truco Argentino',
  description:
    'Juego tradicional de cartas español con bazas, envido, flor y truco. Se juega a 15 o 30 puntos.',
  deckConfig: {
    templates: generateSpanishDeckTemplates(),
  },
  rules: {
    initialHandSize: 3,
    minPlayers: 2,
    maxPlayers: 2,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    effects: {},
    cardHierarchy: TRUCO_CARD_HIERARCHY,
    winCondition: {
      type: 'SCORE_THRESHOLD',
      targetScore: 30,
    },
    targetScore: 30,
    phases: [
      {
        id: 'ENVIDO_PHASE',
        name: 'Canto de Envido',
        allowedActions: [
          'CALL_ENVIDO',
          'CALL_REAL_ENVIDO',
          'CALL_FALTA_ENVIDO',
          'RESPOND_BET',
          'FOLD',
        ],
      },
      {
        id: 'TRICK_PLAY',
        name: 'Juego de Bazas',
        allowedActions: [
          'PLAY_CARD',
          'CALL_TRUCO',
          'CALL_RETRUCO',
          'CALL_VALE_CUATRO',
          'RESPOND_BET',
          'FOLD',
        ],
      },
      {
        id: 'ROUND_SCORING',
        name: 'Puntaje de Ronda',
        allowedActions: [],
      },
    ],
  },
};