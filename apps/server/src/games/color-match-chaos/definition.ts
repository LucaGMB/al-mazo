import { CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;

function generateColorMatchChaosTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const color of COLORS) {
    // Numbers 1 to 9 (1 card per color)
    for (let num = 1; num <= 9; num++) {
      templates.push({
        count: 1,
        type: 'NUMBER',
        color,
        value: String(num),
      });
    }

    // Action cards (1 per color)
    templates.push(
      { count: 1, type: 'ACTION', color, value: 'SKIP' },
      { count: 1, type: 'ACTION', color, value: 'REVERSE' },
      { count: 1, type: 'ACTION', color, value: 'DRAW_2' }
    );

    // Chaotic discard-all card (1 per color)
    templates.push({ count: 1, type: 'ACTION', color, value: 'DISCARD_ALL' });
  }

  // Wild cards (no base color)
  templates.push(
    { count: 4, type: 'WILD', color: 'ANY', value: 'WILD' },
    { count: 2, type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' },
    { count: 4, type: 'WILD', color: 'ANY', value: 'SWAP' }
  );

  return templates;
}

export const colorMatchChaosDefinition: GameSchemaDefinition = {
  slug: 'color-match-chaos',
  title: 'ColorMatch Chaos',
  description:
    'Modo desenfrenado con cartas de intercambio de manos (SWAP) y descarte masivo de color (DISCARD ALL).',
  deckConfig: {
    templates: generateColorMatchChaosTemplates(),
  },
  rules: {
    initialHandSize: 6,
    minPlayers: 2,
    maxPlayers: 8,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    effects: {
      SKIP: {
        type: 'SKIP',
        params: { step: 2 },
      },
      REVERSE: {
        type: 'REVERSE',
      },
      DRAW_2: {
        type: 'DRAW_CARDS',
        params: { drawCount: 2, skipTarget: true },
      },
      WILD: {
        type: 'CHOOSE_COLOR',
      },
      WILD_DRAW_4: {
        type: 'DRAW_CARDS',
        params: { drawCount: 4, skipTarget: true },
      },
      SWAP: {
        type: 'SWAP_HANDS',
      },
      DISCARD_ALL: {
        type: 'DISCARD_ALL_COLOR',
      },
    },
    winCondition: {
      type: 'EMPTY_HAND',
    },
  },
};
