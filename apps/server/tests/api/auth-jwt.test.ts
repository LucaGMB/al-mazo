import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';

const store = vi.hoisted(() => ({
  users: new Map<string, any>(),
  idCounter: 0,
}));

vi.mock('../../src/db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return store.users.get(where.email) ?? null;
        for (const u of store.users.values()) {
          if (u.id === where.id) return u;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where }: { where: any }) => {
        for (const cond of where?.OR ?? []) {
          if (cond.email && store.users.has(cond.email)) return store.users.get(cond.email);
          for (const u of store.users.values()) {
            if (cond.name && u.name === cond.name) return u;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const user = { id: `user_${++store.idCounter}`, createdAt: new Date(), ...data };
        if (user.email) store.users.set(user.email as string, user);
        return user;
      }),
    },
  },
}));

import { buildApp } from '../../src/app.js';

describe('JWT auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    store.users.clear();
    store.idCounter = 0;
  });

  async function register(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/api/auth/register', payload });
  }

  it('registers a user and returns a token', async () => {
    const res = await register({ email: 'ana@example.com', password: 'secret123', name: 'Ana' });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user).toMatchObject({ email: 'ana@example.com', name: 'Ana', role: 'USER' });
    expect(body.user.id).toBeDefined();
    expect(typeof body.token).toBe('string');
  });

  it('rejects invalid registration payloads', async () => {
    const badEmail = await register({ email: 'not-an-email', password: 'secret123' });
    expect(badEmail.statusCode).toBe(400);

    const shortPassword = await register({ email: 'bob@example.com', password: '123' });
    expect(shortPassword.statusCode).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    await register({ email: 'dup@example.com', password: 'secret123' });
    const res = await register({ email: 'dup@example.com', password: 'secret123' });
    expect(res.statusCode).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    await register({ email: 'caro@example.com', password: 'secret123', name: 'Caro' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'caro@example.com', password: 'secret123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('caro@example.com');
    expect(typeof body.token).toBe('string');
  });

  it('logs in with username instead of email', async () => {
    await register({ email: 'felix@example.com', password: 'secret123', name: 'felix' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'felix', password: 'secret123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.name).toBe('felix');
  });

  it('rejects wrong password and unknown email', async () => {
    await register({ email: 'dani@example.com', password: 'secret123' });

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'dani@example.com', password: 'wrongpass' },
    });
    expect(wrong.statusCode).toBe(401);

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'secret123' },
    });
    expect(unknown.statusCode).toBe(401);
  });

  it('GET /api/auth/me requires a valid token', async () => {
    const missing = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(missing.statusCode).toBe(401);

    const invalid = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(invalid.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns the authenticated user', async () => {
    const reg = await register({ email: 'eve@example.com', password: 'secret123', name: 'Eve' });
    const { token } = JSON.parse(reg.body);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user).toMatchObject({ email: 'eve@example.com', name: 'Eve', role: 'USER' });
  });
});