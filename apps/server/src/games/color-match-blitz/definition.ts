import { CardTemplate, DEFAULT_DRAW_STACK_CONFIG, GameSchemaDefinition } from '../../engine/types.js';

const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;

function generateColorMatchBlitzTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const color of COLORS) {
    // Reduced number set (1 to 5, 1 card per color) for a fast deck
    for (let num = 1; num <= 5; num++) {
      templates.push({
        count: 1,
        type: 'NUMBER',
        color,
        value: String(num),
      });
    }

    // High-frequency action cards (2 per color)
    templates.push(
      { count: 2, type: 'ACTION', color, value: 'SKIP' },
      { count: 2, type: 'ACTION', color, value: 'REVERSE' },
      { count: 2, type: 'ACTION', color, value: 'DRAW_2' }
    );
  }

  // Wild cards (no base color)
  templates.push(
    { count: 4, type: 'WILD', color: 'ANY', value: 'WILD' },
    { count: 4, type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' }
  );

  return templates;
}

export const colorMatchBlitzDefinition: GameSchemaDefinition = {
  slug: 'color-match-blitz',
  title: 'ColorMatch Blitz',
  description:
    'Variante rápida y caótica de ColorMatch con manos reducidas y alta frecuencia de cartas de acción.',
  deckConfig: {
    templates: generateColorMatchBlitzTemplates(),
  },
  rules: {
    initialHandSize: 4,
    minPlayers: 2,
    maxPlayers: 6,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    autoPassOnDraw: true,
    drawStack: DEFAULT_DRAW_STACK_CONFIG,
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
        params: { drawCount: 2, skipTarget: false },
      },
      WILD: {
        type: 'CHOOSE_COLOR',
      },
      WILD_DRAW_4: {
        type: 'DRAW_CARDS',
        params: { drawCount: 4, skipTarget: false },
      },
    },
    winCondition: {
      type: 'EMPTY_HAND',
    },
  },
};
