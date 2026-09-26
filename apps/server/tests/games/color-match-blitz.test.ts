import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchBlitzDefinition } from '../../src/games/color-match-blitz/definition.js';
import { DeckManager } from '../../src/engine/deck.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { GameRoom } from '../../src/realtime/room.js';
import { getColorMatchDefinition } from '../../src/games/color-match/definition.js';

describe('ColorMatch Blitz Game Definition', () => {
  it('generates the complete 52-card blitz deck', () => {
    const deck = new DeckManager(colorMatchBlitzDefinition.deckConfig);
    expect(deck.count).toBe(52);

    const cards = deck.rawCards;
    expect(cards.filter((c) => c.type === 'NUMBER').length).toBe(20); // (1-5) * 4 colors
    expect(cards.filter((c) => c.type === 'ACTION').length).toBe(24); // (2 SKIP + 2 REVERSE + 2 DRAW_2) * 4 colors
    expect(cards.filter((c) => c.type === 'WILD').length).toBe(8); // 4 WILD + 4 WILD_DRAW_4
  });

  it('includes the full action card set', () => {
    const values = new Set(colorMatchBlitzDefinition.deckConfig.templates.map((t) => t.value));
    for (const value of ['SKIP', 'REVERSE', 'DRAW_2', 'WILD', 'WILD_DRAW_4']) {
      expect(values.has(value)).toBe(true);
    }
  });

  it('exposes valid blitz rule parameters', () => {
    const rules = colorMatchBlitzDefinition.rules;
    expect(rules.initialHandSize).toBe(4);
    expect(rules.minPlayers).toBe(2);
    expect(rules.maxPlayers).toBe(6);
    expect(rules.minPlayers).toBeLessThan(rules.maxPlayers);
    expect(rules.matchingProperties).toEqual(['color', 'value']);
    expect(rules.allowWildOnAny).toBe(true);
    expect(rules.winCondition.type).toBe('EMPTY_HAND');

    for (const key of ['SKIP', 'REVERSE', 'DRAW_2', 'WILD', 'WILD_DRAW_4']) {
      expect(rules.effects[key]).toBeDefined();
    }
  });

  it('is accessible via getOfficialGame compatibility lookup', () => {
    const game = getOfficialGame(colorMatchBlitzDefinition.slug);
    expect(game).toBeDefined();
    expect(game?.title).toBe('ColorMatch Blitz');
  });

  it('can be retrieved via getColorMatchDefinition("BLITZ")', () => {
    const blitz = getColorMatchDefinition('BLITZ');
    expect(blitz.rules.initialHandSize).toBe(4);
    expect(blitz.rules.maxPlayers).toBe(6);
    expect(blitz.deckConfig.templates).toBeDefined();
  });
});

describe('ColorMatch Blitz Mechanics via GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(colorMatchBlitzDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.addPlayer('p3', 'Player 3');
  });

  it('initializes and deals 4 cards per player on start', () => {
    engine.start();
    const state = engine.getPublicState();

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.currentTurnPlayerId).toBe('p1');
    for (const player of state.players) {
      expect(player.cardCount).toBe(4);
    }
  });

  it('enforces the 6-player maximum', () => {
    for (let i = 4; i <= 6; i++) {
      engine.addPlayer(`p${i}`, `Player ${i}`);
    }
    expect(() => engine.addPlayer('p7', 'Player 7')).toThrow();
  });
});

describe('ColorMatch Blitz via GameRoom configuration', () => {
  it('applies BLITZ rules when colorMatchMode is set to BLITZ on color-match room', () => {
    const base = getColorMatchDefinition('CLASSIC');
    const room = new GameRoom(
      'BLTZ1',
      base,
      { id: 'p1', name: 'Alice', socketId: 's1', reconnectToken: 't1' },
      { colorMatchMode: 'BLITZ' }
    );
    room.addPlayer('p2', 'Bob', 's2', 't2');

    expect(room.definition.rules.initialHandSize).toBe(4);
    expect(room.definition.rules.maxPlayers).toBe(6);
    expect(room.definition.deckConfig.templates.length).toBe(34); // blitz deck templates
    expect(room.getPublicState().customState?.colorMatchMode).toBe('BLITZ');

    room.engine.start();
    expect(room.engine.getPlayerHand('p1').length).toBe(4);
    expect(room.engine.getPlayerHand('p2').length).toBe(4);
  });
});
