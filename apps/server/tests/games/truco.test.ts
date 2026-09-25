import { describe, it, expect } from 'vitest';
import { DeckManager } from '../../src/engine/deck.js';
import { getOfficialGame } from '../../src/games/registry.js';
import {
  trucoDefinition,
  getCardHierarchyValue,
  calculateEnvidoPoints,
} from '../../src/games/truco/definition.js';
import type { Card } from '../../src/engine/types.js';

const card = (color: string, value: string): Card => ({
  id: `${value}-${color}`,
  type: 'NUMBER',
  color,
  value,
});

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;

describe('Truco Argentino Deck', () => {
  it('generates a 40-card Spanish deck', () => {
    const deck = new DeckManager(trucoDefinition.deckConfig);
    expect(deck.count).toBe(40);

    const cards = deck.rawCards;
    for (const suit of SUITS) {
      expect(cards.filter((c) => c.color === suit).length).toBe(10);
    }

    const values = new Set(cards.map((c) => c.value));
    for (const value of ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12']) {
      expect(values.has(value)).toBe(true);
    }
    expect(values.has('8')).toBe(false);
    expect(values.has('9')).toBe(false);
  });

  it('deals 3 cards per hand to two players', () => {
    expect(trucoDefinition.rules.initialHandSize).toBe(3);

    const deck = new DeckManager(trucoDefinition.deckConfig);
    const p1 = deck.drawMultiple(trucoDefinition.rules.initialHandSize);
    const p2 = deck.drawMultiple(trucoDefinition.rules.initialHandSize);

    expect(p1).toHaveLength(3);
    expect(p2).toHaveLength(3);
    expect(deck.count).toBe(34);
  });
});

describe('Truco Card Hierarchy', () => {
  it('orders every card from strongest to weakest', () => {
    const ordered = [
      card('ESPADAS', '1'),
      card('BASTOS', '1'),
      card('ESPADAS', '7'),
      card('OROS', '7'),
      card('COPAS', '3'),
      card('BASTOS', '2'),
      card('OROS', '1'),
      card('ESPADAS', '12'),
      card('ESPADAS', '11'),
      card('ESPADAS', '10'),
      card('BASTOS', '7'),
      card('ESPADAS', '6'),
      card('ESPADAS', '5'),
      card('ESPADAS', '4'),
    ];

    for (let i = 0; i < ordered.length - 1; i++) {
      expect(getCardHierarchyValue(ordered[i])).toBeGreaterThan(
        getCardHierarchyValue(ordered[i + 1])
      );
    }
  });

  it('gives equal rank to equivalent cards', () => {
    expect(getCardHierarchyValue(card('OROS', '1'))).toBe(
      getCardHierarchyValue(card('COPAS', '1'))
    );
    expect(getCardHierarchyValue(card('BASTOS', '7'))).toBe(
      getCardHierarchyValue(card('COPAS', '7'))
    );
    expect(getCardHierarchyValue(card('ESPADAS', '3'))).toBe(
      getCardHierarchyValue(card('BASTOS', '3'))
    );
  });
});

describe('Envido Calculation', () => {
  it('adds 20 plus the sum of two same-suit cards', () => {
    expect(calculateEnvidoPoints([card('ESPADAS', '7'), card('ESPADAS', '6')])).toBe(33);
    expect(calculateEnvidoPoints([card('BASTOS', '4'), card('BASTOS', '5')])).toBe(29);
  });

  it('treats figures (10, 11, 12) as zero', () => {
    expect(calculateEnvidoPoints([card('COPAS', '10'), card('COPAS', '11')])).toBe(20);
    expect(calculateEnvidoPoints([card('COPAS', '12'), card('COPAS', '7')])).toBe(27);
  });

  it('falls back to the highest single card when suits differ', () => {
    expect(calculateEnvidoPoints([card('ESPADAS', '7'), card('BASTOS', '6')])).toBe(7);
    expect(calculateEnvidoPoints([card('ESPADAS', '3'), card('BASTOS', '5'), card('OROS', '6')])).toBe(6);
    expect(calculateEnvidoPoints([card('ESPADAS', '10'), card('BASTOS', '12')])).toBe(0);
  });

  it('picks the best same-suit pair out of three cards', () => {
    expect(
      calculateEnvidoPoints([card('ESPADAS', '4'), card('ESPADAS', '5'), card('BASTOS', '7')])
    ).toBe(29);
  });
});

describe('Truco Game Definition', () => {
  it('is registered and exported by getOfficialGame', () => {
    const game = getOfficialGame('truco');
    expect(game).toBeDefined();
    expect(game).toBe(trucoDefinition);
    expect(game?.slug).toBe('truco');
    expect(game?.title).toBe('Truco Argentino');
    expect(game?.rules.minPlayers).toBe(2);
    expect(game?.rules.maxPlayers).toBe(2);
    expect(game?.rules.initialHandSize).toBe(3);
  });

  it('declares the envido, trick and scoring phases', () => {
    const phases = trucoDefinition.rules.phases ?? [];
    expect(phases.map((p) => p.id)).toEqual([
      'ENVIDO_PHASE',
      'TRICK_PLAY',
      'ROUND_SCORING',
    ]);

    const envido = phases.find((p) => p.id === 'ENVIDO_PHASE');
    expect(envido?.allowedActions).toEqual([
      'CALL_ENVIDO',
      'CALL_REAL_ENVIDO',
      'CALL_FALTA_ENVIDO',
      'RESPOND_BET',
      'FOLD',
    ]);

    const trick = phases.find((p) => p.id === 'TRICK_PLAY');
    expect(trick?.allowedActions).toContain('PLAY_CARD');
    expect(trick?.allowedActions).toContain('CALL_TRUCO');
  });

  it('wins at 30 points', () => {
    expect(trucoDefinition.rules.winCondition).toEqual({
      type: 'SCORE_THRESHOLD',
      targetScore: 30,
    });
    expect(trucoDefinition.rules.targetScore).toBe(30);
  });
});
