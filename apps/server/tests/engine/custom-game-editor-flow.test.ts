import { describe, it, expect } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { getDeckPresetTemplates } from '../../src/engine/capabilities/deck-presets.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';

/**
 * Schema exactly as the visual editor's DEFAULT_NEW_GAME emits it:
 * no `rules.effects` key at all.
 */
const editorDefaultGame = {
  slug: 'mi-nuevo-juego',
  title: 'Mi Nuevo Juego',
  description: 'Un juego de cartas personalizado creado con el editor visual de Al Mazo.',
  deckConfig: {
    templates: getDeckPresetTemplates('SPANISH_40'),
  },
  rules: {
    minPlayers: 2,
    maxPlayers: 4,
    initialHandSize: 3,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    drawStack: {
      rule: 'ALL',
      endsTurnOnDraw: true,
      allowAnyColorDraw2OnDraw4: true,
    },
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
} as unknown as GameSchemaDefinition;

describe('Custom editor game end-to-end on the engine', () => {
  it('starts and plays a card with the default editor schema (no effects key)', () => {
    const engine = new ModularGameEngine(editorDefaultGame);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.start();

    expect(engine.getStatus()).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('p1')).toHaveLength(3);

    const top = engine.getTopDiscardCard()!;
    const current = engine.getCurrentPlayer();
    current.hand.push({
      id: 'guaranteed_playable',
      type: 'NUMBER',
      color: top.color,
      value: String(top.value ?? '5'),
    });

    expect(() => engine.playCard(current.id, 'guaranteed_playable')).not.toThrow();
  });

  it('reports DISCARD mode for the default editor schema', () => {
    const engine = new ModularGameEngine(editorDefaultGame);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.start();

    expect(engine.getPublicState().gameMode).toBe('DISCARD');
  });
});
