import { describe, it, expect } from 'vitest';
import { DeckManager } from '../../src/engine/deck.js';
import {
  escobaDefinition,
  calculateEscobaValues,
  scoreRound,
} from '../../src/games/escoba/definition.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { Card } from '../../src/engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;

function card(value: string, color: string, id = `${value}-${color}`): Card {
  return { id, type: 'NUMBER', color, value };
}

describe('Escoba del 15 Game Definition', () => {
  it('generates the complete 40-card Spanish deck', () => {
    const deck = new DeckManager(escobaDefinition.deckConfig);
    expect(deck.count).toBe(40);

    const cards = deck.rawCards;
    for (const suit of SUITS) {
      expect(cards.filter((c) => c.color === suit).length).toBe(10);
    }

    const values = new Set(cards.map((c) => c.value));
    for (const value of ['1', '7', '10', '11', '12']) {
      expect(values.has(value)).toBe(true);
    }
  });

  it('configures players, hand size, table cards and win condition', () => {
    expect(escobaDefinition.slug).toBe('escoba-del-15');
    expect(escobaDefinition.rules.minPlayers).toBe(2);
    expect(escobaDefinition.rules.maxPlayers).toBe(4);
    expect(escobaDefinition.rules.initialHandSize).toBe(3);
    expect(escobaDefinition.rules.customState?.initialTableCards).toBe(4);
    expect(escobaDefinition.rules.winCondition).toEqual({
      type: 'SCORE_THRESHOLD',
      targetScore: 15,
    });
  });

  it('is registered in the official games registry', () => {
    expect(getOfficialGame('escoba-del-15')).toBe(escobaDefinition);
  });
});

describe('calculateEscobaValues', () => {
  it('returns true when hand card plus table cards sum exactly 15', () => {
    expect(calculateEscobaValues(card('7', 'OROS'), [card('10', 'ESPADAS')])).toBe(true); // 7 + 8
    expect(calculateEscobaValues(card('12', 'BASTOS'), [card('5', 'OROS')])).toBe(true); // 10 + 5
    expect(calculateEscobaValues(card('4', 'COPAS'), [card('11', 'ESPADAS'), card('2', 'OROS')])).toBe(true); // 4 + 9 + 2
  });

  it('returns false when the sum differs from 15', () => {
    expect(calculateEscobaValues(card('7', 'OROS'), [card('7', 'ESPADAS')])).toBe(false); // 14
    expect(calculateEscobaValues(card('12', 'BASTOS'), [card('10', 'OROS')])).toBe(false); // 18
    expect(calculateEscobaValues(card('3', 'COPAS'), [])).toBe(false);
  });
});

describe('scoreRound', () => {
  it('awards 1 point for capturing the siete de velo (7 of OROS)', () => {
    const score = scoreRound([card('7', 'OROS'), card('2', 'ESPADAS')], 0);
    expect(score.sieteDeVelo).toBe(1);
    expect(score.total).toBe(1);
  });

  it('counts captured cards and sevens for majority comparison', () => {
    const captured = [
      card('7', 'OROS'),
      card('7', 'ESPADAS'),
      card('11', 'OROS'),
      card('4', 'BASTOS'),
      card('5', 'COPAS'),
    ];
    const score = scoreRound(captured, 0);
    expect(score.cards).toBe(5);
    expect(score.sevens).toBe(2);
    expect(score.oros).toBe(2);
  });

  it('awards 1 point per escoba', () => {
    const score = scoreRound([card('3', 'ESPADAS')], 2);
    expect(score.escobas).toBe(2);
    expect(score.total).toBe(2);
  });
});
