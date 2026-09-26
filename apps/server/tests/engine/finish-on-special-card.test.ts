import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchDefinition, getColorMatchDefinition } from '../../src/games/color-match/definition.js';
import { Card, GameSchemaDefinition } from '../../src/engine/types.js';
import { decideBotMove } from '../../src/engine/bot.js';
import { GameRoom } from '../../src/realtime/room.js';

type FinishRule = 'ALLOW' | 'BLOCK' | 'DRAW_PENALTY';

function buildEngine(rule?: FinishRule): GameEngine {
  const definition: GameSchemaDefinition = {
    ...colorMatchDefinition,
    rules: { ...colorMatchDefinition.rules, finishOnSpecialCard: rule },
  };
  const engine = new GameEngine(definition);
  engine.addPlayer('p1', 'Player 1');
  engine.addPlayer('p2', 'Player 2');
  engine.addPlayer('p3', 'Player 3');
  engine.start();
  return engine;
}

function setHand(engine: GameEngine, playerIndex: number, hand: Card[]): void {
  (engine as unknown as { players: Array<{ hand: Card[] }> }).players[playerIndex].hand = hand;
}

describe('finishOnSpecialCard per-match rule', () => {
  it('ALLOW (default) lets a special card close the match', () => {
    const engine = buildEngine();
    const top = engine.getTopDiscardCard()!;
    setHand(engine, 0, [
      { id: 'last', type: 'ACTION', color: top.color ?? 'RED', value: 'SKIP' },
    ]);

    engine.playCard('p1', 'last');

    const state = engine.getPublicState();
    expect(state.status).toBe('FINISHED');
    expect(state.winnerId).toBe('p1');
  });

  it('BLOCK rejects the last special card and keeps the match running', () => {
    const engine = buildEngine('BLOCK');
    const top = engine.getTopDiscardCard()!;
    setHand(engine, 0, [
      { id: 'last', type: 'ACTION', color: top.color ?? 'RED', value: 'SKIP' },
    ]);

    expect(() => engine.playCard('p1', 'last')).toThrow(/carta especial/i);
    expect(engine.getPublicState().status).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('p1').map((c) => c.id)).toEqual(['last']);

    setHand(engine, 0, [{ id: 'num', type: 'NUMBER', color: top.color ?? 'RED', value: '5' }]);
    engine.playCard('p1', 'num');

    expect(engine.getPublicState().status).toBe('FINISHED');
    expect(engine.getPublicState().winnerId).toBe('p1');
  });

  it('BLOCK still allows playing a special card when it is not the last one', () => {
    const engine = buildEngine('BLOCK');
    const top = engine.getTopDiscardCard()!;
    const color = top.color ?? 'RED';
    setHand(engine, 0, [
      { id: 'special', type: 'ACTION', color, value: 'SKIP' },
      { id: 'num', type: 'NUMBER', color, value: '5' },
    ]);

    engine.playCard('p1', 'special');

    expect(engine.getPublicState().status).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('p1').map((c) => c.id)).toEqual(['num']);
  });

  it('DRAW_PENALTY plays the special card, draws 2 and continues', () => {
    const engine = buildEngine('DRAW_PENALTY');
    const top = engine.getTopDiscardCard()!;
    setHand(engine, 0, [
      { id: 'last', type: 'ACTION', color: top.color ?? 'RED', value: 'SKIP' },
    ]);

    engine.playCard('p1', 'last');

    const state = engine.getPublicState();
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.winnerId).toBeNull();
    expect(engine.getPlayerHand('p1').length).toBe(2);
    expect(state.currentTurnPlayerId).toBe('p3');
  });

  it('DRAW_PENALTY still lets a number card close the match', () => {
    const engine = buildEngine('DRAW_PENALTY');
    const top = engine.getTopDiscardCard()!;
    setHand(engine, 0, [{ id: 'num', type: 'NUMBER', color: top.color ?? 'RED', value: '5' }]);

    engine.playCard('p1', 'num');

    expect(engine.getPublicState().status).toBe('FINISHED');
    expect(engine.getPublicState().winnerId).toBe('p1');
  });

  it('BLOCK rejects DISCARD_ALL when it would empty the hand (Chaos)', () => {
    const chaos = getColorMatchDefinition('CHAOS');
    const engine = new GameEngine({
      ...chaos,
      rules: { ...chaos.rules, finishOnSpecialCard: 'BLOCK' },
    });
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.start();

    const color = engine.getTopDiscardCard()!.color ?? 'RED';
    setHand(engine, 0, [
      { id: 'discard_all', type: 'ACTION', color, value: 'DISCARD_ALL' },
      { id: 'same_color', type: 'NUMBER', color, value: '5' },
    ]);

    expect(() => engine.playCard('p1', 'discard_all')).toThrow(/carta especial/i);
    expect(engine.getPublicState().status).toBe('IN_PROGRESS');
  });

  it('DRAW_PENALTY applies after DISCARD_ALL empties the hand (Chaos)', () => {
    const chaos = getColorMatchDefinition('CHAOS');
    const engine = new GameEngine({
      ...chaos,
      rules: { ...chaos.rules, finishOnSpecialCard: 'DRAW_PENALTY' },
    });
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.start();

    const color = engine.getTopDiscardCard()!.color ?? 'RED';
    setHand(engine, 0, [
      { id: 'discard_all', type: 'ACTION', color, value: 'DISCARD_ALL' },
      { id: 'same_color', type: 'NUMBER', color, value: '5' },
    ]);

    engine.playCard('p1', 'discard_all');

    expect(engine.getPublicState().status).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('p1').length).toBe(2);
  });

  it('bot avoids its last special card when BLOCK is active', () => {
    const rules = { ...colorMatchDefinition.rules, finishOnSpecialCard: 'BLOCK' as const };
    const top = { id: 'top', type: 'NUMBER', color: 'RED', value: '5' };
    const special: Card = { id: 'special', type: 'ACTION', color: 'RED', value: 'SKIP' };

    expect(decideBotMove([special], top, 'RED', rules)).toBeNull();
    expect(
      decideBotMove([special, { id: 'num', type: 'NUMBER', color: 'RED', value: '3' }], top, 'RED', rules)
        ?.cardId
    ).toBe('special');
  });

  it('room applies the per-match option and exposes it to clients', () => {
    const room = new GameRoom(
      'SPCL1',
      colorMatchDefinition,
      { id: 'p1', name: 'Alice', socketId: 's1', reconnectToken: 't1' },
      { finishOnSpecialCard: 'BLOCK' }
    );

    expect(room.definition.rules.finishOnSpecialCard).toBe('BLOCK');
    expect(room.getPublicState().customState?.finishOnSpecialCard).toBe('BLOCK');
  });
});
