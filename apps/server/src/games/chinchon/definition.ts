import { Card, CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12'];

// Position of each value in the Spanish 40-card deck order (no 8s/9s)
const ORDER_INDEX: Record<string, number> = Object.fromEntries(VALUES.map((v, i) => [v, i]));

// Deadwood value: 1-7 face value, figures (10/11/12) count as 10
function deadwoodValue(card: Card): number {
  return Math.min(Number(card.value) || 0, 10);
}

function generateSpanishDeckTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value });
    }
  }

  return templates;
}

export function isValidMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false;

  // Trio/cuarteto: same value, all different suits
  const values = new Set(cards.map((card) => String(card.value)));
  if (values.size === 1) {
    return new Set(cards.map((card) => card.color)).size === cards.length;
  }

  // Escalera: same suit, consecutive in deck order
  const suits = new Set(cards.map((card) => card.color));
  if (suits.size !== 1) return false;

  const indexes = cards
    .map((card) => ORDER_INDEX[String(card.value)] ?? -1)
    .sort((a, b) => a - b);
  return indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
}

export function calculateUnmatchedPoints(hand: Card[], melds: Card[][]): number {
  const matched = new Set(melds.flat().map((card) => card.id));
  return hand
    .filter((card) => !matched.has(card.id))
    .reduce((sum, card) => sum + deadwoodValue(card), 0);
}

export const chinchonDefinition: GameSchemaDefinition = {
  slug: 'chinchon',
  title: 'Chinchón',
  description:
    'Juego de naipes español donde los jugadores forman combinaciones (escaleras o grupos de mismo número) para cerrar con la menor cantidad de puntos posible.',
  deckConfig: {
    templates: generateSpanishDeckTemplates(),
  },
  rules: {
    initialHandSize: 7,
    minPlayers: 2,
    maxPlayers: 4,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: true,
    effects: {},
    zones: [
      { id: 'HAND', name: 'Mano privada', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
      { id: 'DRAW_PILE', name: 'Mazo de robo', type: 'DRAW_PILE', visibility: 'HIDDEN' },
      { id: 'DISCARD_PILE', name: 'Pozo de descarte', type: 'DISCARD_PILE', visibility: 'PUBLIC' },
    ],
    phases: [
      { id: 'DRAW_PHASE', name: 'Robo', allowedActions: ['DRAW_CARD'] },
      { id: 'PLAY_PHASE', name: 'Descarte o Cierre', allowedActions: ['PLAY_CARD', 'PASS_TURN'] },
    ],
    winCondition: {
      type: 'SCORE_THRESHOLD',
      targetScore: 100,
    },
    targetScore: 100,
  },
};
