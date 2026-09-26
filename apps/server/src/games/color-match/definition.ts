import { CardTemplate, DEFAULT_DRAW_STACK_CONFIG, GameSchemaDefinition } from '../../engine/types.js';
import type { ColorMatchMode } from '@al-mazo/shared';

export type { ColorMatchMode };

const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;

export function generateColorMatchTemplates(mode: ColorMatchMode = 'CLASSIC'): CardTemplate[] {
  const templates: CardTemplate[] = [];

  if (mode === 'BLITZ') {
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

  if (mode === 'CHAOS') {
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

  // CLASSIC (default)
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

export function getColorMatchDefinition(mode: ColorMatchMode = 'CLASSIC'): GameSchemaDefinition {
  const baseEffects: NonNullable<GameSchemaDefinition['rules']['effects']> = {
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
  };

  if (mode === 'CHAOS') {
    baseEffects.SWAP = { type: 'SWAP_HANDS' };
    baseEffects.DISCARD_ALL = { type: 'DISCARD_ALL_COLOR' };
  }

  const initialHandSize = mode === 'BLITZ' ? 4 : mode === 'CHAOS' ? 6 : 7;
  const maxPlayers = mode === 'BLITZ' ? 6 : 8;

  const descriptions: Record<ColorMatchMode, string> = {
    CLASSIC:
      'Juego dinámico donde los jugadores compiten por vaciar su mano descartando cartas por coincidencia de color o valor, combinando cartas de acción y comodines.',
    BLITZ:
      'Variante rápida y caótica de ColorMatch con manos reducidas (4 cartas) y alta frecuencia de cartas de acción.',
    CHAOS:
      'Modo desenfrenado con cartas de intercambio de manos (SWAP) y descarte masivo de color (DISCARD ALL).',
  };

  const titles: Record<ColorMatchMode, string> = {
    CLASSIC: 'ColorMatch',
    BLITZ: 'ColorMatch Blitz',
    CHAOS: 'ColorMatch Chaos',
  };

  return {
    slug: 'color-match',
    title: titles[mode],
    description: descriptions[mode],
    deckConfig: {
      templates: generateColorMatchTemplates(mode),
    },
    rules: {
      initialHandSize,
      minPlayers: 2,
      maxPlayers,
      matchingProperties: ['color', 'value'],
      allowWildOnAny: true,
      reshuffleDiscardPile: true,
      autoPassOnDraw: true,
      requireNormalInitialCard: true,
      drawStack: DEFAULT_DRAW_STACK_CONFIG,
      effects: baseEffects,
      winCondition: {
        type: 'EMPTY_HAND',
      },
      customState: {
        colorMatchMode: mode,
      },
    },
  };
}

export const colorMatchDefinition: GameSchemaDefinition = getColorMatchDefinition('CLASSIC');
export const colorMatchBlitzDefinition: GameSchemaDefinition = {
  ...getColorMatchDefinition('BLITZ'),
  slug: 'color-match-blitz',
};
export const colorMatchChaosDefinition: GameSchemaDefinition = {
  ...getColorMatchDefinition('CHAOS'),
  slug: 'color-match-chaos',
};
