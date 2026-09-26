import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/engine/state-machine.js';
import { colorMatchChaosDefinition } from '../../src/games/color-match-chaos/definition.js';
import { DeckManager } from '../../src/engine/deck.js';
import { getOfficialGame } from '../../src/games/registry.js';
import { GameRoom } from '../../src/realtime/room.js';
import { getColorMatchDefinition } from '../../src/games/color-match/definition.js';

const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

describe('ColorMatch Chaos Game Definition', () => {
  it('generates the complete chaos deck', () => {
    const deck = new DeckManager(colorMatchChaosDefinition.deckConfig);
    expect(deck.count).toBe(62);

    const cards = deck.rawCards;
    expect(cards.filter((c) => c.value === 'DISCARD_ALL').length).toBe(4);
    expect(cards.filter((c) => c.value === 'SWAP').length).toBe(4);
  });

  it('is accessible via getOfficialGame compatibility lookup', () => {
    const game = getOfficialGame(colorMatchChaosDefinition.slug);
    expect(game).toBeDefined();
    expect(game?.title).toBe('ColorMatch Chaos');
  });

  it('can be retrieved via getColorMatchDefinition("CHAOS")', () => {
    const chaos = getColorMatchDefinition('CHAOS');
    expect(chaos.rules.initialHandSize).toBe(6);
    expect(chaos.rules.effects?.SWAP).toBeDefined();
    expect(chaos.rules.effects?.DISCARD_ALL).toBeDefined();
  });
});

describe('ColorMatch Chaos Mechanics via GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(colorMatchChaosDefinition);
    engine.addPlayer('p1', 'Player 1');
    engine.addPlayer('p2', 'Player 2');
    engine.addPlayer('p3', 'Player 3');
  });

  it('initializes and deals 6 cards per player on start', () => {
    engine.start();
    const state = engine.getPublicState();

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.currentTurnPlayerId).toBe('p1');
    for (const player of state.players) {
      expect(player.cardCount).toBe(6);
    }
  });

  it('SWAP_HANDS swaps hands between the current player and the next player', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();

    const swapCard = { id: 'swap_card', type: 'WILD', color: 'ANY', value: 'SWAP' };
    const p1Other = { id: 'p1_other', type: 'NUMBER', color: 'RED', value: '1' };
    p1.hand = [swapCard, p1Other];

    const p2HandBefore = engine.getPlayerHand('p2');

    // WILD card requires a color choice, but hands swap immediately on play
    engine.playCard('p1', 'swap_card');

    expect(engine.getPublicState().pendingChoice?.playerId).toBe('p1');
    expect(engine.getPlayerHand('p1')).toEqual(p2HandBefore);
    expect(engine.getPlayerHand('p2')).toEqual([p1Other]);
  });

  it('DISCARD_ALL_COLOR discards every card of the matching color', () => {
    engine.start();
    const p1 = engine.getCurrentPlayer();
    const top = engine.getTopDiscardCard()!;
    const color = top.color!;
    const otherColor = COLORS.find((c) => c !== color)!;

    p1.hand = [
      { id: 'discard', type: 'ACTION', color, value: 'DISCARD_ALL' },
      { id: 'same1', type: 'NUMBER', color, value: '1' },
      { id: 'same2', type: 'ACTION', color, value: 'SKIP' },
      { id: 'other', type: 'NUMBER', color: otherColor, value: '2' },
    ];

    engine.playCard('p1', 'discard');

    const remaining = engine.getPlayerHand('p1');
    expect(remaining.map((c) => c.id)).toEqual(['other']);
  });
});

describe('ColorMatch Chaos via GameRoom configuration', () => {
  it('applies CHAOS rules when colorMatchMode is set to CHAOS on color-match room', () => {
    const base = getColorMatchDefinition('CLASSIC');
    const room = new GameRoom(
      'CHAS1',
      base,
      { id: 'p1', name: 'Alice', socketId: 's1', reconnectToken: 't1' },
      { colorMatchMode: 'CHAOS' }
    );
    room.addPlayer('p2', 'Bob', 's2', 't2');

    expect(room.definition.rules.initialHandSize).toBe(6);
    expect(room.definition.rules.effects?.SWAP).toBeDefined();
    expect(room.definition.rules.effects?.DISCARD_ALL).toBeDefined();
    expect(room.getPublicState().customState?.colorMatchMode).toBe('CHAOS');

    room.engine.start();
    expect(room.engine.getPlayerHand('p1').length).toBe(6);
    expect(room.engine.getPlayerHand('p2').length).toBe(6);
  });
});
