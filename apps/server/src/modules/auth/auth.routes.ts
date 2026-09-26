import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma.js';
import { authenticate, isAdminEmail, signToken } from './auth.middleware.js';

const guestAuthSchema = z.object({
  name: z.string().min(1).max(30).optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(30).optional(),
});

const loginSchema = z
  .object({
    email: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(1),
  })
  .refine((data) => Boolean(data.email || data.username), {
    message: 'Email or username is required',
  });

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/guest
   * Creates or provides an anonymous guest user identity for frictionless play
   */
  fastify.post('/api/auth/guest', async (request, reply) => {
    const parseResult = guestAuthSchema.safeParse(request.body ?? {});
    const customName = parseResult.success && parseResult.data.name
      ? parseResult.data.name
      : `Invitado_${nanoid(4).toUpperCase()}`;

    try {
      const user = await prisma.user.create({
        data: {
          name: customName,
          isAnonymous: true,
        },
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          name: user.name,
          isAnonymous: true,
          createdAt: user.createdAt,
        },
      });
    } catch {
      // Fallback in-memory identity if DB is not currently accessible
      const fallbackId = `guest_${nanoid(8)}`;
      return reply.status(200).send({
        user: {
          id: fallbackId,
          name: customName,
          isAnonymous: true,
          createdAt: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /api/auth/register
   * Creates a credentialed user account and returns a JWT
   */
  fastify.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }
    const { email, password, name } = parsed.data;

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const role = isAdminEmail(email) ? 'ADMIN' : 'USER';
      const user = await prisma.user.create({
        data: {
          email,
          name: name ?? email.split('@')[0],
          passwordHash,
          role,
          isAnonymous: false,
        },
      });

      const token = signToken({ userId: user.id, role: user.role });
      return reply.status(201).send({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
    } catch {
      return reply.status(503).send({ error: 'Database unavailable' });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticates credentials and returns a JWT
   */
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }
    const { email, username, password } = parsed.data;
    const identifier = (email ?? username)?.trim();
    if (!identifier) {
      return reply.status(400).send({ error: 'Debés ingresar un email o usuario' });
    }

    try {
      let user = null;
      if (identifier.includes('@') || typeof prisma.user.findUnique === 'function') {
        user = await prisma.user.findUnique({ where: { email: identifier } });
      }
      if (!user && typeof prisma.user.findFirst === 'function') {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { name: identifier },
            ],
          },
        });
      }
      if (!user?.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      let effectiveRole = user.role;
      if (user.email && isAdminEmail(user.email)) {
        effectiveRole = 'ADMIN';
        if (user.role !== 'ADMIN') {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }).catch(() => {});
        }
      }

      const token = signToken({ userId: user.id, role: effectiveRole });
      return reply.send({
        user: { id: user.id, email: user.email, name: user.name, role: effectiveRole },
        token,
      });
    } catch {
      return reply.status(503).send({ error: 'Database unavailable' });
    }
  });

  /**
   * GET /api/auth/me
   * Returns the authenticated user's profile
   */
  fastify.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user!;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      let effectiveRole = user.role;
      if (user.email && isAdminEmail(user.email)) {
        effectiveRole = 'ADMIN';
        if (user.role !== 'ADMIN') {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }).catch(() => {});
        }
      }

      return reply.send({
        user: { id: user.id, email: user.email, name: user.name, role: effectiveRole },
      });
    } catch {
      return reply.status(503).send({ error: 'Database unavailable' });
    }
  });

  /**
   * PATCH /api/users/:id
   * Updates a guest user's display name
   */
  fastify.patch<{ Params: { id: string }; Body: { name?: string } }>(
    '/api/users/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body ?? {};
      const trimmed = name?.trim();
      if (!trimmed || trimmed.length > 30) {
        return reply.status(400).send({ error: 'Name must be between 1 and 30 characters' });
      }

      try {
        const user = await prisma.user.update({
          where: { id },
          data: { name: trimmed },
        });

        return reply.send({
          user: { id: user.id, name: user.name, isAnonymous: user.isAnonymous },
        });
      } catch {
        // Sin DB accesible, igual devolvemos la identidad editada para que la UI
        // no pierda el cambio de nombre.
        return reply.send({ user: { id, name: trimmed, isAnonymous: true } });
      }
    }
  );

  /**
   * GET /api/users/:id/stats
   * Returns stats (matches played, wins) for a user
   */
  fastify.get<{ Params: { id: string } }>('/api/users/:id/stats', async (request, reply) => {
    const { id } = request.params;

    try {
      const stats = await prisma.playerStat.findMany({
        where: { userId: id },
      });

      return reply.send({ stats });
    } catch {
      return reply.send({ stats: [] });
    }
  });
};
