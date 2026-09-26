import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { descarteCriolloDefinition } from '../../src/games/descarte-criollo/definition.js';
import { DeckManager } from '../../src/engine/deck.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;

function otherSuit(suit: string): string {
  return SUITS.find((s) => s !== suit) ?? 'OROS';
}

describe('Descarte Criollo Game Definition', () => {
  it('generates the complete 40-card Spanish deck', () => {
    const deck = new DeckManager(descarteCriolloDefinition.deckConfig);
    expect(deck.count).toBe(40);

    const cards = deck.rawCards;
    for (const suit of SUITS) {
      expect(cards.filter((c) => c.color === suit).length).toBe(10);
    }

    const values = new Set(cards.map((c) => c.value));
    for (const value of ['1', '2', '7', '12']) {
      expect(values.has(value)).toBe(true);
    }
  });
});

describe('Descarte Criollo Mechanics via GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(descarteCriolloDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.addPlayer('p3', 'Player 3');
  });

  it('triggers REVERSE when playing a 1', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    p1.hand = [
      { id: 'uno', type: 'ACTION', color: top.color, value: '1' },
      { id: 'other', type: 'NUMBER', color: top.color, value: '5' },
    ];

    engine.playCard('p1', 'uno');

    const state = engine.getPublicState();
    expect(state.turnDirection).toBe(-1);
    expect(state.currentTurnPlayerId).toBe('p3');
  });

  it('triggers DISCARD_ALL_COLOR when playing a 7', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    p1.hand = [
      { id: 'siete', type: 'ACTION', color: top.color, value: '7' },
      { id: 'same', type: 'NUMBER', color: top.color, value: '3' },
      { id: 'other', type: 'NUMBER', color: otherSuit(top.color!), value: '5' },
    ];

    engine.playCard('p1', 'siete');

    const hand = engine.getPlayerHand('p1');
    expect(hand.some((c) => c.color === top.color)).toBe(false);
    expect(engine.getPublicState().discardPileCount).toBeGreaterThanOrEqual(3);
  });

  it('triggers CHOOSE_COLOR when playing a 12', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    p1.hand = [
      { id: 'doce', type: 'ACTION', color: top.color, value: '12' },
      { id: 'other', type: 'NUMBER', color: top.color, value: '5' },
    ];

    engine.playCard('p1', 'doce');

    let state = engine.getPublicState();
    expect(state.pendingChoice?.playerId).toBe('p1');
    expect(state.pendingChoice?.type).toBe('COLOR');

    engine.chooseColor('p1', 'OROS');
    state = engine.getPublicState();
    expect(state.activeColor).toBe('OROS');
    expect(state.pendingChoice).toBeNull();
    expect(state.currentTurnPlayerId).toBe('p2');
  });

  it('guarantees initial discard card is a normal number card without action effects', () => {
    for (let i = 0; i < 20; i++) {
      const matchEngine = new GameEngine(descarteCriolloDefinition);
      matchEngine.addPlayer('p1', 'Player 1');
      matchEngine.addPlayer('p2', 'Player 2');
      matchEngine.start();

      const topCard = matchEngine.getTopDiscardCard();
      expect(topCard).not.toBeNull();
      expect(topCard!.type).toBe('NUMBER');
      expect(descarteCriolloDefinition.rules.effects[String(topCard!.value)]).toBeUndefined();
      expect(['3', '5', '6', '10', '11']).toContain(String(topCard!.value));
    }
  });
});
