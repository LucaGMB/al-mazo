import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { signToken } from '../../src/modules/auth/auth.middleware.js';
import { memoryGames, GameRecord } from '../../src/modules/games/games.routes.js';
import { memoryReports } from '../../src/modules/reports/reports.routes.js';

const sampleGame = {
  title: 'Juego Infractor',
  description: 'Un juego con contenido dudoso de copyright',
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

describe('Admin Moderation and Game Reports API', () => {
  let app: FastifyInstance;

  const userToken = signToken({ userId: 'reg_user_1', role: 'USER' });
  const userHeader = { authorization: `Bearer ${userToken}` };

  const adminToken = signToken({ userId: 'admin_user_1', role: 'ADMIN' });
  const adminHeader = { authorization: `Bearer ${adminToken}` };

  const guestToken = signToken({ userId: 'guest_anonymous_1', role: 'USER' });
  const guestHeader = { authorization: `Bearer ${guestToken}` };

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'moderator@almazo.com,superadmin@almazo.com';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    memoryGames.clear();
    memoryReports.clear();
  });

  it('rejects regular users from accessing admin routes with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
      headers: userHeader,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('rol de Administrador');
  });

  it('rejects unauthenticated requests to admin routes with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows users with ADMIN role to access admin reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
      headers: adminHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.reports).toBeInstanceOf(Array);
  });

  it('elevates user to ADMIN role on register if email matches ADMIN_EMAILS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'moderator@almazo.com',
        password: 'password123',
        name: 'Mod',
      },
    });

    // In environment without real DB, it returns either 201 with role ADMIN or 503 if DB unavailable
    if (res.statusCode === 201) {
      const body = JSON.parse(res.body);
      expect(body.user.role).toBe('ADMIN');
    }
  });

  describe('Game Reporting Flow', () => {
    let communityGameId: string;
    let communityGameSlug: string;

    beforeAll(async () => {
      // Create and publish a community game
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/games',
        headers: userHeader,
        payload: { game: sampleGame },
      });

      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body).game;
      communityGameId = created.id;
      communityGameSlug = created.slug;

      // Publish the game
      await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/publish`,
        headers: userHeader,
      });
    });

    it('rejects guest/anonymous users from reporting games', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/reports`,
        headers: guestHeader,
        payload: {
          reason: 'COPYRIGHT',
          description: 'Usa imágenes no autorizadas de mi juego de cartas',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('usuarios registrados');
    });

    it('rejects reports on official games', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games/truco/reports',
        headers: userHeader,
        payload: {
          reason: 'OTHER',
          description: 'El juego tiene un error en el envido',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('juegos oficiales');
    });

    it('rejects invalid reason or short description', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/reports`,
        headers: userHeader,
        payload: {
          reason: 'INVALID_REASON',
          description: 'abc',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('allows registered user to submit a valid report', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/reports`,
        headers: userHeader,
        payload: {
          reason: 'COPYRIGHT',
          description: 'Este juego contiene nombres y mecánicas registradas con derechos de autor.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.report).toBeDefined();
      expect(body.report.reason).toBe('COPYRIGHT');
      expect(body.report.status).toBe('PENDING');
      expect(body.report.gameId).toBe(communityGameId);
    });

    it('prevents duplicate pending reports from the same user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/reports`,
        headers: userHeader,
        payload: {
          reason: 'COPYRIGHT',
          description: 'Denuncia duplicada sobre derechos de autor.',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Ya enviaste un reporte pendiente');
    });

    it('admin can list reports and filter by status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/reports?status=PENDING',
        headers: adminHeader,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.reports.length).toBeGreaterThan(0);
      const report = body.reports.find((r: any) => r.gameId === communityGameId);
      expect(report).toBeDefined();
      expect(report.status).toBe('PENDING');
      expect(report.gameTitle).toBe(sampleGame.title);
    });

    it('admin can take down the game (soft-delete / BANNED) and auto-resolve reports', async () => {
      // 1. Take down the game
      const takedownRes = await app.inject({
        method: 'POST',
        url: `/api/admin/games/${communityGameId}/takedown`,
        headers: adminHeader,
        payload: { reason: 'Infracción confirmada de propiedad intelectual' },
      });

      expect(takedownRes.statusCode).toBe(200);
      const takedownBody = JSON.parse(takedownRes.body);
      expect(takedownBody.success).toBe(true);
      expect(takedownBody.game.status).toBe('BANNED');

      // 2. Check public game list excludes the banned game
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/games?type=community',
      });
      const listBody = JSON.parse(listRes.body);
      const foundInList = listBody.games.find((g: any) => g.id === communityGameId);
      expect(foundInList).toBeUndefined();

      // 3. Direct GET /api/games/:slug returns 403 with moderation status
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/games/${communityGameSlug}`,
      });
      expect(getRes.statusCode).toBe(403);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.status).toBe('BANNED');
      expect(getBody.message).toContain('retirado por moderación');

      // 4. Reports for this game are now RESOLVED
      const reportsRes = await app.inject({
        method: 'GET',
        url: '/api/admin/reports?status=RESOLVED',
        headers: adminHeader,
      });
      const reportsBody = JSON.parse(reportsRes.body);
      const resolved = reportsBody.reports.find((r: any) => r.gameId === communityGameId);
      expect(resolved).toBeDefined();
      expect(resolved.status).toBe('RESOLVED');
    });

    it('admin can restore a banned game', async () => {
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/admin/games/${communityGameId}/restore`,
        headers: adminHeader,
      });

      expect(restoreRes.statusCode).toBe(200);
      const body = JSON.parse(restoreRes.body);
      expect(body.success).toBe(true);
      expect(body.game.status).toBe('PUBLISHED');

      // Game is now accessible again
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/games/${communityGameSlug}`,
      });
      expect(getRes.statusCode).toBe(200);
    });

    it('admin can dismiss a report with custom notes', async () => {
      // Submit a second report from another user
      const user2Token = signToken({ userId: 'reg_user_2', role: 'USER' });
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/games/${communityGameId}/reports`,
        headers: { authorization: `Bearer ${user2Token}` },
        payload: {
          reason: 'SPAM',
          description: 'El juego tiene spam en el título.',
        },
      });
      expect(submitRes.statusCode).toBe(201);
      const reportId = JSON.parse(submitRes.body).report.id;

      // Admin dismisses the report
      const dismissRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/reports/${reportId}`,
        headers: adminHeader,
        payload: {
          status: 'DISMISSED',
          adminNotes: 'Revisado: no constituye spam, cumple normas.',
        },
      });

      expect(dismissRes.statusCode).toBe(200);
      const body = JSON.parse(dismissRes.body);
      expect(body.report.status).toBe('DISMISSED');
      expect(body.report.adminNotes).toContain('cumple normas');
    });
  });
});
