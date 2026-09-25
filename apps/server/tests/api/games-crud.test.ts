import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { signToken } from '../../src/modules/auth/auth.middleware.js';

const validGame = {
  title: 'Test Game',
  description: 'A community game used by tests',
  deckConfig: {
    templates: [{ count: 4, type: 'NUMBER', color: 'RED', value: '1' }],
  },
  rules: {
    minPlayers: 2,
    maxPlayers: 4,
    matchingProperties: ['color', 'value'],
    winCondition: { type: 'EMPTY_HAND' },
  },
};

describe('Games CRUD API', () => {
  let app: FastifyInstance;
  const token = signToken({ userId: 'test-author', role: 'USER' });
  const authHeader = { authorization: `Bearer ${token}` };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/games/capabilities returns the capabilities manifest', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/games/capabilities' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.actions).toBeInstanceOf(Array);
    expect(body.conditions).toBeInstanceOf(Array);
    expect(body.effects).toBeInstanceOf(Array);
    expect(body.zones).toBeInstanceOf(Array);
    expect(body.deckPresets).toBeInstanceOf(Array);
    expect(body.effects.length).toBeGreaterThan(0);
  });

  it('POST /api/games/validate accepts a valid schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games/validate',
      payload: validGame,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.valid).toBe(true);
    expect(body.errors).toBeUndefined();
  });

  it('POST /api/games/validate rejects an invalid schema with errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games/validate',
      payload: { title: 'x', slug: 'BAD SLUG', rules: { minPlayers: 1 } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('POST /api/games requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: validGame,
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /api/games rejects anonymous guest tokens', async () => {
    const guestToken = signToken({ userId: 'guest_12345', role: 'USER' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: { authorization: `Bearer ${guestToken}` },
      payload: validGame,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Exclusivo para jugadores registrados');
  });

  it('POST /api/games creates a DRAFT game and generates a slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: authHeader,
      payload: { ...validGame, title: 'My Draft Game' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.game.id).toBeDefined();
    expect(body.game.slug).toBe('my-draft-game');
    expect(body.game.status).toBe('DRAFT');
    expect(body.game.isOfficial).toBe(false);
    expect(body.game.authorId).toBe('test-author');
  });

  it('POST /api/games rejects an invalid schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: authHeader,
      payload: { ...validGame, title: 'No', rules: { minPlayers: 1 } },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('GET /api/games supports type and search filters', async () => {
    const official = await app.inject({ method: 'GET', url: '/api/games?type=official' });
    const officialBody = JSON.parse(official.body);
    expect(officialBody.games.length).toBeGreaterThan(0);
    expect(officialBody.games.every((g: { isOfficial: boolean }) => g.isOfficial)).toBe(true);

    const search = await app.inject({ method: 'GET', url: '/api/games?search=color' });
    const searchBody = JSON.parse(search.body);
    expect(
      searchBody.games.some((g: { slug: string }) => g.slug.startsWith('color-match'))
    ).toBe(true);
  });

  it('PUT /api/games/:id updates an owned game', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: authHeader,
      payload: { ...validGame, title: 'Updatable Game' },
    });
    const gameId = JSON.parse(created.body).game.id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/games/${gameId}`,
      headers: authHeader,
      payload: { title: 'Updated Game' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.game.title).toBe('Updated Game');
  });

  it('POST /api/games/:id/publish publishes a valid game', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: authHeader,
      payload: { ...validGame, title: 'Publishable Game' },
    });
    const gameId = JSON.parse(created.body).game.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/publish`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.game.status).toBe('PUBLISHED');
  });

  it('POST /api/games/:id/fork clones an official game as a DRAFT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games/color-match/fork',
      headers: authHeader,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.game.status).toBe('DRAFT');
    expect(body.game.slug).not.toBe('color-match');
    expect(body.game.authorId).toBe('test-author');
    expect(body.game.deckConfig).toBeDefined();
  });
});