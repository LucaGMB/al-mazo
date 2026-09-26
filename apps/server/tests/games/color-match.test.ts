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

  it('triggers DRAW_2 effect accumulating 2 cards for next player', () => {
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

    // With stacking enabled by default, p2 faces a pending draw penalty of 2 cards
    expect(engine.getPublicState().pendingDrawCount).toBe(2);
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');

    // When p2 draws, p2 takes the 2 accumulated cards and turn advances to p3
    engine.drawCard('p2');
    expect(engine.getPlayerHand('p2').length).toBe(p2HandBefore + 2);
    expect(engine.getPublicState().pendingDrawCount).toBe(0);
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p3');
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

  it('guarantees that initial discard card is always a normal NUMBER card without special effects', () => {
    // Run multiple starts to verify across random deck shuffles
    for (let i = 0; i < 30; i++) {
      const matchEngine = new GameEngine(colorMatchDefinition);
      matchEngine.addPlayer('p1', 'Player 1');
      matchEngine.addPlayer('p2', 'Player 2');
      matchEngine.start();

      const topCard = matchEngine.getTopDiscardCard();
      expect(topCard).not.toBeNull();
      expect(topCard!.type).toBe('NUMBER');
      expect(colorMatchDefinition.rules.effects[String(topCard!.value)]).toBeUndefined();
      expect(['RED', 'BLUE', 'GREEN', 'YELLOW']).toContain(topCard!.color);
      expect(matchEngine.getPublicState().activeColor).toBe(topCard!.color);
    }
  });

  it('recycles rejected action and wild cards back into the deck during start()', () => {
    // Custom definition with requireNormalInitialCard: true and known deck
    const customDef = {
      ...colorMatchDefinition,
      deckConfig: {
        templates: [
          { count: 10, type: 'WILD', color: 'ANY', value: 'WILD' },
          { count: 10, type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
          { count: 10, type: 'NUMBER', color: 'YELLOW', value: '5' },
        ],
      },
      rules: {
        ...colorMatchDefinition.rules,
        initialHandSize: 2,
        requireNormalInitialCard: true,
      },
    };

    const matchEngine = new GameEngine(customDef);
    matchEngine.addPlayer('p1', 'Player 1');
    matchEngine.addPlayer('p2', 'Player 2');
    matchEngine.start();

    const topCard = matchEngine.getTopDiscardCard();
    expect(topCard).not.toBeNull();
    expect(topCard!.type).toBe('NUMBER');
    expect(topCard!.value).toBe('5');
    expect(topCard!.color).toBe('YELLOW');

    const state = matchEngine.getPublicState();
    // 30 total cards: 4 dealt to players (2 each) + 1 top discard + 25 in draw pile
    expect(state.players[0].cardCount).toBe(2);
    expect(state.players[1].cardCount).toBe(2);
    expect(state.discardPileCount).toBe(1);
    expect(state.drawPileCount).toBe(25);
    expect(
      state.players[0].cardCount +
        state.players[1].cardCount +
        state.discardPileCount +
        state.drawPileCount
    ).toBe(30);
  });
});
