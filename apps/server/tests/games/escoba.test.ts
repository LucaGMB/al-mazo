import { describe, it, expect, beforeEach } from 'vitest';
import { DeckManager } from '../../src/engine/deck.js';
import {
  escobaDefinition,
  calculateEscobaValues,
  scoreRound,
  findEscobaCaptures,
  checkInitialTableSpecialRule,
  scoreEscobaMatchRound,
  getEscobaCardValue,
} from '../../src/games/escoba/definition.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { Card } from '../../src/engine/types.js';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { decideEscobaBotMove } from '../../src/engine/bot.js';

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
    expect(
      calculateEscobaValues(card('4', 'COPAS'), [card('11', 'ESPADAS'), card('2', 'OROS')])
    ).toBe(true); // 4 + 9 + 2
  });

  it('returns false when the sum differs from 15', () => {
    expect(calculateEscobaValues(card('7', 'OROS'), [card('7', 'ESPADAS')])).toBe(false); // 14
    expect(calculateEscobaValues(card('12', 'BASTOS'), [card('10', 'OROS')])).toBe(false); // 18
    expect(calculateEscobaValues(card('3', 'COPAS'), [])).toBe(false);
  });
});

describe('findEscobaCaptures', () => {
  it('finds all combinations of table cards that sum to 15 with hand card', () => {
    const handCard = card('7', 'OROS');
    const tableCards = [
      card('10', 'ESPADAS', 'sota'), // 8
      card('5', 'COPAS', 'cinco'), // 5
      card('3', 'BASTOS', 'tres'), // 3
    ];
    // 7 + 8 = 15, 7 + 5 + 3 = 15
    const captures = findEscobaCaptures(handCard, tableCards);
    expect(captures.length).toBe(2);
    expect(captures.some((c) => c.length === 1 && c[0].id === 'sota')).toBe(true);
    expect(captures.some((c) => c.length === 2)).toBe(true);
  });

  it('returns empty array when no combination sums to 15', () => {
    const handCard = card('1', 'OROS'); // 1
    const tableCards = [card('2', 'ESPADAS'), card('3', 'COPAS')]; // max sum 1+2+3 = 6
    const captures = findEscobaCaptures(handCard, tableCards);
    expect(captures).toEqual([]);
  });
});

describe('checkInitialTableSpecialRule', () => {
  it('awards 1 escoba and captures all if 4 cards sum to 15', () => {
    const table = [
      card('7', 'OROS'), // 7
      card('3', 'COPAS'), // 3
      card('4', 'BASTOS'), // 4
      card('1', 'ESPADAS'), // 1
    ];
    const res = checkInitialTableSpecialRule(table);
    expect(res.escobas).toBe(1);
    expect(res.capturesAll).toBe(true);
  });

  it('awards 2 escobas and captures all if 4 cards sum to 30', () => {
    const table = [
      card('12', 'OROS'), // 10
      card('12', 'COPAS'), // 10
      card('12', 'BASTOS'), // 10
      card('10', 'ESPADAS'), // 8 -> sum 38 (not 30)
    ];
    expect(checkInitialTableSpecialRule(table).capturesAll).toBe(false);

    const table30 = [
      card('12', 'OROS'), // 10
      card('12', 'COPAS'), // 10
      card('11', 'BASTOS'), // 9
      card('1', 'ESPADAS'), // 1
    ]; // sum 30
    const res30 = checkInitialTableSpecialRule(table30);
    expect(res30.escobas).toBe(2);
    expect(res30.capturesAll).toBe(true);
  });

  it('awards 0 escobas for other sums', () => {
    const table = [
      card('1', 'OROS'),
      card('2', 'COPAS'),
      card('3', 'BASTOS'),
      card('4', 'ESPADAS'),
    ]; // sum 10
    const res = checkInitialTableSpecialRule(table);
    expect(res.escobas).toBe(0);
    expect(res.capturesAll).toBe(false);
  });
});

describe('scoreRound (legacy summary)', () => {
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

describe('scoreEscobaMatchRound (Official comparative scoring)', () => {
  it('correctly scores cards majority, oros majority, sevens majority, guindis, and escobas', () => {
    const p1Cards = [
      card('7', 'OROS'), // guindis + siete + oro
      card('7', 'COPAS'), // siete
      card('7', 'ESPADAS'), // siete
      card('1', 'OROS'), // oro
      card('2', 'OROS'), // oro
      card('3', 'OROS'), // oro
      card('4', 'OROS'), // oro
      card('5', 'OROS'), // oro (total 6 oros)
      ...Array.from({ length: 15 }, (_, i) => card('1', 'BASTOS', `b${i}`)), // +15 cards = 23 cards
    ];

    const p2Cards = [
      card('7', 'BASTOS'), // siete (1 siete)
      card('10', 'OROS'), // oro
      card('11', 'OROS'), // oro
      card('12', 'OROS'), // oro
      card('6', 'OROS'), // oro (total 4 oros)
      ...Array.from({ length: 12 }, (_, i) => card('2', 'COPAS', `c${i}`)), // +12 cards = 17 cards
    ];

    const result = scoreEscobaMatchRound(
      { p1: p1Cards, p2: p2Cards },
      { p1: 1, p2: 0 }
    );

    const s1 = result.playerScores.p1;
    const s2 = result.playerScores.p2;

    expect(s1.pointsBreakdown.escobas).toBe(1);
    expect(s1.pointsBreakdown.sieteDeOros).toBe(1); // Guindis
    expect(s1.pointsBreakdown.mayoriaOros).toBe(1); // 6 vs 4
    expect(s1.pointsBreakdown.mayoriaSietes).toBe(1); // 3 vs 1
    expect(s1.pointsBreakdown.mayoriaCartas).toBe(1); // 23 vs 17
    expect(s1.roundPoints).toBe(5);

    expect(s2.roundPoints).toBe(0);
  });

  it('awards 2 points for all 10 oros and 3 points for all 4 sietes', () => {
    const p1Cards: Card[] = [
      card('1', 'OROS'),
      card('2', 'OROS'),
      card('3', 'OROS'),
      card('4', 'OROS'),
      card('5', 'OROS'),
      card('6', 'OROS'),
      card('7', 'OROS'),
      card('10', 'OROS'),
      card('11', 'OROS'),
      card('12', 'OROS'), // All 10 oros
      card('7', 'COPAS'),
      card('7', 'ESPADAS'),
      card('7', 'BASTOS'), // All 4 sietes
      card('1', 'COPAS'),
      card('2', 'COPAS'),
      card('3', 'COPAS'),
      card('4', 'COPAS'),
      card('5', 'COPAS'),
      card('6', 'COPAS'),
      card('10', 'COPAS'),
      card('11', 'COPAS'), // 21 cards
    ];

    const p2Cards: Card[] = Array.from({ length: 19 }, (_, i) => card('1', 'ESPADAS', `e${i}`));

    const result = scoreEscobaMatchRound({ p1: p1Cards, p2: p2Cards }, { p1: 0, p2: 0 });
    const s1 = result.playerScores.p1;

    expect(s1.pointsBreakdown.todosLosOros).toBe(2);
    expect(s1.pointsBreakdown.cuatroSietes).toBe(3);
    expect(s1.pointsBreakdown.sieteDeOros).toBe(1);
    expect(s1.pointsBreakdown.mayoriaCartas).toBe(1);
    expect(s1.roundPoints).toBe(7); // 2 + 3 + 1 + 1
  });

  it('awards 2 points if opponent has fewer than 10 cards in 2-player match', () => {
    const p1Cards = Array.from({ length: 32 }, (_, i) => card('1', 'ESPADAS', `e${i}`));
    const p2Cards = [card('2', 'OROS'), card('3', 'COPAS')]; // 2 cards (< 10)

    const result = scoreEscobaMatchRound({ p1: p1Cards, p2: p2Cards }, { p1: 0, p2: 0 });
    expect(result.playerScores.p1.pointsBreakdown.menosDeDiezCartas).toBe(2);
  });

  it('detects automatic loss if opponent captured 0 cards', () => {
    const p1Cards = [card('1', 'OROS'), card('2', 'COPAS')];
    const p2Cards: Card[] = [];

    const result = scoreEscobaMatchRound({ p1: p1Cards, p2: p2Cards });
    expect(result.autoLossPlayerId).toBe('p2');
  });

  it('awards 0 points on ties for majorities', () => {
    const p1Cards = [
      card('1', 'OROS'),
      card('2', 'OROS'),
      card('7', 'ESPADAS'),
      card('1', 'BASTOS'),
    ];
    const p2Cards = [
      card('3', 'OROS'),
      card('4', 'OROS'),
      card('7', 'COPAS'),
      card('2', 'BASTOS'),
    ]; // 2 oros each, 1 siete each, 4 cards each

    const result = scoreEscobaMatchRound({ p1: p1Cards, p2: p2Cards });
    expect(result.playerScores.p1.pointsBreakdown.mayoriaOros).toBe(0);
    expect(result.playerScores.p1.pointsBreakdown.mayoriaSietes).toBe(0);
    expect(result.playerScores.p1.pointsBreakdown.mayoriaCartas).toBe(0);
    expect(result.playerScores.p1.roundPoints).toBe(0);
    expect(result.playerScores.p2.roundPoints).toBe(0);
  });
});

describe('Escoba Bot AI', () => {
  it('chooses the capture that cleans the table (Escoba) when possible', () => {
    const hand = [card('7', 'OROS', 'h7'), card('2', 'BASTOS', 'h2')];
    const table = [card('10', 'ESPADAS', 't8')]; // Sota (8)

    const move = decideEscobaBotMove(hand, table);
    expect(move.action).toBe('CAPTURE_CARDS');
    expect(move.cardId).toBe('h7');
    expect(move.tableCardIds).toEqual(['t8']);
  });

  it('drops the safest card when no capture is possible', () => {
    const hand = [
      card('7', 'OROS', 'guindis'), // very precious
      card('7', 'COPAS', 'seven'), // precious
      card('1', 'BASTOS', 'ace'), // safe to drop
    ];
    const table = [card('12', 'ESPADAS', 'rey')]; // 10

    // No combination with 10 can sum to 15 (10+7=17, 10+1=11)
    const move = decideEscobaBotMove(hand, table);
    expect(move.action).toBe('DROP_CARD');
    expect(move.cardId).toBe('ace');
  });
});

describe('ModularGameEngine - Escoba del 15 Full Game Flow', () => {
  let engine: ModularGameEngine;

  beforeEach(() => {
    engine = new ModularGameEngine(escobaDefinition);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.start();
  });

  it('starts with 3 cards in hands and 4 cards on table with no discard pile', () => {
    expect(engine.getStatus()).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('p1').length).toBe(3);
    expect(engine.getPlayerHand('p2').length).toBe(3);

    const state = engine.getPublicState();
    expect(state.discardPileCount).toBe(0);
    expect(state.tableCards).toBeDefined();
    // In rare cases initial table cards sum 15 or 30 and dealer takes them,
    // so tableCards is either 4 or 0 (with escoba).
    expect([0, 4].includes(state.tableCards?.length ?? 0)).toBe(true);
    // Draw pile: 40 - (3*2 + 4) = 30 cards
    expect(state.drawPileCount).toBe(30);
  });

  it('allows playing a card to the table with DROP_CARD', () => {
    const initialHand = engine.getPlayerHand('p1');
    const cardToDrop = initialHand[0];

    const res = engine.executeAction('p1', 'DROP_CARD', { cardId: cardToDrop.id });
    expect(res.success).toBe(true);

    const state = engine.getPublicState();
    expect(state.currentTurnPlayerId).toBe('p2');
    expect(engine.getPlayerHand('p1').length).toBe(2);
    expect(state.tableCards?.some((c) => c.id === cardToDrop.id)).toBe(true);
  });

  it('allows capturing cards when sum is 15 and scores an Escoba if table is cleaned', () => {
    // Manually set hand and table for deterministic testing
    const p1 = engine.getCurrentPlayer();
    p1.hand = [card('7', 'OROS', 'p1_7')];
    (engine as any).tableCards = [card('10', 'ESPADAS', 'table_sota')]; // 8

    const res = engine.executeAction('p1', 'CAPTURE_CARDS', {
      cardId: 'p1_7',
      tableCardIds: ['table_sota'],
    });

    expect(res.success).toBe(true);
    const result = res.result as { captured: Card[]; escoba: boolean };
    expect(result.captured.length).toBe(2);
    expect(result.escoba).toBe(true);

    const state = engine.getPublicState();
    expect(state.tableCards?.length).toBe(0); // Clean table!
    expect(state.scores?.p1).toBe(1); // 1 escoba = 1 point
    expect(state.customState?.escobas).toEqual(expect.objectContaining({ p1: 1 }));
  });

  it('rejects capture if sum does not equal 15', () => {
    const p1 = engine.getCurrentPlayer();
    p1.hand = [card('7', 'OROS', 'p1_7')];
    (engine as any).tableCards = [card('12', 'ESPADAS', 'table_rey')]; // 10 -> 7 + 10 = 17

    const res = engine.executeAction('p1', 'CAPTURE_CARDS', {
      cardId: 'p1_7',
      tableCardIds: ['table_rey'],
    });

    expect(res.success).toBe(false);
    expect(engine.getPlayerHand('p1').length).toBe(1); // Card was not consumed
  });

  it('deals next hands of 3 cards when both players empty their hands', () => {
    // Both players have 1 card left
    (engine as any).players[0].hand = [card('1', 'OROS', 'p1_c1')];
    (engine as any).players[1].hand = [card('2', 'OROS', 'p2_c1')];
    (engine as any).currentTurnIndex = 0;

    // p1 drops card
    expect(engine.executeAction('p1', 'DROP_CARD', { cardId: 'p1_c1' }).success).toBe(true);
    expect(engine.getPlayerHand('p1').length).toBe(0);

    // p2 drops card -> both hands empty! Engine must automatically deal 3 new cards each
    expect(engine.executeAction('p2', 'DROP_CARD', { cardId: 'p2_c1' }).success).toBe(true);

    expect(engine.getPlayerHand('p1').length).toBe(3);
    expect(engine.getPlayerHand('p2').length).toBe(3);
  });

  it('sweeps remaining table cards to last captor and scores round at the end of deck', () => {
    // Empty the deck to simulate the very last deal
    (engine as any).deckManager.drawMultiple(40);
    expect((engine as any).deckManager.count).toBe(0);

    // Give p2 some captured cards so no automatic 0-capture loss occurs
    (engine as any).capturedCards['p2'] = [
      card('1', 'BASTOS'),
      card('2', 'BASTOS'),
      card('3', 'COPAS'),
    ];

    // p1 has 1 card that captures
    (engine as any).players[0].hand = [card('7', 'OROS', 'p1_7')];
    (engine as any).tableCards = [
      card('10', 'ESPADAS', 'sota'), // 8 -> 7+8=15
      card('3', 'BASTOS', 'leftover'), // remaining
    ];
    (engine as any).currentTurnIndex = 0;

    // p1 captures sota
    const capRes = engine.executeAction('p1', 'CAPTURE_CARDS', {
      cardId: 'p1_7',
      tableCardIds: ['sota'],
    });
    expect(capRes.success).toBe(true);
    expect((engine as any).lastCapturePlayerId).toBe('p1');

    // p2 has 1 card to drop
    (engine as any).players[1].hand = [card('4', 'COPAS', 'p2_4')];
    const dropRes = engine.executeAction('p2', 'DROP_CARD', { cardId: 'p2_4' });
    expect(dropRes.success).toBe(true);

    // Round ended! Leftover cards swept to p1 (last captor)
    // Next round started because neither player reached 15 target yet
    const state = engine.getPublicState();
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.customState?.round).toBe(2);
  });

  it('completes the game when a player reaches targetScore', () => {
    // Pre-seed p1 with 14 points
    (engine as any).scores['p1'] = 14;

    // p1 captures and cleans table for an Escoba (+1 point -> 15 points)
    const p1 = engine.getCurrentPlayer();
    p1.hand = [card('7', 'OROS', 'p1_7')];
    (engine as any).tableCards = [card('10', 'ESPADAS', 'sota')]; // 8

    const res = engine.executeAction('p1', 'CAPTURE_CARDS', {
      cardId: 'p1_7',
      tableCardIds: ['sota'],
    });
    expect(res.success).toBe(true);
    expect(engine.getStatus()).toBe('FINISHED');
    expect(engine.getWinnerId()).toBe('p1');
  });

  it('bot decides and executes valid move during game', () => {
    const p1 = engine.getCurrentPlayer();
    p1.hand = [card('7', 'OROS', 'bot_card')];
    (engine as any).tableCards = [card('10', 'ESPADAS', 't_sota')];

    const move = decideEscobaBotMove(p1.hand, (engine as any).tableCards);
    expect(move.action).toBe('CAPTURE_CARDS');
    expect(move.cardId).toBe('bot_card');
    expect(move.tableCardIds).toEqual(['t_sota']);

    const res = engine.executeAction(p1.id, move.action, {
      cardId: move.cardId,
      tableCardIds: move.tableCardIds,
    });
    expect(res.success).toBe(true);
  });
});
