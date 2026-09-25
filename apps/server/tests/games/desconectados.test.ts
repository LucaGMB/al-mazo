import { describe, it, expect } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { desconectadosDefinition } from '../../src/games/desconectados/definition.js';
import {
  BLANK_CARD_COUNT,
  PROMPT_CATEGORIES,
} from '../../src/games/desconectados/questions.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { validateGameSchema } from '../../src/modules/games/games.validator.js';

describe('Desconectados Game Definition', () => {
  it('ships four categories with 48 questions each', () => {
    expect(PROMPT_CATEGORIES).toHaveLength(4);
    for (const category of PROMPT_CATEGORIES) {
      expect(category.questions).toHaveLength(48);
      expect(category.questions.every((question) => question.trim().length > 0)).toBe(true);
    }
  });

  it('builds a 200-card deck with prompts and blanks', () => {
    const templates = desconectadosDefinition.deckConfig.templates;
    const total = templates.reduce((sum, template) => sum + template.count, 0);
    expect(total).toBe(192 + BLANK_CARD_COUNT);

    const prompts = templates.filter((template) => template.type === 'PROMPT');
    expect(prompts).toHaveLength(192);
    expect(prompts.every((template) => template.metadata?.question)).toBe(true);

    const blanks = templates.filter((template) => template.type === 'BLANK');
    expect(blanks.reduce((sum, template) => sum + template.count, 0)).toBe(BLANK_CARD_COUNT);
  });

  it('declares a no-winner prompt game and passes schema validation', () => {
    expect(desconectadosDefinition.rules.winCondition.type).toBe('NONE');
    expect(desconectadosDefinition.rules.initialHandSize).toBe(0);
    expect(desconectadosDefinition.rules.gameMode).toBe('PROMPT');
    expect(desconectadosDefinition.rules.phases?.[0].allowedActions).toEqual([
      'REVEAL_CARD',
      'END_GAME',
    ]);

    const validation = validateGameSchema(desconectadosDefinition);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toBeUndefined();
  });

  it('is registered as an official game', () => {
    expect(getOfficialGame('desconectados')).toBe(desconectadosDefinition);
  });
});

describe('Desconectados Mechanics', () => {
  function startedEngine(): ModularGameEngine {
    const engine = new ModularGameEngine(desconectadosDefinition);
    engine.addPlayer('p1', 'Ana');
    engine.addPlayer('p2', 'Beto');
    engine.start();
    return engine;
  }

  it('opens with a public prompt and no cards in hand', () => {
    const engine = startedEngine();
    const state = engine.getPublicState();

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.currentPhase).toBe('PROMPT');
    expect(['PROMPT', 'BLANK']).toContain(state.topDiscardCard?.type);
    expect(state.topDiscardCard?.metadata?.question).toBeDefined();
    expect(state.drawPileCount).toBe(199);
    expect(engine.getPlayerHand('p1')).toHaveLength(0);
    expect(state.gameMode).toBe('PROMPT');
  });

  it('reveals the next prompt and passes the turn', () => {
    const engine = startedEngine();
    const firstCardId = engine.getPublicState().topDiscardCard?.id;

    const result = engine.executeAction('p1', 'REVEAL_CARD');
    expect(result.success).toBe(true);

    const state = engine.getPublicState();
    expect(state.topDiscardCard?.id).not.toBe(firstCardId);
    expect(state.topDiscardCard?.metadata?.category).toBeTruthy();
    expect(state.drawPileCount).toBe(198);
    expect(state.currentTurnPlayerId).toBe('p2');
  });

  it('rejects the reveal when the deck is empty and finishes without winner', () => {
    const engine = startedEngine();

    for (let i = 0; i < 199; i++) {
      const currentTurn = engine.getPublicState().currentTurnPlayerId;
      expect(currentTurn).toBeTruthy();
      expect(engine.executeAction(currentTurn as string, 'REVEAL_CARD').success).toBe(true);
    }

    expect(engine.getPublicState().drawPileCount).toBe(0);
    const currentTurn = engine.getPublicState().currentTurnPlayerId as string;
    expect(engine.executeAction(currentTurn, 'REVEAL_CARD').success).toBe(false);

    const end = engine.executeAction(currentTurn, 'END_GAME');
    expect(end.success).toBe(true);

    const state = engine.getPublicState();
    expect(state.status).toBe('FINISHED');
    expect(state.winnerId).toBeNull();
  });
});
