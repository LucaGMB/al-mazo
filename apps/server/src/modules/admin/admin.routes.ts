import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/auth.middleware.js';
import { findGame, persistGame, toPublic, memoryGames, GameRecord } from '../games/games.routes.js';
import { memoryReports, ReportRecord } from '../reports/reports.routes.js';
import { prisma } from '../../db/prisma.js';
import { getOfficialGame } from '../../games/registry.js';

const updateReportSchema = z.object({
  status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
  adminNotes: z.string().max(1000).optional(),
});

const takedownSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply requireAdmin to all admin endpoints
  fastify.addHook('preHandler', requireAdmin);

  /**
   * GET /api/admin/reports
   * Lists submitted game reports with filters
   */
  fastify.get<{ Querystring: { status?: string } }>('/api/admin/reports', async (request, reply) => {
    const filterStatus = request.query.status;

    try {
      const dbReports = await prisma.gameReport.findMany({
        where: filterStatus ? { status: filterStatus } : undefined,
        include: {
          game: { select: { id: true, slug: true, title: true, status: true, isPublished: true } },
          reporter: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format response
      const formattedDb = dbReports.map((r) => ({
        id: r.id,
        gameId: r.gameId,
        gameSlug: r.game.slug,
        gameTitle: r.game.title,
        gameStatus: r.game.status,
        gameIsPublished: r.game.isPublished,
        reporterId: r.reporterId,
        reporterName: r.reporter.name ?? 'Usuario',
        reporterEmail: r.reporter.email ?? undefined,
        reason: r.reason,
        description: r.description,
        status: r.status,
        adminNotes: r.adminNotes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      // Combine with memory reports if any are not shadowed
      const dbIds = new Set(formattedDb.map((r) => r.id));
      const memoryList = Array.from(memoryReports.values())
        .filter((r) => (!filterStatus || r.status === filterStatus) && !dbIds.has(r.id))
        .map((r) => {
          const game = memoryGames.get(r.gameId);
          return {
            ...r,
            gameStatus: game?.status ?? 'UNKNOWN',
            gameIsPublished: game?.isPublished ?? false,
          };
        });

      return reply.send({ reports: [...formattedDb, ...memoryList] });
    } catch {
      // Memory fallback
      const memoryList = Array.from(memoryReports.values())
        .filter((r) => !filterStatus || r.status === filterStatus)
        .map((r) => {
          const game = memoryGames.get(r.gameId);
          return {
            ...r,
            gameStatus: game?.status ?? 'UNKNOWN',
            gameIsPublished: game?.isPublished ?? false,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return reply.send({ reports: memoryList });
    }
  });

  /**
   * PATCH /api/admin/reports/:id
   * Updates report status or adds notes
   */
  fastify.patch<{ Params: { id: string } }>('/api/admin/reports/:id', async (request, reply) => {
    const { id } = request.params;
    const parsed = updateReportSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', issues: parsed.error.issues });
    }

    const { status, adminNotes } = parsed.data;

    let updatedRecord: ReportRecord | null = null;
    const inMem = memoryReports.get(id);
    if (inMem) {
      if (status) inMem.status = status;
      if (adminNotes !== undefined) inMem.adminNotes = adminNotes;
      inMem.updatedAt = new Date();
      updatedRecord = inMem;
    }

    try {
      const updated = await prisma.gameReport.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(adminNotes !== undefined ? { adminNotes } : {}),
        },
      });

      return reply.send({
        report: {
          id: updated.id,
          status: updated.status,
          adminNotes: updated.adminNotes,
          updatedAt: updated.updatedAt,
        },
      });
    } catch {
      if (updatedRecord) {
        return reply.send({ report: updatedRecord });
      }
      return reply.status(404).send({ error: 'Reporte no encontrado' });
    }
  });

  /**
   * POST /api/admin/games/:id/takedown
   * Marks a community game as BANNED, unpublishes it, and resolves associated reports
   */
  fastify.post<{ Params: { id: string } }>('/api/admin/games/:id/takedown', async (request, reply) => {
    const { id } = request.params;
    if (getOfficialGame(id)) {
      return reply.status(400).send({ error: 'No se pueden dar de baja juegos oficiales del sistema.' });
    }

    const game = await findGame(id);
    if (!game) {
      return reply.status(404).send({ error: 'Juego no encontrado' });
    }

    const parsed = takedownSchema.safeParse(request.body ?? {});
    const note = parsed.success && parsed.data.reason ? parsed.data.reason : 'Baja por moderación';

    const updated = await persistGame({
      ...game,
      status: 'BANNED',
      isPublished: false,
    });

    // Automatically resolve pending reports for this game
    try {
      await prisma.gameReport.updateMany({
        where: { gameId: game.id, status: 'PENDING' },
        data: {
          status: 'RESOLVED',
          adminNotes: `Resuelto: ${note}`,
        },
      });
    } catch {
      // Ignore DB errors in fallback mode
    }

    for (const report of memoryReports.values()) {
      if (report.gameId === game.id && report.status === 'PENDING') {
        report.status = 'RESOLVED';
        report.adminNotes = `Resuelto: ${note}`;
        report.updatedAt = new Date();
      }
    }

    return reply.send({
      success: true,
      message: 'Juego retirado por moderación con éxito',
      game: toPublic(updated),
    });
  });

  /**
   * POST /api/admin/games/:id/restore
   * Restores a previously BANNED game back to PUBLISHED
   */
  fastify.post<{ Params: { id: string } }>('/api/admin/games/:id/restore', async (request, reply) => {
    const { id } = request.params;
    const game = await findGame(id);
    if (!game) {
      return reply.status(404).send({ error: 'Juego no encontrado' });
    }

    const updated = await persistGame({
      ...game,
      status: 'PUBLISHED',
      isPublished: true,
    });

    return reply.send({
      success: true,
      message: 'Juego restaurado a publicado con éxito',
      game: toPublic(updated),
    });
  });

  /**
   * GET /api/admin/games
   * Lists all community games with status and report count
   */
  fastify.get('/api/admin/games', async (_request, reply) => {
    try {
      const dbGames = await prisma.gameDefinition.findMany({
        where: { isOfficial: false },
        include: {
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { reports: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = dbGames.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        description: g.description,
        status: g.status,
        isPublished: g.isPublished,
        author: g.author ? { id: g.author.id, name: g.author.name, email: g.author.email } : null,
        reportsCount: g._count.reports,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }));

      // Combine with memory games
      const dbIds = new Set(formatted.map((g) => g.id));
      const memoryOnly = Array.from(memoryGames.values())
        .filter((g) => !g.isOfficial && !dbIds.has(g.id))
        .map((g) => {
          const reportCount = Array.from(memoryReports.values()).filter((r) => r.gameId === g.id).length;
          return {
            id: g.id,
            slug: g.slug,
            title: g.title,
            description: g.description,
            status: g.status,
            isPublished: g.isPublished,
            author: g.authorId ? { id: g.authorId, name: 'Autor', email: undefined } : null,
            reportsCount: reportCount,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
          };
        });

      return reply.send({ games: [...formatted, ...memoryOnly] });
    } catch {
      // Memory fallback
      const list = Array.from(memoryGames.values())
        .filter((g) => !g.isOfficial)
        .map((g) => {
          const reportCount = Array.from(memoryReports.values()).filter((r) => r.gameId === g.id).length;
          return {
            id: g.id,
            slug: g.slug,
            title: g.title,
            description: g.description,
            status: g.status,
            isPublished: g.isPublished,
            author: g.authorId ? { id: g.authorId, name: 'Autor', email: undefined } : null,
            reportsCount: reportCount,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
          };
        });

      return reply.send({ games: list });
    }
  });
};
