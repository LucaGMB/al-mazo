import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { DeckManager } from '../../src/engine/deck.js';
import { validateCardPlay } from '../../src/engine/validator.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';

const mockGameDefinition: GameSchemaDefinition = {
  slug: 'test-card-game',
  title: 'Test Card Game',
  description: 'A mock card game for testing engine primitives',
  deckConfig: {
    templates: [
      { count: 10, type: 'NUMBER', color: 'RED', value: '1' },
      { count: 10, type: 'NUMBER', color: 'RED', value: '2' },
      { count: 10, type: 'NUMBER', color: 'BLUE', value: '1' },
      { count: 10, type: 'NUMBER', color: 'BLUE', value: '2' },
      { count: 4, type: 'ACTION', color: 'RED', value: 'SKIP' },
      { count: 4, type: 'ACTION', color: 'BLUE', value: 'REVERSE' },
      { count: 4, type: 'ACTION', color: 'RED', value: 'DRAW_2' },
      { count: 4, type: 'WILD', color: 'ANY', value: 'WILD' },
    ],
  },
  rules: {
    initialHandSize: 3,
    minPlayers: 2,
    maxPlayers: 4,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    effects: {
      SKIP: { type: 'SKIP', params: { step: 2 } },
      REVERSE: { type: 'REVERSE' },
      DRAW_2: { type: 'DRAW_CARDS', params: { drawCount: 2, skipTarget: true } },
      WILD: { type: 'CHOOSE_COLOR' },
    },
    winCondition: { type: 'EMPTY_HAND' },
  },
};

describe('DeckManager', () => {
  it('generates expected number of cards from template config', () => {
    const deck = new DeckManager(mockGameDefinition.deckConfig);
    // 10 + 10 + 10 + 10 + 4 + 4 + 4 + 4 = 56
    expect(deck.count).toBe(56);
  });

  it('draws single and multiple cards correctly', () => {
    const deck = new DeckManager(mockGameDefinition.deckConfig);
    const card = deck.draw();
    expect(card).toBeDefined();
    expect(deck.count).toBe(55);

    const hand = deck.drawMultiple(5);
    expect(hand.length).toBe(5);
    expect(deck.count).toBe(50);
  });

  it('recycles discard pile when draw pile is low', () => {
    const deck = new DeckManager();
    const discardPile = [
      { id: 'c1', type: 'NUMBER', color: 'RED', value: '1' },
      { id: 'c2', type: 'NUMBER', color: 'RED', value: '2' },
      { id: 'c3', type: 'NUMBER', color: 'RED', value: '3' },
    ];
    deck.recycleDiscard(discardPile);
    // Top card (c3) remains in discard pile, others recycled into deck
    expect(discardPile.length).toBe(1);
    expect(discardPile[0].id).toBe('c3');
    expect(deck.count).toBe(2);
  });
});

describe('Card Play Validator', () => {
  const rules = mockGameDefinition.rules;
  const topCard = { id: 'top', type: 'NUMBER', color: 'RED', value: '1' };

  it('allows same color card', () => {
    const card = { id: 'c1', type: 'NUMBER', color: 'RED', value: '9' };
    const result = validateCardPlay(card, topCard, null, rules);
    expect(result.isValid).toBe(true);
  });

  it('allows same value card of different color', () => {
    const card = { id: 'c2', type: 'NUMBER', color: 'BLUE', value: '1' };
    const result = validateCardPlay(card, topCard, null, rules);
    expect(result.isValid).toBe(true);
  });

  it('rejects card with different color and different value', () => {
    const card = { id: 'c3', type: 'NUMBER', color: 'BLUE', value: '5' };
    const result = validateCardPlay(card, topCard, null, rules);
    expect(result.isValid).toBe(false);
  });

  it('allows wild card on any card', () => {
    const wildCard = { id: 'w1', type: 'WILD', color: 'ANY', value: 'WILD' };
    const result = validateCardPlay(wildCard, topCard, null, rules);
    expect(result.isValid).toBe(true);
  });

  it('validates against active color when set by wild card', () => {
    const greenCard = { id: 'g1', type: 'NUMBER', color: 'GREEN', value: '5' };
    const redCard = { id: 'r1', type: 'NUMBER', color: 'RED', value: '5' };

    // Active color chosen was GREEN
    expect(validateCardPlay(greenCard, topCard, 'GREEN', rules).isValid).toBe(true);
    expect(validateCardPlay(redCard, topCard, 'GREEN', rules).isValid).toBe(false);
  });

  it('allows same number card of different color even when activeColor is set', () => {
    const blueFive = { id: 'b5', type: 'NUMBER', color: 'BLUE', value: '5' };
    const redFive = { id: 'r5', type: 'NUMBER', color: 'RED', value: '5' };

    expect(validateCardPlay(blueFive, redFive, 'GREEN', rules).isValid).toBe(true);
  });

  it('rejects matching number when top discard card is WILD and colors differ', () => {
    const redFive = { id: 'r5', type: 'NUMBER', color: 'RED', value: '5' };
    const wildFive = { id: 'w5', type: 'WILD', color: 'ANY', value: '5' };

    expect(validateCardPlay(redFive, wildFive, 'BLUE', rules).isValid).toBe(false);
  });
});

describe('GameEngine State Machine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(mockGameDefinition);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.addPlayer('p3', 'Charlie');
  });

  it('starts game, deals hands, and sets initial discard card', () => {
    engine.start();
    const publicState = engine.getPublicState();

    expect(publicState.status).toBe('IN_PROGRESS');
    expect(publicState.players.length).toBe(3);
    expect(publicState.players[0].cardCount).toBe(3);
    expect(publicState.topDiscardCard).toBeDefined();
    expect(publicState.currentTurnPlayerId).toBe('p1');
  });

  it('redacts competitor hands from public state (anti-cheat)', () => {
    engine.start();
    const publicState = engine.getPublicState();
    // Public state only exposes cardCount, not raw hand arrays
    for (const player of publicState.players) {
      expect((player as unknown as { hand?: unknown }).hand).toBeUndefined();
      expect(player.cardCount).toBe(3);
    }

    // Secret hand is only retrievable via getPlayerHand
    const p1Hand = engine.getPlayerHand('p1');
    expect(p1Hand.length).toBe(3);
  });

  it('prevents play when not players turn', () => {
    engine.start();
    expect(() => {
      engine.playCard('p2', 'any_id');
    }).toThrow('Not your turn');
  });

  it('advances turn on draw and pass', () => {
    engine.start();
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p1');

    engine.drawCard('p1');
    expect(engine.getPlayerHand('p1').length).toBe(4);

    engine.passTurn('p1');
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');
  });

  it('handles win condition when last card is played', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    // Force hand to 1 valid card
    const top = engine.getTopDiscardCard()!;
    const winningCard = {
      id: 'win_card',
      type: 'NUMBER',
      color: top.color,
      value: top.value,
    };
    p1.hand = [winningCard];

    engine.playCard('p1', 'win_card');

    const state = engine.getPublicState();
    expect(state.status).toBe('FINISHED');
    expect(state.winnerId).toBe('p1');
  });
});
