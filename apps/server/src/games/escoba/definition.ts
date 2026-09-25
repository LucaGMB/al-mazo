import { Card, CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12'];

// Capture value of each card: 1-7 face value, Sota=8, Caballo=9, Rey=10
const ESCOBA_VALUES: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '10': 8,
  '11': 9,
  '12': 10,
};

function generateSpanishDeckTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value });
    }
  }

  return templates;
}

export function calculateEscobaValues(handCard: Card, tableCards: Card[]): boolean {
  const total = [handCard, ...tableCards].reduce(
    (sum, card) => sum + (ESCOBA_VALUES[String(card.value)] ?? 0),
    0
  );
  return total === 15;
}

export function scoreRound(capturedCards: Card[], escobasCount: number): Record<string, number> {
  const sevens = capturedCards.filter((card) => card.value === '7');
  const sieteDeVelo = sevens.some((card) => card.color === 'OROS') ? 1 : 0;

  return {
    cards: capturedCards.length,
    oros: capturedCards.filter((card) => card.color === 'OROS').length,
    sevens: sevens.length,
    sieteDeVelo,
    escobas: escobasCount,
    total: sieteDeVelo + escobasCount,
  };
}

export const escobaDefinition: GameSchemaDefinition = {
  slug: 'escoba-del-15',
  title: 'Escoba del 15',
  description:
    'Juego tradicional español de captura: suma 15 puntos combinando una carta de la mano con una o varias de la mesa. Escoba limpia la mesa.',
  deckConfig: {
    templates: generateSpanishDeckTemplates(),
  },
  rules: {
    initialHandSize: 3,
    minPlayers: 2,
    maxPlayers: 4,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    effects: {},
    winCondition: {
      type: 'SCORE_THRESHOLD',
      targetScore: 15,
    },
    zones: [
      {
        id: 'table',
        name: 'Mesa',
        type: 'COMMUNITY',
        visibility: 'PUBLIC',
      },
    ],
    customState: {
      initialTableCards: 4,
    },
    targetScore: 15,
  },
};
