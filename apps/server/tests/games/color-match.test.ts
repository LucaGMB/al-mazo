import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchDefinition } from '../../src/games/color-match/definition.js';
import { DeckManager } from '../../src/engine/deck.js';

describe('ColorMatch Game Definition', () => {
  it('generates the complete 108-card deck', () => {
    const deck = new DeckManager(colorMatchDefinition.deckConfig);
    expect(deck.count).toBe(108);

    const cards = deck.rawCards;
    const wildCount = cards.filter((c) => c.type === 'WILD').length;
    expect(wildCount).toBe(8); // 4 WILD + 4 WILD_DRAW_4

    const actionCount = cards.filter((c) => c.type === 'ACTION').length;
    expect(actionCount).toBe(24); // (2 SKIP + 2 REVERSE + 2 DRAW_2) * 4 colors

    const numberCount = cards.filter((c) => c.type === 'NUMBER').length;
    expect(numberCount).toBe(76); // (1 zero + 18 numbers) * 4 colors
  });
});

describe('ColorMatch Mechanics via GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(colorMatchDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.addPlayer('p3', 'Player 3');
  });

  it('deals 7 cards per player on start', () => {
    engine.start();
    const state = engine.getPublicState();

    expect(state.status).toBe('IN_PROGRESS');
    for (const player of state.players) {
      expect(player.cardCount).toBe(7);
    }
  });

  it('triggers SKIP effect skipping the next player', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    // Give p1 a SKIP card matching color
    const skipCard = {
      id: 'skip_card',
      type: 'ACTION',
      color: top.color ?? 'RED',
      value: 'SKIP',
    };
    p1.hand = [skipCard, { id: 'other', type: 'NUMBER', color: 'RED', value: '1' }];

    engine.playCard('p1', 'skip_card');

    // Turn should skip p2 and go to p3
    const state = engine.getPublicState();
    expect(state.currentTurnPlayerId).toBe('p3');
  });

  it('triggers REVERSE effect reversing direction', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    const reverseCard = {
      id: 'rev_card',
      type: 'ACTION',
      color: top.color ?? 'RED',
      value: 'REVERSE',
    };
    p1.hand = [reverseCard, { id: 'other', type: 'NUMBER', color: 'RED', value: '1' }];

    engine.playCard('p1', 'rev_card');

    // With 3 players and reverse, next is p3 (counter-clockwise)
    const state = engine.getPublicState();
    expect(state.turnDirection).toBe(-1);
    expect(state.currentTurnPlayerId).toBe('p3');
  });

  it('triggers DRAW_2 effect forcing target to draw 2 cards without skipping', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;

    const draw2Card = {
      id: 'd2_card',
      type: 'ACTION',
      color: top.color ?? 'RED',
      value: 'DRAW_2',
    };
    p1.hand = [draw2Card, { id: 'other', type: 'NUMBER', color: 'RED', value: '1' }];

    const p2HandBefore = engine.getPlayerHand('p2').length;
    engine.playCard('p1', 'd2_card');

    // p2 draws 2 cards
    const p2HandAfter = engine.getPlayerHand('p2').length;
    expect(p2HandAfter).toBe(p2HandBefore + 2);

    // p2 is not skipped, turn goes to p2
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');
  });

  it('handles WILD card and color selection', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();

    const wildCard = {
      id: 'wild_card',
      type: 'WILD',
      color: 'ANY',
      value: 'WILD',
    };
    p1.hand = [wildCard, { id: 'other', type: 'NUMBER', color: 'RED', value: '1' }];

    // Playing WILD without color puts game in pending choice
    engine.playCard('p1', 'wild_card');
    let state = engine.getPublicState();
    expect(state.pendingChoice?.playerId).toBe('p1');
    expect(state.pendingChoice?.type).toBe('COLOR');

    // Choose color GREEN
    engine.chooseColor('p1', 'GREEN');
    state = engine.getPublicState();
    expect(state.activeColor).toBe('GREEN');
    expect(state.pendingChoice).toBeNull();
    expect(state.currentTurnPlayerId).toBe('p2');
  });
});
