import { CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;

function generateColorMatchTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const color of COLORS) {
    // Number 0 (1 card per color)
    templates.push({
      count: 1,
      type: 'NUMBER',
      color,
      value: '0',
    });

    // Numbers 1 to 9 (2 cards per color)
    for (let num = 1; num <= 9; num++) {
      templates.push({
        count: 2,
        type: 'NUMBER',
        color,
        value: String(num),
      });
    }

    // Action cards (2 per color)
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

export const colorMatchDefinition: GameSchemaDefinition = {
  slug: 'color-match',
  title: 'ColorMatch',
  description:
    'Juego dinámico donde los jugadores compiten por vaciar su mano descartando cartas por coincidencia de color o valor, combinando cartas de acción y comodines.',
  deckConfig: {
    templates: generateColorMatchTemplates(),
  },
  rules: {
    initialHandSize: 7,
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
    },
    winCondition: {
      type: 'EMPTY_HAND',
    },
  },
};
