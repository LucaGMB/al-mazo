import { Card, CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12'];

function generateSpanishDeckTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value });
    }
  }

  return templates;
}

export const TRUCO_CARD_HIERARCHY: Record<string, number> = {
  '1 ESPADAS': 14,
  '1 BASTOS': 13,
  '7 ESPADAS': 12,
  '7 OROS': 11,
  '3': 10,
  '2': 9,
  '1 OROS': 8,
  '1 COPAS': 8,
  '12': 7,
  '11': 6,
  '10': 5,
  '7 BASTOS': 4,
  '7 COPAS': 4,
  '6': 3,
  '5': 2,
  '4': 1,
};

export function getCardHierarchyValue(card: Card): number {
  const suitKey = `${card.value} ${card.color}`;
  return TRUCO_CARD_HIERARCHY[suitKey] ?? TRUCO_CARD_HIERARCHY[String(card.value)] ?? 0;
}

function envidoCardValue(card: Card): number {
  const numeric = Number(card.value);
  if (!Number.isFinite(numeric) || numeric >= 10) return 0;
  return numeric;
}

export function calculateEnvidoPoints(cards: Card[]): number {
  let best = 0;

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].color && cards[i].color === cards[j].color) {
        const sum = envidoCardValue(cards[i]) + envidoCardValue(cards[j]);
        best = Math.max(best, (sum % 10) + 20);
      }
    }
  }

  if (best === 0) {
    best = cards.reduce((max, card) => Math.max(max, envidoCardValue(card)), 0);
  }

  return best;
}

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