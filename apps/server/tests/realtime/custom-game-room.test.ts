import { describe, it, expect, vi } from 'vitest';

const store = vi.hoisted(() => ({
  games: new Map<string, Record<string, unknown>>(),
}));

vi.mock('../../src/db/prisma.js', () => ({
  prisma: {
    gameDefinition: {
      findFirst: vi.fn(async ({ where }: { where: { slug?: string } }) => {
        if (where?.slug) return store.games.get(where.slug) ?? null;
        return null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { slug?: string } }) => {
        if (where?.slug) return store.games.get(where.slug) ?? null;
        return null;
      }),
      findMany: vi.fn(async () => Array.from(store.games.values())),
    },
  },
}));

import { RoomManager } from '../../src/realtime/room-manager.js';
import { getDeckPresetTemplates } from '../../src/engine/capabilities/deck-presets.js';

function customGameRow(slug: string) {
  return {
    id: `game_${slug}`,
    slug,
    title: 'Mi Nuevo Juego',
    description: 'Juego creado en el editor visual.',
    isOfficial: false,
    isPublished: true,
    status: 'PUBLISHED',
    authorId: 'author_1',
    schemaJson: {
      slug,
      title: 'Mi Nuevo Juego',
      description: 'Juego creado en el editor visual.',
      deckConfig: { templates: getDeckPresetTemplates('SPANISH_40') },
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        initialHandSize: 3,
        matchingProperties: ['color', 'value'],
        allowWildOnAny: true,
        reshuffleDiscardPile: true,
        winCondition: { type: 'EMPTY_HAND' },
        zones: [
          { id: 'hand', name: 'Mano', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
          { id: 'draw_pile', name: 'Mazo', type: 'DRAW_PILE', visibility: 'HIDDEN' },
          { id: 'discard_pile', name: 'Descarte', type: 'DISCARD_PILE', visibility: 'PUBLIC' },
        ],
        phases: [
          {
            id: 'main',
            name: 'Turno Principal',
            allowedActions: ['PLAY_CARD', 'DRAW_CARD', 'PASS_TURN'],
          },
        ],
      },
    },
  };
}

describe('RoomManager with community games', () => {
  it('creates a room for a persisted custom game slug', async () => {
    store.games.set('mi-nuevo-juego', customGameRow('mi-nuevo-juego'));

    const manager = new RoomManager();
    const { room } = await manager.createRoom('mi-nuevo-juego', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    expect(room.code).toBeDefined();
    expect(room.getPublicState().gameMode).toBe('DISCARD');
    // The bot path reads room.definition.rules.effects directly.
    expect(room.definition.rules.effects).toEqual({});
  });

  it('still rejects unknown slugs', async () => {
    const manager = new RoomManager();
    await expect(
      manager.createRoom('no-existe-este-juego', {
        id: 'host_1',
        name: 'Alice',
        socketId: 'sock_1',
      })
    ).rejects.toThrow(/not found/i);
  });
});
