import { CardTemplate, DEFAULT_DRAW_STACK_CONFIG, GameSchemaDefinition } from '../../engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;

function generateDescarteCriolloTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    templates.push(
      { count: 1, type: 'ACTION', color: suit, value: '1' }, // REVERSE
      { count: 1, type: 'ACTION', color: suit, value: '2' }, // DRAW_2
      { count: 1, type: 'NUMBER', color: suit, value: '3' },
      { count: 1, type: 'ACTION', color: suit, value: '4' }, // SKIP
      { count: 1, type: 'NUMBER', color: suit, value: '5' },
      { count: 1, type: 'NUMBER', color: suit, value: '6' },
      { count: 1, type: 'ACTION', color: suit, value: '7' }, // DISCARD_ALL_COLOR
      { count: 1, type: 'NUMBER', color: suit, value: '10' },
      { count: 1, type: 'NUMBER', color: suit, value: '11' },
      { count: 1, type: 'ACTION', color: suit, value: '12' } // CHOOSE_COLOR
    );
  }

  return templates;
}

export const descarteCriolloDefinition: GameSchemaDefinition = {
  slug: 'descarte-criollo',
  title: 'Descarte Criollo',
  description:
    'Tradicional juego de descarte con la baraja española de 40 cartas (Espadas, Bastos, Oros y Copas) con poderes especiales en los palos.',
  deckConfig: {
    templates: generateDescarteCriolloTemplates(),
  },
  rules: {
    initialHandSize: 5,
    minPlayers: 2,
    maxPlayers: 6,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    requireNormalInitialCard: true,
    drawStack: DEFAULT_DRAW_STACK_CONFIG,
    effects: {
      '1': {
        type: 'REVERSE',
      },
      '2': {
        type: 'DRAW_CARDS',
        params: { drawCount: 2, skipTarget: true },
      },
      '4': {
        type: 'SKIP',
        params: { step: 2 },
      },
      '7': {
        type: 'DISCARD_ALL_COLOR',
      },
      '12': {
        type: 'CHOOSE_COLOR',
      },
    },
    winCondition: {
      type: 'EMPTY_HAND',
    },
  },
};
