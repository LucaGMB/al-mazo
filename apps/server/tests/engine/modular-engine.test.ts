import { describe, it, expect, beforeEach } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { colorMatchDefinition } from '../../src/games/color-match/definition.js';
import { getDeckPresetTemplates } from '../../src/engine/capabilities/deck-presets.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';

const bettingDefinition: GameSchemaDefinition = {
  slug: 'betting-duo',
  title: 'Betting Duo',
  description: 'Phase based test game for the modular engine',
  deckConfig: { templates: getDeckPresetTemplates('SPANISH_40') },
  rules: {
    initialHandSize: 3,
    minPlayers: 2,
    maxPlayers: 2,
    matchingProperties: ['color', 'value'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    effects: {},
    winCondition: { type: 'SCORE_THRESHOLD', targetScore: 2 },
    targetScore: 2,
    customState: { round: 1 },
    phases: [
      {
        id: 'BETTING',
        name: 'Betting',
        allowedActions: ['CALL_BET', 'FOLD'],
        nextPhase: 'PLAYING',
        onEnter: [{ type: 'SET_ACTIVE_COLOR', params: { color: 'OROS' } }],
      },
      {
        id: 'PLAYING',
        name: 'Playing',
        allowedActions: ['PLAY_CARD', 'DRAW_CARD', 'PASS_TURN'],
        nextPhase: 'SCORING',
      },
      {
        id: 'SCORING',
        name: 'Scoring',
        allowedActions: [],
        nextPhase: 'BETTING',
        onEnter: [{ type: 'AWARD_POINTS', params: { playerId: 'p1', amount: 2 } }],
      },
    ],
  },
};

const trickDefinition: GameSchemaDefinition = {
  slug: 'trick-duo',
  title: 'Trick Duo',
  description: 'Trick taking test game for the modular engine',
  deckConfig: { templates: getDeckPresetTemplates('SPANISH_40') },
  rules: {
    initialHandSize: 2,
    minPlayers: 2,
    maxPlayers: 2,
    matchingProperties: ['color'],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    effects: {},
    winCondition: { type: 'SCORE_THRESHOLD', targetScore: 1 },
    targetScore: 1,
    cardHierarchy: {
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '10': 8,
      '11': 9,
      '12': 10,
    },
    phases: [
      {
        id: 'PLAY',
        name: 'Play',
        allowedActions: ['PLAY_CARD', 'DRAW_CARD', 'PASS_TURN'],
        nextPhase: 'SCORE',
      },
      {
        id: 'SCORE',
        name: 'Score',
        allowedActions: [],
        nextPhase: 'PLAY',
        onEnter: [{ type: 'RESOLVE_TRICK' }],
      },
    ],
  },
};

describe('ModularGameEngine - ColorMatch backward compatibility', () => {
  let engine: ModularGameEngine;

  beforeEach(() => {
    engine = new ModularGameEngine(colorMatchDefinition);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.addPlayer('p3', 'Charlie');
    engine.start();
  });

  it('starts with dealt hands and no phase/custom state', () => {
    expect(engine.getStatus()).toBe('IN_PROGRESS');
    expect(engine.getWinnerId()).toBeNull();
    expect(engine.getPlayerHand('p1').length).toBe(7);

    const state = engine.getPublicState();
    expect(state.currentPhase).toBeNull();
    expect(state.topDiscardCard).toBeDefined();
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('supports executeAction for traditional actions', () => {
    expect(engine.executeAction('p1', 'DRAW_CARD').success).toBe(true);
    expect(engine.getPlayerHand('p1').length).toBe(8);

    expect(engine.executeAction('p1', 'PASS_TURN').success).toBe(true);
    expect(engine.executeAction('p1', 'DRAW_CARD').success).toBe(false);
    expect(engine.executeAction('nope', 'DRAW_CARD').success).toBe(false);
    expect(engine.executeAction('p2', 'NOT_AN_ACTION').success).toBe(false);
  });

  it('reports a winner when the last card is played', () => {
    const top = engine.getTopDiscardCard()!;
    engine.getCurrentPlayer().hand = [
      { id: 'win_card', type: 'NUMBER', color: top.color, value: top.value },
    ];

    engine.playCard('p1', 'win_card');

    expect(engine.getStatus()).toBe('FINISHED');
    expect(engine.getWinnerId()).toBe('p1');
  });
});

describe('ModularGameEngine - phase and action based game', () => {
  let engine: ModularGameEngine;

  beforeEach(() => {
    engine = new ModularGameEngine(bettingDefinition);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.start();
  });

  it('enters the initial phase and applies onEnter effects', () => {
    const state = engine.getPublicState();
    expect(state.currentPhase).toBe('BETTING');
    expect(state.activeColor).toBe('OROS');
    expect(state.customState?.round).toBe(1);
  });

  it('enforces phase action whitelists and conditions', () => {
    // PLAY_CARD is not allowed during the BETTING phase
    expect(engine.executeAction('p1', 'PLAY_CARD', { cardId: 'x' }).success).toBe(false);
    // Non-active player cannot act
    expect(engine.executeAction('p2', 'CALL_BET', { amount: 5 }).success).toBe(false);
  });

  it('transitions phases and awards a score-based win', () => {
    const bet = engine.executeAction('p1', 'CALL_BET', { amount: 5 });
    expect(bet.success).toBe(true);

    let state = engine.getPublicState();
    expect(state.currentPhase).toBe('PLAYING');
    expect(state.customState?.betPending).toBe(true);
    expect((state.activeBets?.p1 as { amount?: number }).amount).toBe(5);

    // Repeating the bet is now rejected by the new phase
    expect(engine.executeAction('p1', 'CALL_BET').success).toBe(false);

    expect(engine.executeAction('p1', 'DRAW_CARD').success).toBe(true);
    expect(engine.executeAction('p1', 'PASS_TURN').success).toBe(true);

    state = engine.getPublicState();
    expect(state.currentPhase).toBe('SCORING');
    expect(state.scores?.p1).toBe(2);
    expect(engine.getStatus()).toBe('FINISHED');
    expect(engine.getWinnerId()).toBe('p1');
  });
});

describe('ModularGameEngine - tricks and scoring', () => {
  it('records trick cards and resolves the highest card as winner', () => {
    const engine = new ModularGameEngine(trickDefinition);
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.start();

    const color = engine.getTopDiscardCard()!.color;
    engine.getCurrentPlayer().hand = [
      { id: 'a', type: 'NUMBER', color, value: '12' },
      { id: 'x', type: 'NUMBER', color, value: '1' },
    ];
    expect(engine.executeAction('p1', 'PLAY_CARD', { cardId: 'a' }).success).toBe(true);

    const p2 = engine.getPublicState().players.find((p) => p.id === 'p2')!;
    expect(p2.id).toBe('p2');
    engine.getCurrentPlayer().hand = [
      { id: 'b', type: 'NUMBER', color, value: '1' },
      { id: 'y', type: 'NUMBER', color, value: '2' },
    ];
    expect(engine.executeAction('p2', 'PLAY_CARD', { cardId: 'b' }).success).toBe(true);

    let state = engine.getPublicState();
    expect(state.trickCards?.length).toBe(2);

    expect(engine.executeAction('p1', 'DRAW_CARD').success).toBe(true);
    expect(engine.executeAction('p1', 'PASS_TURN').success).toBe(true);

    state = engine.getPublicState();
    expect(state.currentPhase).toBe('SCORE');
    expect(state.trickCards?.length).toBe(0);
    expect(state.scores?.p1).toBe(1);
    expect(engine.getWinnerId()).toBe('p1');
  });
});

describe('ModularGameEngine - Custom Editor Trick & Betting Game', () => {
  const customTrickGame: GameSchemaDefinition = {
    slug: 'mi-truco-personalizado',
    title: 'Mi Truco Personalizado',
    description: 'Juego de bazas creado en el editor visual',
    deckConfig: { templates: getDeckPresetTemplates('SPANISH_40') },
    rules: {
      initialHandSize: 3,
      minPlayers: 2,
      maxPlayers: 2,
      matchingProperties: [],
      allowWildOnAny: false,
      reshuffleDiscardPile: false,
      effects: {},
      cardHierarchy: {
        '1 ESPADAS': 14,
        '1 BASTOS': 13,
        '7 ESPADAS': 12,
        '7 OROS': 11,
        '3': 10,
        '2': 9,
        '1 OROS': 8,
        '1 COPAS': 8,
        '12': 7,
        '11': 6,
        '10': 5,
        '7 BASTOS': 4,
        '7 COPAS': 4,
        '6': 3,
        '5': 2,
        '4': 1,
      },
      winCondition: { type: 'SCORE_THRESHOLD', targetScore: 15 },
      targetScore: 15,
      zones: [
        { id: 'hand', name: 'Mano', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
        { id: 'trick_table', name: 'Mesa de Bazas', type: 'TRICK_TABLE', visibility: 'PUBLIC' },
      ],
      phases: [
        {
          id: 'ENVIDO_PHASE',
          name: 'Envido',
          allowedActions: ['CALL_ENVIDO', 'CALL_REAL_ENVIDO', 'CALL_FALTA_ENVIDO', 'RESPOND_BET', 'FOLD'],
        },
        {
          id: 'TRICK_PLAY',
          name: 'Bazas',
          allowedActions: ['PLAY_CARD', 'CALL_TRUCO', 'CALL_RETRUCO', 'CALL_VALE_CUATRO', 'RESPOND_BET', 'FOLD'],
        },
      ],
    },
  };

  it('runs custom trick game end-to-end on ModularGameEngine', () => {
    const engine = new ModularGameEngine(customTrickGame);
    engine.addPlayer('jugador1', 'Carlos');
    engine.addPlayer('jugador2', 'Ana');
    engine.start();

    expect(engine.isRoundTrickGame).toBe(true);
    expect(engine.getStatus()).toBe('IN_PROGRESS');
    expect(engine.getPlayerHand('jugador1')).toHaveLength(3);
    expect(engine.getPlayerHand('jugador2')).toHaveLength(3);

    // Call envido
    const envidoCall = engine.executeAction('jugador1', 'CALL_ENVIDO');
    expect(envidoCall.success).toBe(true);

    // Rival responds quiero
    const quiero = engine.executeAction('jugador2', 'QUIERO');
    expect(quiero.success).toBe(true);

    const afterEnvido = engine.getPublicState();
    expect((afterEnvido.customState as any).envido.state).toBe('RESOLVED');
    expect(afterEnvido.scores?.jugador1! + afterEnvido.scores?.jugador2!).toBe(2);

    // Play trick cards
    const h1 = engine.getPlayerHand('jugador1')[0];
    const play1 = engine.executeAction('jugador1', 'PLAY_CARD', { cardId: h1.id });
    expect(play1.success).toBe(true);

    const h2 = engine.getPlayerHand('jugador2')[0];
    const play2 = engine.executeAction('jugador2', 'PLAY_CARD', { cardId: h2.id });
    expect(play2.success).toBe(true);

    const afterTrick1 = engine.getPublicState();
    expect((afterTrick1.customState as any).roundTricks).toHaveLength(1);
    expect((afterTrick1.customState as any).currentTrick).toBe(2);
  });
});