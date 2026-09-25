import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Fastify REST API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 and status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.services).toBeDefined();
  });

  it('GET /api/games lists official games including ColorMatch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/games',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.games).toBeInstanceOf(Array);
    const colorMatch = body.games.find((g: { slug: string }) => g.slug === 'color-match');
    expect(colorMatch).toBeDefined();
    expect(colorMatch.isOfficial).toBe(true);
  });

  it('GET /api/games/color-match returns full declarative schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/games/color-match',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.game.slug).toBe('color-match');
    expect(body.game.deckConfig).toBeDefined();
    expect(body.game.rules.matchingProperties).toEqual(['color', 'value']);
  });

  it('POST /api/auth/guest generates anonymous user session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      payload: { name: 'PlayerTester' },
    });

    expect([200, 201]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(body.user.id).toBeDefined();
    expect(body.user.name).toBe('PlayerTester');
    expect(body.user.isAnonymous).toBe(true);
  });

  it('POST /api/matches/sync validates schema and rejects malformed payloads', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/sync',
      payload: {
        gameSlug: 'color-match',
        // missing startedAt, durationSec, participants
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Validation failed');
  });

  it('GET /api/users/:id/matches returns a matches array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/nonexistent-user/matches',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.matches).toBeInstanceOf(Array);
  });

  it('PATCH /api/users/:id updates the display name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/some-user',
      payload: { name: 'NuevoNombre' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.id).toBe('some-user');
    expect(body.user.name).toBe('NuevoNombre');
  });

  it('PATCH /api/users/:id rejects empty or too-long names', async () => {
    const empty = await app.inject({
      method: 'PATCH',
      url: '/api/users/some-user',
      payload: { name: '   ' },
    });
    expect(empty.statusCode).toBe(400);

    const tooLong = await app.inject({
      method: 'PATCH',
      url: '/api/users/some-user',
      payload: { name: 'x'.repeat(31) },
    });
    expect(tooLong.statusCode).toBe(400);
  });
});
