import { describe, expect, it } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { hdpDefinition } from '../../src/games/hdp/definition.js';
import { getDeckPresetTemplates } from '../../src/engine/capabilities/deck-presets.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';

function createHdpEngine(playerCount = 4): ModularGameEngine {
  const engine = new ModularGameEngine(hdpDefinition);
  for (let i = 1; i <= playerCount; i += 1) {
    engine.addPlayer(`p${i}`, `Jugador ${i}`);
  }
  engine.start();
  return engine;
}

function submitFirstCards(engine: ModularGameEngine, playerId: string): void {
  const state = engine.getPublicState();
  const picks = state.submission?.requiredPicks ?? 1;
  const cardIds = engine
    .getPlayerHand(playerId)
    .slice(0, picks)
    .map((card) => card.id);
  const result = engine.executeAction(playerId, 'SUBMIT_CARDS', { cardIds });
  expect(result.success).toBe(true);
}

describe('HDP deck and start', () => {
  it('deals 10 answer cards to every player and no prompt cards', () => {
    const engine = createHdpEngine(4);

    expect(engine.getStatus()).toBe('IN_PROGRESS');
    for (const player of ['p1', 'p2', 'p3', 'p4']) {
      const hand = engine.getPlayerHand(player);
      expect(hand).toHaveLength(10);
      expect(hand.some((card) => card.type === 'PROMPT')).toBe(false);
    }

    const state = engine.getPublicState();
    expect(state.currentPhase).toBe('PREPARE');
    expect(state.submission?.phase).toBe('PREPARE');
    expect(state.submission?.judgeId).toBe('p1');
    expect(typeof state.submission?.promptCard?.metadata?.text).toBe('string');
    expect(state.awaitingPlayerIds).toEqual(['p1']);
  });

  it('runs a full round: confirm, hidden collection, judge pick, score and refill', () => {
    const engine = createHdpEngine(4);

    expect(engine.executeAction('p1', 'CONFIRM_PHASE').success).toBe(true);
    let state = engine.getPublicState();
    expect(state.currentPhase).toBe('COLLECT');
    expect(state.awaitingPlayerIds).toEqual(['p2', 'p3', 'p4']);
    expect(state.submission?.submissions).toHaveLength(0);

    expect(engine.executeAction('p2', 'SUBMIT_CARDS', { cardIds: [] }).success).toBe(false);
    expect(engine.executeAction('p1', 'SUBMIT_CARDS', { cardIds: [] }).success).toBe(false);

    submitFirstCards(engine, 'p2');
    submitFirstCards(engine, 'p3');
    submitFirstCards(engine, 'p4');

    state = engine.getPublicState();
    expect(state.currentPhase).toBe('JUDGING');
    expect(state.submission?.submissions).toHaveLength(3);
    expect(state.submission?.submissions.every((entry) => entry.playerId === undefined)).toBe(true);

    expect(engine.executeAction('p2', 'PICK_SUBMISSION', { submissionId: 'nope' }).success).toBe(
      false
    );

    const chosen = state.submission!.submissions[0];
    expect(engine.executeAction('p1', 'PICK_SUBMISSION', { submissionId: chosen.id }).success).toBe(
      true
    );

    state = engine.getPublicState();
    expect(state.currentPhase).toBe('SCORING');
    expect(state.submission?.phase).toBe('RESOLVED');
    expect(state.submission?.winnerSubmissionId).toBe(chosen.id);
    expect(state.scores?.[state.submission!.winnerPlayerId!]).toBe(1);

    const revealed = state.submission?.submissions.find((entry) => entry.id === chosen.id);
    expect(revealed?.playerId).toBe(state.submission?.winnerPlayerId);

    for (const player of ['p1', 'p2', 'p3', 'p4']) {
      expect(engine.getPlayerHand(player)).toHaveLength(10);
    }

    expect(engine.executeAction('p1', 'CONFIRM_PHASE').success).toBe(true);
    state = engine.getPublicState();
    expect(state.currentPhase).toBe('PREPARE');
    expect(state.submission?.judgeId).toBe('p2');
    expect(state.awaitingPlayerIds).toEqual(['p2']);
  });

  it('supports prompts that require more than one answer, preserving card order', () => {
    const engine = createHdpEngine(3);
    engine.executeAction('p1', 'CONFIRM_PHASE');

    const internal = engine as unknown as {
      submissionRound: { requiredPicks: number };
    };
    internal.submissionRound.requiredPicks = 2;

    const p2Hand = engine.getPlayerHand('p2');
    const chosenIds = [p2Hand[2].id, p2Hand[0].id];
    expect(engine.executeAction('p2', 'SUBMIT_CARDS', { cardIds: chosenIds }).success).toBe(true);

    const p3Hand = engine.getPlayerHand('p3');
    expect(
      engine.executeAction('p3', 'SUBMIT_CARDS', { cardIds: [p3Hand[0].id, p3Hand[1].id] }).success
    ).toBe(true);

    const state = engine.getPublicState();
    const p2Entry = state.submission!.submissions.find((entry) =>
      entry.cards.every((card) => chosenIds.includes(card.id))
    );
    expect(p2Entry?.cards.map((card) => card.id)).toEqual(chosenIds);
  });

  it('lets the judge exchange cards from hand without breaking the hand size', () => {
    const engine = createHdpEngine(4);
    const hand = engine.getPlayerHand('p1');
    const cardIds = hand.slice(0, 3).map((card) => card.id);

    const result = engine.executeAction('p1', 'EXCHANGE_CARDS', { cardIds });
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ exchanged: 3 });
    expect(engine.getPlayerHand('p1')).toHaveLength(10);
    expect(engine.getPlayerHand('p1').some((card) => cardIds.includes(card.id))).toBe(false);

    const otherHand = engine.getPlayerHand('p2');
    expect(
      engine.executeAction('p2', 'EXCHANGE_CARDS', { cardIds: [otherHand[0].id] }).success
    ).toBe(false);
  });

  it('finishes the match when a player reaches the score threshold', () => {
    const suddenDeath: GameSchemaDefinition = {
      ...hdpDefinition,
      rules: {
        ...hdpDefinition.rules,
        winCondition: { type: 'SCORE_THRESHOLD', targetScore: 1 },
        targetScore: 1,
      },
    };

    const engine = new ModularGameEngine(suddenDeath);
    engine.addPlayer('p1', 'Jugador 1');
    engine.addPlayer('p2', 'Jugador 2');
    engine.addPlayer('p3', 'Jugador 3');
    engine.start();

    engine.executeAction('p1', 'CONFIRM_PHASE');
    submitFirstCards(engine, 'p2');
    submitFirstCards(engine, 'p3');

    const submissionId = engine.getPublicState().submission!.submissions[0].id;
    expect(engine.executeAction('p1', 'PICK_SUBMISSION', { submissionId }).success).toBe(true);
    expect(engine.getStatus()).toBe('FINISHED');
    expect(['p2', 'p3']).toContain(engine.getWinnerId());
  });

  it('lets bots submit answers and judge the round', () => {
    const botEngine = new ModularGameEngine(hdpDefinition);
    botEngine.addPlayer('judge', 'Bot Juez', true);
    botEngine.addPlayer('human1', 'Humano 1');
    botEngine.addPlayer('human2', 'Humano 2');
    botEngine.start();

    botEngine.executeBotTurn('judge');
    expect(botEngine.getPublicState().submission?.phase).toBe('COLLECTING');

    submitFirstCards(botEngine, 'human1');
    submitFirstCards(botEngine, 'human2');
    expect(botEngine.getPublicState().submission?.phase).toBe('JUDGING');

    const winnerBefore = botEngine.getPublicState().submission?.winnerPlayerId ?? null;
    botEngine.executeBotTurn('judge');

    const state = botEngine.getPublicState();
    expect(state.submission?.phase).toBe('RESOLVED');
    expect(winnerBefore).toBeNull();
    expect(state.submission?.winnerPlayerId).not.toBeNull();
    expect(state.scores?.[state.submission!.winnerPlayerId!]).toBe(1);
  });

  it('works declaratively without phases, proving the capability is generic', () => {
    const genericGame: GameSchemaDefinition = {
      slug: 'generic-judge',
      title: 'Generic Judge Game',
      description: 'Judge game without explicit phases',
      deckConfig: { templates: getDeckPresetTemplates('HDP_DEMO') },
      rules: {
        initialHandSize: 3,
        minPlayers: 3,
        maxPlayers: 4,
        matchingProperties: [],
        allowWildOnAny: false,
        reshuffleDiscardPile: true,
        effects: {},
        winCondition: { type: 'SCORE_THRESHOLD', targetScore: 10 },
        zones: [],
        submission: {
          promptCardType: 'PROMPT',
          answerCardType: 'ANSWER',
          excludeJudge: true,
          picksFromPrompt: true,
          defaultPicks: 1,
          judgeExchange: true,
          refillToHandSize: true,
          pointsPerWin: 1,
        },
      },
    };

    const engine = new ModularGameEngine(genericGame);
    engine.addPlayer('a', 'Ana');
    engine.addPlayer('b', 'Beto');
    engine.addPlayer('c', 'Caro');
    engine.start();

    let state = engine.getPublicState();
    expect(state.submission?.phase).toBe('COLLECTING');
    expect(state.awaitingPlayerIds).toEqual(['b', 'c']);

    submitFirstCards(engine, 'b');
    submitFirstCards(engine, 'c');

    state = engine.getPublicState();
    expect(state.submission?.phase).toBe('JUDGING');
    const submissionId = state.submission!.submissions[0].id;
    expect(engine.executeAction('a', 'PICK_SUBMISSION', { submissionId }).success).toBe(true);

    state = engine.getPublicState();
    expect(state.submission?.phase).toBe('COLLECTING');
    expect(state.submission?.judgeId).toBe('b');
    const totalScore = Object.values(state.scores ?? {}).reduce((sum, score) => sum + score, 0);
    expect(totalScore).toBe(1);
  });
});
