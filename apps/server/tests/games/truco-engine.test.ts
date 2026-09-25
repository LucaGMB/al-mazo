import { describe, it, expect, beforeEach } from 'vitest';
import { TrucoEngine } from '../../src/games/truco/truco-engine.js';
import { trucoDefinition } from '../../src/games/truco/definition.js';
import { Card } from '../../src/engine/types.js';

const c = (value: string, color: string, id?: string): Card => ({
  id: id ?? `${value}-${color}`,
  type: 'NUMBER',
  color,
  value,
});

describe('TrucoEngine', () => {
  let engine: TrucoEngine;

  beforeEach(() => {
    engine = new TrucoEngine(trucoDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.start();
  });

  it('starts the game in ENVIDO_PHASE with 3 cards per player', () => {
    const state = engine.getPublicState();
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.currentPhase).toBe('ENVIDO_PHASE');
    expect(engine.getPlayerHand('p1')).toHaveLength(3);
    expect(engine.getPlayerHand('p2')).toHaveLength(3);
    expect(state.currentTurnPlayerId).toBe('p1'); // p1 is mano
  });

  describe('Envido Betting Flow', () => {
    it('allows P1 to call Envido and P2 to accept (Quiero), awarding points to higher envido', () => {
      // Inject known hands to test deterministic result
      // P1: 7 de espadas, 6 de espadas, 1 de copas (33 envido)
      // P2: 4 de bastos, 5 de bastos, 2 de oros (29 envido)
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('1', 'COPAS', 'c3'),
      ];
      (engine as any).players[1].hand = [
        c('4', 'BASTOS', 'c4'),
        c('5', 'BASTOS', 'c5'),
        c('2', 'OROS', 'c6'),
      ];

      const callRes = engine.executeAction('p1', 'CALL_ENVIDO');
      expect(callRes.success).toBe(true);

      const stateAfterCall = engine.getPublicState();
      expect(stateAfterCall.currentTurnPlayerId).toBe('p2'); // Turn to respond
      expect((stateAfterCall.customState as any).envido.state).toBe('PENDING');

      const respondRes = engine.executeAction('p2', 'QUIERO');
      expect(respondRes.success).toBe(true);

      const stateAfterRespond = engine.getPublicState();
      expect(stateAfterRespond.scores?.p1).toBe(2);
      expect(stateAfterRespond.scores?.p2).toBe(0);
      expect((stateAfterRespond.customState as any).envido.state).toBe('RESOLVED');
      expect(stateAfterRespond.currentTurnPlayerId).toBe('p1'); // Resumes play
    });

    it('awards 1 point to caller if rival rejects (No Quiero)', () => {
      engine.executeAction('p1', 'CALL_ENVIDO');
      const res = engine.executeAction('p2', 'NO_QUIERO');
      expect(res.success).toBe(true);

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(1);
      expect(state.scores?.p2).toBe(0);
      expect((state.customState as any).envido.state).toBe('REJECTED');
    });

    it('handles chained calls: Envido -> Real Envido -> Quiero (5 points)', () => {
      (engine as any).players[0].hand = [c('7', 'ESPADAS', 'c1'), c('6', 'ESPADAS', 'c2'), c('1', 'COPAS', 'c3')]; // 33
      (engine as any).players[1].hand = [c('4', 'BASTOS', 'c4'), c('5', 'BASTOS', 'c5'), c('2', 'OROS', 'c6')]; // 29

      engine.executeAction('p1', 'CALL_ENVIDO');
      engine.executeAction('p2', 'CALL_REAL_ENVIDO');
      engine.executeAction('p1', 'QUIERO');

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(5);
    });

    it('resolves envido tie in favor of Mano', () => {
      // Both players have 27 envido
      (engine as any).players[0].hand = [c('7', 'ESPADAS', 'c1'), c('10', 'ESPADAS', 'c2'), c('1', 'COPAS', 'c3')]; // 27
      (engine as any).players[1].hand = [c('7', 'BASTOS', 'c4'), c('11', 'BASTOS', 'c5'), c('2', 'OROS', 'c6')]; // 27

      engine.executeAction('p1', 'CALL_ENVIDO');
      engine.executeAction('p2', 'QUIERO');

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(2); // P1 is mano, so P1 wins
    });
  });

  describe('Truco Betting Flow', () => {
    it('allows calling Truco, rival accepts, round worth 2 points', () => {
      const res = engine.executeAction('p1', 'CALL_TRUCO');
      expect(res.success).toBe(true);

      const stateAfterCall = engine.getPublicState();
      expect(stateAfterCall.currentTurnPlayerId).toBe('p2');

      const respondRes = engine.executeAction('p2', 'QUIERO');
      expect(respondRes.success).toBe(true);

      const state = engine.getPublicState();
      expect((state.customState as any).truco.points).toBe(2);
      expect((state.customState as any).truco.state).toBe('RESOLVED');
      expect(state.currentTurnPlayerId).toBe('p1');
    });

    it('ends round immediately and awards 1 point when rival says No Quiero to Truco', () => {
      engine.executeAction('p1', 'CALL_TRUCO');
      const respondRes = engine.executeAction('p2', 'NO_QUIERO');
      expect(respondRes.success).toBe(true);

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(1);
      // New round started, mano rotated to p2
      expect((state.customState as any).manoPlayerId).toBe('p2');
    });

    it('handles Retruco and Vale Cuatro escalations', () => {
      engine.executeAction('p1', 'CALL_TRUCO');
      engine.executeAction('p2', 'CALL_RETRUCO');
      engine.executeAction('p1', 'CALL_VALE_CUATRO');
      engine.executeAction('p2', 'QUIERO');

      const state = engine.getPublicState();
      expect((state.customState as any).truco.points).toBe(4);
    });
  });

  describe('Card Play & Trick Resolution', () => {
    it('resolves tricks correctly: P1 plays 4, P2 plays 5 -> P2 wins trick 1', () => {
      (engine as any).players[0].hand = [c('4', 'COPAS', 'p1_1'), c('5', 'COPAS', 'p1_2'), c('6', 'COPAS', 'p1_3')];
      (engine as any).players[1].hand = [c('5', 'ESPADAS', 'p2_1'), c('6', 'ESPADAS', 'p2_2'), c('7', 'ESPADAS', 'p2_3')];

      engine.playCard('p1', 'p1_1'); // 4 de copas (hierarchy 1)
      expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');

      engine.playCard('p2', 'p2_1'); // 5 de espadas (hierarchy 2)

      const state = engine.getPublicState();
      expect(state.currentTurnPlayerId).toBe('p2'); // P2 won trick 1, plays first in trick 2
      expect((state.customState as any).roundTricks[0].winnerId).toBe('p2');
      expect((state.customState as any).currentTrick).toBe(2);
    });

    it('resolves round when a player wins 2 tricks', () => {
      (engine as any).players[0].hand = [c('1', 'ESPADAS', 'p1_1'), c('1', 'BASTOS', 'p1_2'), c('4', 'COPAS', 'p1_3')];
      (engine as any).players[1].hand = [c('4', 'ESPADAS', 'p2_1'), c('4', 'BASTOS', 'p2_2'), c('5', 'COPAS', 'p2_3')];

      // Trick 1: P1 plays 1 espada (14) vs P2 plays 4 espada (1) -> P1 wins trick 1
      engine.playCard('p1', 'p1_1');
      engine.playCard('p2', 'p2_1');

      expect((engine.getPublicState().customState as any).currentTrick).toBe(2);

      // Trick 2: P1 plays 1 basto (13) vs P2 plays 4 basto (1) -> P1 wins trick 2 and round!
      engine.playCard('p1', 'p1_2');
      engine.playCard('p2', 'p2_2');

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(1); // 1 point for round without truco
      expect((state.customState as any).round).toBe(2); // New round started
    });

    it('handles first trick tie: winner of trick 2 wins the round', () => {
      // Both play 4 in trick 1
      (engine as any).players[0].hand = [c('4', 'COPAS', 'p1_1'), c('7', 'ESPADAS', 'p1_2'), c('4', 'OROS', 'p1_3')];
      (engine as any).players[1].hand = [c('4', 'BASTOS', 'p2_1'), c('4', 'ESPADAS', 'p2_2'), c('5', 'COPAS', 'p2_3')];

      engine.playCard('p1', 'p1_1');
      engine.playCard('p2', 'p2_1');

      const stateAfterT1 = engine.getPublicState();
      expect((stateAfterT1.customState as any).roundTricks[0].winnerId).toBe('EMPATE');

      // Trick 2: P1 plays 7 espada (12) vs P2 plays 4 espada (1) -> P1 wins trick 2 and wins round!
      engine.playCard('p1', 'p1_2');
      engine.playCard('p2', 'p2_2');

      const stateAfterT2 = engine.getPublicState();
      expect(stateAfterT2.scores?.p1).toBe(1);
    });

    it('supports Carta Tapada (plays face-down with 0 value)', () => {
      (engine as any).players[0].hand = [c('1', 'ESPADAS', 'p1_1'), c('5', 'COPAS', 'p1_2'), c('6', 'COPAS', 'p1_3')];
      (engine as any).players[1].hand = [c('4', 'ESPADAS', 'p2_1'), c('5', 'ESPADAS', 'p2_2'), c('6', 'ESPADAS', 'p2_3')];

      // P1 plays 1 de espada TAPADA -> loses to 4 de espada
      engine.playCard('p1', 'p1_1', undefined, true);
      engine.playCard('p2', 'p2_1');

      const state = engine.getPublicState();
      expect((state.customState as any).roundTricks[0].winnerId).toBe('p2');
    });

    it('allows player to Fold (irse al mazo)', () => {
      engine.executeAction('p1', 'CALL_TRUCO');
      engine.executeAction('p2', 'QUIERO');
      engine.executeAction('p1', 'FOLD');

      const state = engine.getPublicState();
      expect(state.scores?.p2).toBe(2); // P2 gets the 2 points of accepted truco
    });
  });

  describe('Flor Mechanics', () => {
    it('awards 3 points automatically for solo Flor and cancels Envido', () => {
      (engine as any).players[0].hand = [
        c('1', 'ESPADAS', 'c1'),
        c('7', 'ESPADAS', 'c2'),
        c('4', 'ESPADAS', 'c3'),
      ]; // Flor de espadas
      (engine as any).players[1].hand = [
        c('1', 'BASTOS', 'c4'),
        c('7', 'OROS', 'c5'),
        c('4', 'COPAS', 'c6'),
      ]; // No flor

      const res = engine.executeAction('p1', 'CALL_FLOR');
      expect(res.success).toBe(true);

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(3);
      expect((state.customState as any).flor.state).toBe('RESOLVED');
      expect((state.customState as any).envido.state).toBe('DISABLED');
    });

    it('handles Flor vs Flor when both have Flor: 4 points if accepted with Con Flor Quiero', () => {
      // P1: 7, 6, 5 de Espadas (38 flor)
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('5', 'ESPADAS', 'c3'),
      ];
      // P2: 4, 5, 6 de Bastos (35 flor)
      (engine as any).players[1].hand = [
        c('4', 'BASTOS', 'c4'),
        c('5', 'BASTOS', 'c5'),
        c('6', 'BASTOS', 'c6'),
      ];

      engine.executeAction('p1', 'CALL_FLOR');
      const stateCall = engine.getPublicState();
      expect((stateCall.customState as any).flor.state).toBe('PENDING');
      expect(stateCall.currentTurnPlayerId).toBe('p2');

      const res = engine.executeAction('p2', 'CON_FLOR_QUIERO');
      expect(res.success).toBe(true);

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(4); // P1 had 38 vs P2 35 -> P1 wins 4 points
      expect((state.customState as any).flor.state).toBe('RESOLVED');
    });

    it('awards 3 points to caller when rival says Con Flor Me Achico', () => {
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('5', 'ESPADAS', 'c3'),
      ];
      (engine as any).players[1].hand = [
        c('4', 'BASTOS', 'c4'),
        c('5', 'BASTOS', 'c5'),
        c('6', 'BASTOS', 'c6'),
      ];

      engine.executeAction('p1', 'CALL_FLOR');
      const res = engine.executeAction('p2', 'CON_FLOR_ME_ACHICO');
      expect(res.success).toBe(true);

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(3);
      expect((state.customState as any).flor.state).toBe('REJECTED');
    });

    it('handles Contraflor: 6 points if accepted, 4 points if refused', () => {
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('5', 'ESPADAS', 'c3'), // 38 flor
      ];
      (engine as any).players[1].hand = [
        c('7', 'BASTOS', 'c4'),
        c('6', 'BASTOS', 'c5'),
        c('4', 'BASTOS', 'c6'), // 37 flor
      ];

      engine.executeAction('p1', 'CALL_FLOR');
      engine.executeAction('p2', 'CALL_CONTRA_FLOR');

      const stateContra = engine.getPublicState();
      expect((stateContra.customState as any).flor.pointsAtStake).toBe(6);
      expect((stateContra.customState as any).flor.pointsIfRefused).toBe(4);

      engine.executeAction('p1', 'CON_FLOR_QUIERO');

      const state = engine.getPublicState();
      expect(state.scores?.p1).toBe(6);
    });
  });

  describe('El Envido está primero', () => {
    it('pauses Truco challenge on Envido call in trick 1, resolves Envido, then resumes Truco response', () => {
      // P1: 7 espada, 6 espada, 1 copa (33 envido)
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('1', 'COPAS', 'c3'),
      ];
      // P2: 4 bastos, 5 bastos, 2 oros (29 envido)
      (engine as any).players[1].hand = [
        c('4', 'BASTOS', 'c4'),
        c('5', 'BASTOS', 'c5'),
        c('2', 'OROS', 'c6'),
      ];

      // P1 shouts TRUCO in trick 1
      engine.executeAction('p1', 'CALL_TRUCO');
      expect((engine.getPublicState().customState as any).truco.state).toBe('PENDING');
      expect(engine.getPublicState().currentTurnPlayerId).toBe('p2');

      // P2 shouts "El Envido está primero"
      const envidoRes = engine.executeAction('p2', 'EL_ENVIDO_ESTA_PRIMERO');
      expect(envidoRes.success).toBe(true);

      const stateAfterEnvidoCall = engine.getPublicState();
      // Envido is pending for P1 to respond
      expect((stateAfterEnvidoCall.customState as any).envido.state).toBe('PENDING');
      expect(stateAfterEnvidoCall.currentTurnPlayerId).toBe('p1');

      // P1 accepts Envido: "Quiero"
      engine.executeAction('p1', 'QUIERO');

      const stateAfterEnvidoResolved = engine.getPublicState();
      // P1 won Envido (33 vs 29) -> +2 pts
      expect(stateAfterEnvidoResolved.scores?.p1).toBe(2);
      expect((stateAfterEnvidoResolved.customState as any).envido.state).toBe('RESOLVED');

      // NOW: Truco challenge resumes! It is P2's turn to answer P1's Truco
      expect((stateAfterEnvidoResolved.customState as any).truco.state).toBe('PENDING');
      expect(stateAfterEnvidoResolved.currentTurnPlayerId).toBe('p2');

      // P2 accepts Truco: "Quiero"
      engine.executeAction('p2', 'QUIERO');

      const stateAfterTrucoResolved = engine.getPublicState();
      expect((stateAfterTrucoResolved.customState as any).truco.state).toBe('RESOLVED');
      expect((stateAfterTrucoResolved.customState as any).truco.points).toBe(2);
      // Turn returns to P1 to play first card
      expect(stateAfterTrucoResolved.currentTurnPlayerId).toBe('p1');
    });

    it('ends game immediately if Envido points reach targetScore during El Envido está primero', () => {
      // Set P1 close to target score (targetScore = 30)
      (engine as any).scores.p1 = 29;
      (engine as any).players[0].hand = [
        c('7', 'ESPADAS', 'c1'),
        c('6', 'ESPADAS', 'c2'),
        c('1', 'COPAS', 'c3'),
      ]; // 33 envido
      (engine as any).players[1].hand = [
        c('4', 'BASTOS', 'c4'),
        c('5', 'BASTOS', 'c5'),
        c('2', 'OROS', 'c6'),
      ];

      engine.executeAction('p1', 'CALL_TRUCO');
      engine.executeAction('p2', 'EL_ENVIDO_ESTA_PRIMERO');
      engine.executeAction('p1', 'QUIERO');

      const state = engine.getPublicState();
      // P1 wins 2 points -> 31 >= 30 -> Game finished immediately!
      expect(state.status).toBe('FINISHED');
      expect(state.winnerId).toBe('p1');
    });
  });

  describe('Bot Execution', () => {
    it('bot automatically responds to envido and plays cards', () => {
      const botEngine = new TrucoEngine(trucoDefinition);
      botEngine.addPlayer('human', 'Human');
      botEngine.addPlayer('bot_1', 'Bot', true);
      botEngine.start();

      // Human calls envido
      botEngine.executeAction('human', 'CALL_ENVIDO');
      // Bot executes its turn
      botEngine.executeBotTurn('bot_1');

      const state = botEngine.getPublicState();
      // Envido should be resolved or rejected
      expect(['RESOLVED', 'REJECTED']).toContain((state.customState as any).envido.state);
    });
  });
});
