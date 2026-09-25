import { describe, it, expect } from 'vitest';
import { DeckManager } from '../../src/engine/deck.js';
import {
  chinchonDefinition,
  isValidMeld,
  calculateUnmatchedPoints,
} from '../../src/games/chinchon/definition.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { Card } from '../../src/engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;

function card(value: string, color: string, id = `${value}-${color}`): Card {
  return { id, type: 'NUMBER', color, value };
}

describe('Chinchón Game Definition', () => {
  it('generates the complete 40-card Spanish deck', () => {
    const deck = new DeckManager(chinchonDefinition.deckConfig);
    expect(deck.count).toBe(40);

    const cards = deck.rawCards;
    for (const suit of SUITS) {
      expect(cards.filter((c) => c.color === suit).length).toBe(10);
    }
  });

  it('configures players, hand size and win condition', () => {
    expect(chinchonDefinition.slug).toBe('chinchon');
    expect(chinchonDefinition.rules.minPlayers).toBe(2);
    expect(chinchonDefinition.rules.maxPlayers).toBe(4);
    expect(chinchonDefinition.rules.initialHandSize).toBe(7);
    expect(chinchonDefinition.rules.winCondition).toEqual({
      type: 'SCORE_THRESHOLD',
      targetScore: 100,
    });
  });

  it('is registered in the official games registry', () => {
    expect(getOfficialGame('chinchon')).toBe(chinchonDefinition);
  });
});

describe('isValidMeld', () => {
  it('accepts a trio of the same value in different suits', () => {
    expect(isValidMeld([card('5', 'OROS'), card('5', 'ESPADAS'), card('5', 'COPAS')])).toBe(true);
  });

  it('rejects a set with duplicated suits or mixed values', () => {
    expect(isValidMeld([card('5', 'OROS'), card('5', 'OROS'), card('5', 'COPAS')])).toBe(false);
    expect(isValidMeld([card('5', 'OROS'), card('6', 'ESPADAS'), card('5', 'COPAS')])).toBe(false);
    expect(isValidMeld([card('5', 'OROS'), card('5', 'ESPADAS')])).toBe(false);
  });

  it('accepts an escalera of 3+ consecutive cards of the same suit', () => {
    expect(isValidMeld([card('3', 'OROS'), card('4', 'OROS'), card('5', 'OROS')])).toBe(true);
    expect(
      isValidMeld([card('10', 'BASTOS'), card('12', 'BASTOS'), card('11', 'BASTOS')])
    ).toBe(true); // unordered still valid
  });

  it('rejects broken or mixed-suit runs', () => {
    expect(isValidMeld([card('3', 'OROS'), card('4', 'OROS'), card('6', 'OROS')])).toBe(false);
    expect(isValidMeld([card('3', 'OROS'), card('4', 'OROS'), card('5', 'ESPADAS')])).toBe(false);
    expect(isValidMeld([card('5', 'OROS'), card('7', 'OROS'), card('10', 'OROS')])).toBe(false);
    // 7-10-11 of the same suit IS valid: the 40-card deck has no 8s/9s
    expect(isValidMeld([card('7', 'OROS'), card('10', 'OROS'), card('11', 'OROS')])).toBe(true);
  });
});

describe('calculateUnmatchedPoints', () => {
  it('sums cards not covered by any meld using face values for figures', () => {
    const hand = [
      card('3', 'OROS'),
      card('4', 'OROS'),
      card('5', 'OROS'),
      card('12', 'ESPADAS'),
      card('2', 'BASTOS'),
    ];
    const melds = [[hand[0], hand[1], hand[2]]];
    expect(calculateUnmatchedPoints(hand, melds)).toBe(12); // rey (10) + 2
  });

  it('returns 0 when every card belongs to a meld', () => {
    const hand = [card('6', 'OROS'), card('6', 'ESPADAS'), card('6', 'COPAS')];
    expect(calculateUnmatchedPoints(hand, [hand])).toBe(0);
  });
});
