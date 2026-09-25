import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchBlitzDefinition } from '../../src/games/color-match-blitz/definition.js';
import { DeckManager } from '../../src/engine/deck.js';
import { officialGames } from '../../src/games/registry.js';

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

  it('is registered as an official game', () => {
    expect(officialGames[colorMatchBlitzDefinition.slug]).toBe(colorMatchBlitzDefinition);
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
