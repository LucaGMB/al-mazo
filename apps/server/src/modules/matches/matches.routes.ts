import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

const syncMatchSchema = z.object({
  gameSlug: z.string(),
  mode: z.enum(['LOCAL_OFFLINE', 'ONLINE_ROOM']).default('LOCAL_OFFLINE'),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().int().nonnegative(),
  winnerName: z.string().optional(),
  participants: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().min(1),
        isWinner: z.boolean().default(false),
        score: z.number().int().default(0),
      })
    )
    .min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const matchesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/matches/sync
   * Receives finished match data from offline local play or online rooms,
   * records history and updates user stats.
   */
  fastify.post('/api/matches/sync', async (request, reply) => {
    const parseResult = syncMatchSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    const data = parseResult.data;

    try {
      // Find game by slug or create an entry if missing
      let game = await prisma.gameDefinition.findUnique({
        where: { slug: data.gameSlug },
      });

      if (!game) {
        game = await prisma.gameDefinition.create({
          data: {
            slug: data.gameSlug,
            title: data.gameSlug,
            description: 'Auto-registered game',
            isOfficial: true,
            isPublished: true,
            schemaJson: {},
          },
        });
      }

      const match = await prisma.match.create({
        data: {
          gameId: game.id,
          mode: data.mode,
          startedAt: new Date(data.startedAt),
          endedAt: data.endedAt ? new Date(data.endedAt) : new Date(),
          durationSec: data.durationSec,
          metadataJson: data.metadata as any,
          participants: {
            create: data.participants.map((p) => ({
              userId: p.userId,
              name: p.name,
              isWinner: p.isWinner,
              score: p.score,
            })),
          },
        },
        include: {
          participants: true,
        },
      });

      // Update player statistics for participants with registered userId
      for (const p of data.participants) {
        if (p.userId) {
          await prisma.playerStat.upsert({
            where: {
              userId_gameSlug: {
                userId: p.userId,
                gameSlug: data.gameSlug,
              },
            },
            update: {
              matchesPlayed: { increment: 1 },
              matchesWon: p.isWinner ? { increment: 1 } : undefined,
            },
            create: {
              userId: p.userId,
              gameSlug: data.gameSlug,
              matchesPlayed: 1,
              matchesWon: p.isWinner ? 1 : 0,
            },
          });
        }
      }

      return reply.status(201).send({
        success: true,
        matchId: match.id,
      });
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'Database error',
        message: err instanceof Error ? err.message : 'Failed to record match history',
      });
    }
  });

  /**
   * GET /api/users/:id/matches
   * Returns the 15 most recent matches a user participated in
   */
  fastify.get<{ Params: { id: string } }>('/api/users/:id/matches', async (request, reply) => {
    const { id } = request.params;

    try {
      const matches = await prisma.match.findMany({
        where: {
          participants: {
            some: { userId: id },
          },
        },
        take: 15,
        orderBy: { endedAt: 'desc' },
        include: {
          game: { select: { slug: true, title: true } },
          participants: true,
        },
      });

      return reply.send({ matches });
    } catch {
      return reply.send({ matches: [] });
    }
  });

  /**
   * GET /api/matches
   * Returns recent matches history
   */
  fastify.get('/api/matches', async (_request, reply) => {
    try {
      const matches = await prisma.match.findMany({
        take: 20,
        orderBy: { endedAt: 'desc' },
        include: {
          game: { select: { slug: true, title: true } },
          participants: true,
        },
      });

      return reply.send({ matches });
    } catch {
      return reply.send({ matches: [] });
    }
  });
};
