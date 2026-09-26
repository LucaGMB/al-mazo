import { describe, it, expect } from 'vitest';
import { ModularGameEngine } from '../../src/engine/modular-engine.js';
import { GameSchemaDefinition } from '../../src/engine/types.js';
import { colorMatchDefinition } from '../../src/games/color-match/definition.js';
import { colorMatchBlitzDefinition } from '../../src/games/color-match-blitz/definition.js';
import { colorMatchChaosDefinition } from '../../src/games/color-match-chaos/definition.js';
import { descarteCriolloDefinition } from '../../src/games/descarte-criollo/definition.js';
import { chinchonDefinition } from '../../src/games/chinchon/definition.js';
import { escobaDefinition } from '../../src/games/escoba/definition.js';
import { trucoDefinition } from '../../src/games/truco/definition.js';

const CASES: Array<[string, GameSchemaDefinition, 'TRICK' | 'COMMUNITY' | 'DISCARD']> = [
  ['color-match', colorMatchDefinition, 'DISCARD'],
  ['color-match-blitz', colorMatchBlitzDefinition, 'DISCARD'],
  ['color-match-chaos', colorMatchChaosDefinition, 'DISCARD'],
  ['descarte-criollo', descarteCriolloDefinition, 'DISCARD'],
  ['chinchon', chinchonDefinition, 'DISCARD'],
  ['escoba-del-15', escobaDefinition, 'COMMUNITY'],
  ['truco', trucoDefinition, 'TRICK'],
];

function startEngine(definition: GameSchemaDefinition): ModularGameEngine {
  const engine = new ModularGameEngine(definition);
  engine.addPlayer('p1', 'Player 1');
  engine.addPlayer('p2', 'Player 2');
  engine.start();
  return engine;
}

describe('PublicGameState.gameMode', () => {
  it.each(CASES)('%s expone el modo %s antes de empezar', (_slug, definition, expected) => {
    const engine = new ModularGameEngine(definition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');

    expect(engine.gameMode).toBe(expected);
    expect(engine.getPublicState().gameMode).toBe(expected);
  });

  it.each(CASES)('%s mantiene el modo %s con la partida iniciada', (_slug, definition, expected) => {
    const engine = startEngine(definition);
    const state = engine.getPublicState();

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.gameMode).toBe(expected);
  });

  it('no confunde una mesa comunitaria con una mesa de bazas', () => {
    const escoba = startEngine(escobaDefinition);
    const truco = startEngine(trucoDefinition);

    expect(escoba.isCommunityGame()).toBe(true);
    expect(escoba.isRoundTrickGame).toBe(false);
    expect(escoba.getPublicState().gameMode).toBe('COMMUNITY');

    expect(truco.isRoundTrickGame).toBe(true);
    expect(truco.isCommunityGame()).toBe(false);
    expect(truco.getPublicState().gameMode).toBe('TRICK');
  });

  it('detecta juegos comunitarios personalizados por su zone COMMUNITY', () => {
    const custom: GameSchemaDefinition = {
      ...colorMatchDefinition,
      slug: 'custom-community-game',
      rules: {
        ...colorMatchDefinition.rules,
        zones: [{ id: 'table', name: 'Mesa', type: 'COMMUNITY', visibility: 'PUBLIC' }],
        customState: { initialTableCards: 4 },
      },
    };

    expect(startEngine(custom).gameMode).toBe('COMMUNITY');
  });

  it('el rules.gameMode explícito manda sobre los heurísticos', () => {
    const asTrick: GameSchemaDefinition = {
      ...colorMatchDefinition,
      slug: 'color-match-as-trick',
      rules: { ...colorMatchDefinition.rules, gameMode: 'TRICK' },
    };
    const asDiscard: GameSchemaDefinition = {
      ...colorMatchDefinition,
      slug: 'color-match-as-discard',
      rules: {
        ...colorMatchDefinition.rules,
        gameMode: 'DISCARD',
        zones: [{ id: 'table', name: 'Mesa', type: 'COMMUNITY', visibility: 'PUBLIC' }],
        customState: { initialTableCards: 4 },
      },
    };
    const asPrompt: GameSchemaDefinition = {
      ...colorMatchDefinition,
      slug: 'color-match-as-prompt',
      rules: { ...colorMatchDefinition.rules, gameMode: 'PROMPT' },
    };

    const trick = startEngine(asTrick);
    expect(trick.isRoundTrickGame).toBe(true);
    expect(trick.isCommunityGame()).toBe(false);
    expect(trick.getPublicState().gameMode).toBe('TRICK');
    expect(trick.getPublicState().currentPhase).toBeDefined();

    const discard = startEngine(asDiscard);
    expect(discard.isCommunityGame()).toBe(false);
    expect(discard.getPublicState().gameMode).toBe('DISCARD');
    expect(discard.getPublicState().currentPhase).toBeDefined();

    const prompt = startEngine(asPrompt);
    expect(prompt.isPromptGame).toBe(true);
    expect(prompt.isRoundTrickGame).toBe(false);
    expect(prompt.getPublicState().gameMode).toBe('PROMPT');
  });

  it('en escoba el pozo inicial no se pisa con el estado inicial del definition', () => {
    const engine = startEngine(escobaDefinition);
    const state = engine.getPublicState();

    // 4 cartas en la mesa salvo que se haya aplicado la regla especial del reparto.
    expect((state.tableCards ?? []).length).toBeLessThanOrEqual(4);
    expect(state.customState?.tableCards).toBeDefined();
    expect(engine.getPlayerHand('p1')).toHaveLength(escobaDefinition.rules.initialHandSize);
  });
});
