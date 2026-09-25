import { describe, expect, it } from 'vitest';
import {
  SPANISH_40,
  SPANISH_50,
  FRENCH_52,
  COLOR_MATCH_108,
  getDeckPresetsSummary,
} from '../../src/engine/capabilities/deck-presets.js';
import { validateGameSchema } from '../../src/modules/games/games.validator.js';

describe('Editor Presets & Schema Compatibility', () => {
  it('SPANISH_40 preset has 40 cards across 4 suits with valid values', () => {
    const total = SPANISH_40.templates.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(40);
    expect(SPANISH_40.templates.every((t) => t.type === 'NUMBER')).toBe(true);
  });

  it('SPANISH_50 preset has 50 cards including wild comodines', () => {
    const total = SPANISH_50.templates.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(50);
    const wilds = SPANISH_50.templates.filter((t) => t.type === 'WILD');
    expect(wilds.reduce((s, w) => s + w.count, 0)).toBe(2);
  });

  it('FRENCH_52 preset has 52 cards across 4 suits with numbers, faces, and aces', () => {
    const total = FRENCH_52.templates.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(52);
    const faces = FRENCH_52.templates.filter((t) => t.type === 'FACE');
    expect(faces.length).toBe(12); // J, Q, K * 4
  });

  it('COLOR_MATCH_108 preset has 108 cards matching standard UNO-like deck', () => {
    const total = COLOR_MATCH_108.templates.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(108);
  });

  it('deck presets summary accurately returns total cards', () => {
    const summary = getDeckPresetsSummary();
    expect(summary).toHaveLength(4);
    expect(summary.find((s) => s.id === 'SPANISH_40')?.totalCards).toBe(40);
    expect(summary.find((s) => s.id === 'SPANISH_50')?.totalCards).toBe(50);
    expect(summary.find((s) => s.id === 'FRENCH_52')?.totalCards).toBe(52);
    expect(summary.find((s) => s.id === 'COLOR_MATCH_108')?.totalCards).toBe(108);
  });

  it('a default newly created editor game schema passes validateGameSchema', () => {
    const defaultEditorGame = {
      slug: 'mi-nuevo-juego',
      title: 'Mi Nuevo Juego',
      description: 'Juego de prueba creado en el editor.',
      deckConfig: {
        templates: SPANISH_40.templates,
      },
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        initialHandSize: 3,
        matchingProperties: ['color', 'value'],
        allowWildOnAny: true,
        reshuffleDiscardPile: true,
        winCondition: {
          type: 'EMPTY_HAND',
        },
        zones: [
          { id: 'hand', name: 'Mano', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
          { id: 'draw_pile', name: 'Mazo', type: 'DRAW_PILE', visibility: 'HIDDEN' },
          { id: 'discard_pile', name: 'Descarte', type: 'DISCARD_PILE', visibility: 'PUBLIC' },
        ],
        phases: [
          {
            id: 'main',
            name: 'Turno Principal',
            allowedActions: ['PLAY_CARD', 'DRAW_CARD', 'PASS_TURN'],
          },
        ],
      },
    };

    const validation = validateGameSchema(defaultEditorGame);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toBeUndefined();
  });
});
