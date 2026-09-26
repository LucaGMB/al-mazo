import { describe, it, expect } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { townOfSalemDefinition } from '../../src/games/town-of-salem/definition.js';
import { checkTownWinCondition, getRolesForPlayerCount } from '../../src/games/town-of-salem/roles.js';

describe('Town of Salem - Modular Engine & Game Flow', () => {
  function createTownGame(playerCount = 4): ModularGameEngine {
    const engine = new ModularGameEngine(townOfSalemDefinition);
    for (let i = 1; i <= playerCount; i++) {
      engine.addPlayer(`p${i}`, `Player ${i}`);
    }
    engine.start();
    return engine;
  }

  describe('Initialization & Role Distribution', () => {
    it('requires at least 4 players to start', () => {
      const engine = new ModularGameEngine(townOfSalemDefinition);
      engine.addPlayer('p1', 'Player 1');
      engine.addPlayer('p2', 'Player 2');
      engine.addPlayer('p3', 'Player 3');

      expect(() => engine.start()).toThrow(/4 players required/i);
    });

    it('distributes balanced roles for 4 to 8 players', () => {
      expect(getRolesForPlayerCount(4)).toEqual(['MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE']);
      expect(getRolesForPlayerCount(5)).toHaveLength(5);
      expect(getRolesForPlayerCount(6).filter((r) => r === 'MAFIOSO')).toHaveLength(2);
      expect(getRolesForPlayerCount(8)).toHaveLength(8);
    });

    it('initializes in NIGHT phase with dayNumber 1 and secret role cards in hand', () => {
      const engine = createTownGame(4);
      const state = engine.getPublicState();

      expect(state.gameMode).toBe('TOWN');
      expect(state.status).toBe('IN_PROGRESS');
      expect(state.townState).toBeDefined();
      expect(state.townState?.phase).toBe('NIGHT');
      expect(state.townState?.dayNumber).toBe(1);

      // Each player holds 1 role card in hand
      for (let i = 1; i <= 4; i++) {
        const hand = engine.getPlayerHand(`p${i}`);
        expect(hand).toHaveLength(1);
        expect(hand[0].type).toBe('ROLE');
        expect(['MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE']).toContain(hand[0].value);
      }
    });

    it('enforces total server authority: living players roles are hidden in public state', () => {
      const engine = createTownGame(4);
      const publicState = engine.getPublicState();

      for (const p of publicState.townState!.players) {
        expect(p.isAlive).toBe(true);
        expect(p.role).toBeUndefined();
        expect(p.faction).toBeUndefined();
      }
    });

    it('reveals allies to Mafioso in private role card metadata', () => {
      const engine = createTownGame(4);
      let mafiosoId: string | null = null;

      for (let i = 1; i <= 4; i++) {
        if (engine.getTownPlayerRole(`p${i}`) === 'MAFIOSO') {
          mafiosoId = `p${i}`;
          break;
        }
      }

      expect(mafiosoId).not.toBeNull();
      const mafiosoHand = engine.getPlayerHand(mafiosoId!);
      expect(mafiosoHand[0].metadata?.allies).toBeDefined();
    });
  });

  describe('Night Phase Actions & Resolution', () => {
    it('mitigates attack when Doctor protects the Mafia target', () => {
      const engine = createTownGame(4);
      // Assign explicit roles for deterministic testing
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      // Mafia attacks p4, Doctor heals p4
      engine.executeAction('p1', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p4' });
      engine.executeAction('p2', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p4' });
      engine.executeAction('p3', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p1' });

      // After all 3 night actors submitted, night auto-resolves to DAY_CHAT
      const state = engine.getPublicState();
      expect(state.townState?.phase).toBe('DAY_CHAT');
      expect(state.townState?.lastNightResult?.killedPlayerId).toBeNull();
      expect(state.townState?.lastNightResult?.savedPlayerId).toBe('p4');
      expect(engine.getTownPlayerAlive('p4')).toBe(true);
    });

    it('kills Mafia target when Doctor protects someone else', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      // Mafia attacks p4, Doctor heals p2
      engine.executeAction('p1', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p4' });
      engine.executeAction('p2', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p2' });
      engine.executeAction('p3', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p2' });

      const state = engine.getPublicState();
      expect(state.townState?.phase).toBe('DAY_CHAT');
      expect(state.townState?.lastNightResult?.killedPlayerId).toBe('p4');
      expect(engine.getTownPlayerAlive('p4')).toBe(false);

      // Dead player's role is revealed in public state
      const deadP4 = state.townState?.players.find((p) => p.id === 'p4');
      expect(deadP4?.isAlive).toBe(false);
      expect(deadP4?.role).toBe('TOWNIE');
    });

    it('Sheriff receives accurate verdict (Bueno vs Malvado)', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      const result1 = engine.executeAction('p3', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p1' });
      expect(result1.success).toBe(true);
      expect((result1.result as any)?.verdict).toBe('Malvado');

      const sheriffState = engine.getTownPublicState('p3');
      expect(sheriffState.sheriffInvestigation?.verdict).toBe('Malvado');

      // Others do not see sheriff's investigation
      const otherState = engine.getTownPublicState('p1');
      expect(otherState.sheriffInvestigation).toBeNull();
    });

    it('rejects night actions from Townies or dead players', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      const townieAction = engine.executeAction('p4', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p1' });
      expect(townieAction.success).toBe(false);

      engine.setTownPlayerAlive('p3', false);
      const deadAction = engine.executeAction('p3', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p1' });
      expect(deadAction.success).toBe(false);
    });
  });

  describe('Day Chat & Day Vote Phase', () => {
    it('transitions from DAY_CHAT to DAY_VOTE via START_DAY_VOTE action', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      // Resolve night with no deaths
      engine.executeAction('p1', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p4' });
      engine.executeAction('p2', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p4' });
      engine.executeAction('p3', 'SUBMIT_NIGHT_ACTION', { targetPlayerId: 'p1' });

      expect(engine.getPublicState().townState?.phase).toBe('DAY_CHAT');

      // Advance to vote
      const voteStart = engine.executeAction('p1', 'START_DAY_VOTE');
      expect(voteStart.success).toBe(true);
      expect(engine.getPublicState().townState?.phase).toBe('DAY_VOTE');
    });

    it('lynches player who receives majority of living votes and reveals their role', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      // Advance to DAY_VOTE
      engine.advanceTownPhase(); // night -> day_chat
      engine.advanceTownPhase(); // day_chat -> day_vote

      expect(engine.getPublicState().townState?.phase).toBe('DAY_VOTE');

      // 3 players vote to lynch p1 (Mafioso), p1 votes SKIP
      engine.executeAction('p2', 'CAST_VOTE', { targetPlayerId: 'p1' });
      engine.executeAction('p3', 'CAST_VOTE', { targetPlayerId: 'p1' });
      engine.executeAction('p4', 'CAST_VOTE', { targetPlayerId: 'p1' });
      engine.executeAction('p1', 'CAST_VOTE', { targetPlayerId: 'SKIP' });

      // All 4 living voted: p1 is lynched! All mafia eliminated => Town wins!
      const state = engine.getPublicState();
      expect(engine.getTownPlayerAlive('p1')).toBe(false);
      expect(state.status).toBe('FINISHED');
      expect(state.townState?.winnerFaction).toBe('TOWN');
      expect(state.townState?.lastDayResult?.lynchedPlayerId).toBe('p1');
      expect(state.townState?.lastDayResult?.role).toBe('MAFIOSO');
    });

    it('does not lynch anyone when SKIP receives majority or in a tie', () => {
      const engine = createTownGame(4);
      engine.setTownPlayerRole('p1', 'MAFIOSO');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'TOWNIE');

      engine.advanceTownPhase(); // night -> day_chat
      engine.advanceTownPhase(); // day_chat -> day_vote

      // 2 votes SKIP, 1 vote p1, 1 vote p2 (no majority on any player)
      engine.executeAction('p1', 'CAST_VOTE', { targetPlayerId: 'SKIP' });
      engine.executeAction('p2', 'CAST_VOTE', { targetPlayerId: 'SKIP' });
      engine.executeAction('p3', 'CAST_VOTE', { targetPlayerId: 'p1' });
      engine.executeAction('p4', 'CAST_VOTE', { targetPlayerId: 'p2' });

      const state = engine.getPublicState();
      expect(state.townState?.lastDayResult?.lynchedPlayerId).toBeNull();
      // Game continues to Night 2
      expect(state.townState?.phase).toBe('NIGHT');
      expect(state.townState?.dayNumber).toBe(2);
      expect(engine.getTownPlayerAlive('p1')).toBe(true);
    });
  });

  describe('Win Condition Logic', () => {
    it('Town wins when 0 living mafia remain', () => {
      const result = checkTownWinCondition([
        { id: 'p1', role: 'MAFIOSO', isAlive: false },
        { id: 'p2', role: 'DOCTOR', isAlive: true },
        { id: 'p3', role: 'SHERIFF', isAlive: true },
      ]);
      expect(result).toBe('TOWN');
    });

    it('Mafia wins when living mafia >= living town', () => {
      // 1 Mafia vs 1 Townie = parity => Mafia wins
      const result = checkTownWinCondition([
        { id: 'p1', role: 'MAFIOSO', isAlive: true },
        { id: 'p2', role: 'DOCTOR', isAlive: false },
        { id: 'p3', role: 'SHERIFF', isAlive: true },
      ]);
      expect(result).toBe('MAFIA');
    });

    it('continues when Town has more living members than Mafia', () => {
      const result = checkTownWinCondition([
        { id: 'p1', role: 'MAFIOSO', isAlive: true },
        { id: 'p2', role: 'DOCTOR', isAlive: true },
        { id: 'p3', role: 'SHERIFF', isAlive: true },
        { id: 'p4', role: 'TOWNIE', isAlive: true },
      ]);
      expect(result).toBeNull();
    });
  });

  describe('Bot Support', () => {
    it('executes valid bot night moves and day votes without error', () => {
      const engine = new ModularGameEngine(townOfSalemDefinition);
      engine.addPlayer('p1', 'Human Player', false);
      engine.addPlayer('p2', 'Bot Doctor', true);
      engine.addPlayer('p3', 'Bot Sheriff', true);
      engine.addPlayer('p4', 'Bot Mafioso', true);
      engine.start();

      engine.setTownPlayerRole('p1', 'TOWNIE');
      engine.setTownPlayerRole('p2', 'DOCTOR');
      engine.setTownPlayerRole('p3', 'SHERIFF');
      engine.setTownPlayerRole('p4', 'MAFIOSO');

      // Execute bot night moves
      engine.executeTownBotMove('p2');
      engine.executeTownBotMove('p3');
      engine.executeTownBotMove('p4');

      // Night resolves automatically because all 3 night actors (p2, p3, p4) acted
      expect(engine.getPublicState().townState?.phase).toBe('DAY_CHAT');

      // Advance to vote
      engine.advanceTownPhase();
      expect(engine.getPublicState().townState?.phase).toBe('DAY_VOTE');

      // Execute bot votes for living bots
      const livingBots = ['p2', 'p3', 'p4'].filter((id) => engine.getTownPlayerAlive(id));
      expect(livingBots.length).toBeGreaterThan(0);

      const firstBot = livingBots[0];
      engine.executeTownBotMove(firstBot);

      const voteState = engine.getPublicState();
      if (voteState.townState?.phase === 'DAY_VOTE') {
        expect(Object.keys(voteState.townState?.votes ?? {})).toContain(firstBot);
      }

      for (let i = 1; i < livingBots.length; i++) {
        engine.executeTownBotMove(livingBots[i]);
      }
    });
  });
});
