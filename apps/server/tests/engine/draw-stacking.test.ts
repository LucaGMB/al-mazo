import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchDefinition } from '../../src/games/color-match/definition.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';
import { decideBotMove } from '../../src/engine/bot.js';
import { GameRoom } from '../../src/realtime/room.js';

describe('Configurable Draw Cards Stacking (+2 / +4)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(colorMatchDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.addPlayer('p3', 'Player 3');
    engine.start();
  });

  it('stacks +2 on +2 and accumulates draw count (ALL default mode)', () => {
    const top = engine.getTopDiscardCard()!;
    const p1 = engine.getCurrentPlayer();

    // p1 plays RED DRAW_2
    p1.hand = [
      { id: 'c1', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 'spare1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    engine.playCard('p1', 'c1');

    expect(engine.getPublicState().pendingDrawCount).toBe(2);
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');

    // p2 responds with BLUE DRAW_2 (valid because matching value)
    (engine as any).players[1].hand = [
      { id: 'c2', type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
      { id: 'spare2', type: 'NUMBER', color: 'BLUE', value: '5' },
    ];

    engine.playCard('p2', 'c2');
    expect(engine.getPublicState().pendingDrawCount).toBe(4);
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p3');

    // p3 does not have a draw card and draws from deck
    const p3HandBefore = engine.getPlayerHand('p3').length;
    engine.drawCard('p3');

    // p3 received 4 cards and turn ended automatically
    expect(engine.getPlayerHand('p3').length).toBe(p3HandBefore + 4);
    expect(engine.getPublicState().pendingDrawCount).toBe(0);
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p1');
  });

  it('tracks which player caused the accumulated draw pile', () => {
    expect(engine.getPendingDrawByPlayerId()).toBeNull();

    const top = engine.getTopDiscardCard()!;
    (engine as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    engine.playCard('p1', 'd2');
    expect(engine.getPendingDrawByPlayerId()).toBe('p1');

    (engine as any).players[1].hand = [
      { id: 'd2b', type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '1' },
    ];
    engine.playCard('p2', 'd2b');
    expect(engine.getPendingDrawByPlayerId()).toBe('p2');
  });

  it('stacks +4 on +2 and +2 on +4 in ALL mode with color flexibility', () => {
    const top = engine.getTopDiscardCard()!;
    (engine as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    engine.playCard('p1', 'd2');
    expect(engine.getPublicState().pendingDrawCount).toBe(2);

    // p2 plays WILD_DRAW_4
    (engine as any).players[1].hand = [
      { id: 'd4', type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '1' },
    ];
    engine.playCard('p2', 'd4');
    expect(engine.getPublicState().pendingChoice?.playerId).toBe('p2');
    engine.chooseColor('p2', 'GREEN');

    expect(engine.getPublicState().pendingDrawCount).toBe(6);
    expect(engine.getPublicState().activeColor).toBe('GREEN');
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p3');

    // p3 plays YELLOW DRAW_2 (allowed because default allowAnyColorDraw2OnDraw4 is true)
    (engine as any).players[2].hand = [
      { id: 'd2_yellow', type: 'ACTION', color: 'YELLOW', value: 'DRAW_2' },
      { id: 's3', type: 'NUMBER', color: 'YELLOW', value: '1' },
    ];
    engine.playCard('p3', 'd2_yellow');

    expect(engine.getPublicState().pendingDrawCount).toBe(8);
    expect(engine.getPublicState().activeColor).toBe('YELLOW');
    expect(engine.getPublicState().currentTurnPlayerId).toBe('p1');
  });

  it('rejects regular cards while a draw stack is active', () => {
    const top = engine.getTopDiscardCard()!;
    (engine as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    engine.playCard('p1', 'd2');

    // p2 tries to play matching color number card
    (engine as any).players[1].hand = [
      { id: 'num', type: 'NUMBER', color: engine.getPublicState().activeColor ?? 'RED', value: '5' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '1' },
    ];

    expect(() => engine.playCard('p2', 'num')).toThrow(
      /Hay cartas de robo acumuladas/i
    );
  });

  it('rejects passTurn when a draw stack is active', () => {
    const top = engine.getTopDiscardCard()!;
    (engine as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    engine.playCard('p1', 'd2');

    expect(() => engine.passTurn('p2')).toThrow(
      /Hay cartas de robo acumuladas/i
    );
  });

  it('enforces SAME_TYPE rule when configured', () => {
    const customDef: GameSchemaDefinition = {
      ...colorMatchDefinition,
      rules: {
        ...colorMatchDefinition.rules,
        drawStack: {
          rule: 'SAME_TYPE',
          endsTurnOnDraw: true,
          allowAnyColorDraw2OnDraw4: false,
        },
      },
    };
    const e = new GameEngine(customDef);
    e.addPlayer('p1', 'P1');
    e.addPlayer('p2', 'P2');
    e.start();

    const top = e.getTopDiscardCard()!;
    (e as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    e.playCard('p1', 'd2');

    // p2 attempts +4 on +2: should fail
    (e as any).players[1].hand = [
      { id: 'd4', type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' },
      { id: 'd2_same', type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '1' },
    ];

    expect(() => e.playCard('p2', 'd4')).toThrow(/mismo tipo/i);

    // p2 plays +2: should succeed
    e.playCard('p2', 'd2_same');
    expect(e.getPublicState().pendingDrawCount).toBe(4);
  });

  it('enforces HIGHER_OR_EQUAL rule when configured', () => {
    const customDef: GameSchemaDefinition = {
      ...colorMatchDefinition,
      rules: {
        ...colorMatchDefinition.rules,
        drawStack: {
          rule: 'HIGHER_OR_EQUAL',
          endsTurnOnDraw: true,
          allowAnyColorDraw2OnDraw4: false,
        },
      },
    };
    const e = new GameEngine(customDef);
    e.addPlayer('p1', 'P1');
    e.addPlayer('p2', 'P2');
    e.addPlayer('p3', 'P3');
    e.start();

    const top = e.getTopDiscardCard()!;
    (e as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    e.playCard('p1', 'd2');

    // +4 on +2 is allowed (4 >= 2)
    (e as any).players[1].hand = [
      { id: 'd4', type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' },
      { id: 's2', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    e.playCard('p2', 'd4');
    e.chooseColor('p2', 'RED');

    expect(e.getPublicState().pendingDrawCount).toBe(6);

    // p3 attempts +2 on +4: should fail (2 < 4)
    (e as any).players[2].hand = [
      { id: 'd2_p3', type: 'ACTION', color: 'RED', value: 'DRAW_2' },
      { id: 's3', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    expect(() => e.playCard('p3', 'd2_p3')).toThrow(/igual o mayor valor/i);
  });

  it('respects allowAnyColorDraw2OnDraw4: false by requiring color match', () => {
    const customDef: GameSchemaDefinition = {
      ...colorMatchDefinition,
      rules: {
        ...colorMatchDefinition.rules,
        drawStack: {
          rule: 'ALL',
          endsTurnOnDraw: true,
          allowAnyColorDraw2OnDraw4: false,
        },
      },
    };
    const e = new GameEngine(customDef);
    e.addPlayer('p1', 'P1');
    e.addPlayer('p2', 'P2');
    e.start();

    // p1 plays +4 and chooses BLUE
    (e as any).players[0].hand = [
      { id: 'd4', type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    e.playCard('p1', 'd4');
    e.chooseColor('p1', 'BLUE');

    // p2 has RED +2 and BLUE +2
    (e as any).players[1].hand = [
      { id: 'd2_red', type: 'ACTION', color: 'RED', value: 'DRAW_2' },
      { id: 'd2_blue', type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '1' },
    ];

    // RED +2 should be rejected
    expect(() => e.playCard('p2', 'd2_red')).toThrow(/coincidir con el color elegido/i);

    // BLUE +2 should be accepted
    e.playCard('p2', 'd2_blue');
    expect(e.getPublicState().pendingDrawCount).toBe(6);
  });

  it('allows playing after drawing when endsTurnOnDraw is false', () => {
    const customDef: GameSchemaDefinition = {
      ...colorMatchDefinition,
      rules: {
        ...colorMatchDefinition.rules,
        autoPassOnDraw: false,
        drawStack: {
          rule: 'ALL',
          endsTurnOnDraw: false,
          allowAnyColorDraw2OnDraw4: true,
        },
      },
    };
    const e = new GameEngine(customDef);
    e.addPlayer('p1', 'P1');
    e.addPlayer('p2', 'P2');
    e.start();

    const top = e.getTopDiscardCard()!;
    (e as any).players[0].hand = [
      { id: 'd2', type: 'ACTION', color: top.color ?? 'RED', value: 'DRAW_2' },
      { id: 's1', type: 'NUMBER', color: 'RED', value: '1' },
    ];
    e.playCard('p1', 'd2');

    (e as any).players[1].hand = [
      { id: 'match', type: 'NUMBER', color: top.color ?? 'RED', value: '9' },
      { id: 's2', type: 'NUMBER', color: 'BLUE', value: '3' },
    ];

    e.drawCard('p2');
    // Turn should still be p2 because endsTurnOnDraw is false and autoPass is false
    expect(e.getPublicState().currentTurnPlayerId).toBe('p2');
    expect(e.getPublicState().pendingDrawCount).toBe(0);

    // p2 can now play their matching card
    e.playCard('p2', 'match');
    expect(e.getPublicState().currentTurnPlayerId).toBe('p1');
  });

  it('decideBotMove stacks draw cards when pendingDrawCount > 0, otherwise draws', () => {
    const rules = colorMatchDefinition.rules;
    const handWithStack = [
      { id: 'c1', type: 'NUMBER', color: 'RED', value: '3' },
      { id: 'd2', type: 'ACTION', color: 'BLUE', value: 'DRAW_2' },
    ];

    // Under attack with pendingDrawCount = 2
    const move = decideBotMove(
      handWithStack,
      { id: 'top', type: 'ACTION', color: 'RED', value: 'DRAW_2' },
      'RED',
      rules,
      2
    );
    expect(move).not.toBeNull();
    expect(move?.cardId).toBe('d2');

    // Without a draw card under attack, bot returns null to draw
    const handWithoutStack = [
      { id: 'c1', type: 'NUMBER', color: 'RED', value: '3' },
      { id: 'c2', type: 'ACTION', color: 'RED', value: 'SKIP' },
    ];
    const moveNull = decideBotMove(
      handWithoutStack,
      { id: 'top', type: 'ACTION', color: 'RED', value: 'DRAW_2' },
      'RED',
      rules,
      2
    );
    expect(moveNull).toBeNull();
  });

  it('GameRoom overrides drawStack options per room', () => {
    const room = new GameRoom(
      'ROOM1',
      colorMatchDefinition,
      { id: 'host', name: 'Host', socketId: 'sock1', reconnectToken: 'tok1' },
      {
        drawStack: {
          rule: 'SAME_TYPE',
          endsTurnOnDraw: false,
          allowAnyColorDraw2OnDraw4: false,
        },
      }
    );

    expect(room.engine.drawStackConfig.rule).toBe('SAME_TYPE');
    expect(room.engine.drawStackConfig.endsTurnOnDraw).toBe(false);
    expect(room.engine.drawStackConfig.allowAnyColorDraw2OnDraw4).toBe(false);
  });
});
