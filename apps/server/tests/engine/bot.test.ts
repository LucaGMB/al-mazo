import { describe, it, expect } from 'vitest';
import { chooseColor, decideBotMove } from '../../src/engine/bot.js';
import { Card, GameRulesConfig } from '../../src/engine/types.js';

const rules: GameRulesConfig = {
  initialHandSize: 7,
  minPlayers: 2,
  maxPlayers: 8,
  matchingProperties: ['color', 'value'],
  allowWildOnAny: true,
  reshuffleDiscardPile: true,
  effects: {
    SKIP: { type: 'SKIP', params: { step: 2 } },
    REVERSE: { type: 'REVERSE' },
    DRAW_2: { type: 'DRAW_CARDS', params: { drawCount: 2, skipTarget: true } },
    WILD: { type: 'CHOOSE_COLOR' },
    WILD_DRAW_4: { type: 'DRAW_CARDS', params: { drawCount: 4, skipTarget: true } },
  },
  winCondition: { type: 'EMPTY_HAND' },
};

const card = (id: string, color: string, value: string, type = 'NUMBER'): Card => ({
  id,
  type,
  color,
  value,
});

const red5 = card('top', 'RED', '5');

describe('Bot chooseColor', () => {
  it('picks the most frequent color in hand', () => {
    const hand = [
      card('a', 'RED', '1'),
      card('b', 'RED', '2'),
      card('c', 'BLUE', '3'),
      card('d', 'GREEN', '4'),
    ];
    expect(chooseColor(hand)).toBe('RED');
  });

  it('breaks ties by first appearance in hand', () => {
    const hand = [card('a', 'BLUE', '1'), card('b', 'RED', '2')];
    expect(chooseColor(hand)).toBe('BLUE');
  });

  it('uses the first card color when no counted colors exist', () => {
    expect(chooseColor([card('w', 'ANY', 'WILD', 'WILD')])).toBe('ANY');
    expect(chooseColor([])).toBe('RED');
  });
});

describe('Bot decideBotMove', () => {
  it('draws when no card in hand is playable', () => {
    const hand = [card('a', 'BLUE', '3'), card('b', 'GREEN', '4')];
    expect(decideBotMove(hand, red5, null, rules)).toBeNull();
  });

  it('plays a matching number card', () => {
    const hand = [card('a', 'RED', '9'), card('b', 'BLUE', '3')];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({ cardId: 'a' });
  });

  it('matches by value across colors', () => {
    const hand = [card('a', 'BLUE', '5'), card('b', 'GREEN', '9')];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({ cardId: 'a' });
  });

  it('prefers action cards over number cards', () => {
    const hand = [
      card('a', 'RED', '9'),
      card('b', 'RED', 'SKIP', 'ACTION'),
    ];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({ cardId: 'b' });
  });

  it('prefers draw actions over skip actions', () => {
    const hand = [
      card('a', 'RED', 'SKIP', 'ACTION'),
      card('b', 'RED', 'DRAW_2', 'ACTION'),
    ];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({ cardId: 'b' });
  });

  it('allows a value match even when active color differs', () => {
    const hand = [card('a', 'RED', '5'), card('b', 'GREEN', '2')];
    expect(decideBotMove(hand, red5, 'GREEN', rules)).toEqual({ cardId: 'a' });
  });

  it('plays a wild as a last resort and picks the most frequent color', () => {
    const hand = [
      card('w', 'ANY', 'WILD', 'WILD'),
      card('a', 'BLUE', '3'),
      card('b', 'BLUE', '4'),
      card('c', 'GREEN', '9'),
    ];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({
      cardId: 'w',
      chosenColor: 'BLUE',
    });
  });

  it('prefers wild draw 4 over plain wild and picks a color', () => {
    const hand = [
      card('w', 'ANY', 'WILD', 'WILD'),
      card('wd4', 'ANY', 'WILD_DRAW_4', 'WILD'),
      card('a', 'BLUE', '3'),
    ];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({
      cardId: 'wd4',
      chosenColor: 'BLUE',
    });
  });

  it('uses the only wild color when playing the only wild in hand', () => {
    const hand = [card('w', 'ANY', 'WILD', 'WILD')];
    expect(decideBotMove(hand, red5, null, rules)).toEqual({
      cardId: 'w',
      chosenColor: 'ANY',
    });
  });

  it('chooses a color for action cards whose effect requires it', () => {
    const criolloRules = {
      ...rules,
      effects: { ...rules.effects, '12': { type: 'CHOOSE_COLOR' as const } },
    };
    const hand = [
      card('a', 'ESPADAS', '12', 'ACTION'),
      card('b', 'COPAS', '5'),
      card('c', 'COPAS', '6'),
    ];

    expect(decideBotMove(hand, card('top', 'ESPADAS', '3'), null, criolloRules)).toEqual({
      cardId: 'a',
      chosenColor: 'COPAS',
    });
  });
});
