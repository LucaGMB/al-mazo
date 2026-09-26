import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../auth/auth.middleware.js';
import { findGame } from '../games/games.routes.js';
import { getOfficialGame } from '../../games/registry.js';

export interface ReportRecord {
  id: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  reporterId: string;
  reporterName?: string;
  reporterEmail?: string;
  reason: 'COPYRIGHT' | 'INAPPROPRIATE' | 'SPAM' | 'BROKEN' | 'OTHER';
  description: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  adminNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const memoryReports = new Map<string, ReportRecord>();

const createReportSchema = z.object({
  reason: z.enum(['COPYRIGHT', 'INAPPROPRIATE', 'SPAM', 'BROKEN', 'OTHER']),
  description: z
    .string()
    .trim()
    .min(5, 'La descripción debe tener al menos 5 caracteres')
    .max(1000, 'La descripción no puede superar 1000 caracteres'),
});

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/games/:id/reports
   * Submits a report for a community game
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/games/:id/reports',
    { preHandler: authenticate },
    async (request, reply) => {
      const reporterId = request.user?.userId;
      if (!reporterId) {
        return reply.status(401).send({ error: 'Iniciá sesión para reportar un juego' });
      }

      // Ensure user is not anonymous
      let isAnonymous = false;
      let reporterName = 'Usuario';
      let reporterEmail: string | undefined;

      try {
        const user = await prisma.user.findUnique({ where: { id: reporterId } });
        if (!user || user.isAnonymous) {
          isAnonymous = true;
        } else {
          reporterName = user.name ?? 'Usuario';
          reporterEmail = user.email ?? undefined;
        }
      } catch {
        if (reporterId.startsWith('guest_') || reporterId.includes('guest')) {
          isAnonymous = true;
        }
      }

      if (isAnonymous) {
        return reply
          .status(403)
          .send({ error: 'Exclusivo para usuarios registrados. Iniciá sesión para reportar un juego.' });
      }

      const { id } = request.params;
      const official = getOfficialGame(id);
      if (official) {
        return reply
          .status(400)
          .send({ error: 'Los juegos oficiales no pueden reportarse mediante este formulario.' });
      }

      const game = await findGame(id);
      if (!game) {
        return reply.status(404).send({ error: 'Juego no encontrado' });
      }

      const parsed = createReportSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          issues: parsed.error.issues,
        });
      }

      const { reason, description } = parsed.data;

      // Check existing pending report from same user for same game
      const existingInMemory = Array.from(memoryReports.values()).find(
        (r) => r.gameId === game.id && r.reporterId === reporterId && r.status === 'PENDING'
      );
      if (existingInMemory) {
        return reply.status(409).send({ error: 'Ya enviaste un reporte pendiente para este juego.' });
      }

      try {
        const existingInDb = await prisma.gameReport.findFirst({
          where: {
            gameId: game.id,
            reporterId,
            status: 'PENDING',
          },
        });
        if (existingInDb) {
          return reply.status(409).send({ error: 'Ya enviaste un reporte pendiente para este juego.' });
        }
      } catch {
        // DB check fallback: rely on memory check
      }

      const reportId = randomUUID();
      const now = new Date();
      const record: ReportRecord = {
        id: reportId,
        gameId: game.id,
        gameSlug: game.slug,
        gameTitle: game.title,
        reporterId,
        reporterName,
        reporterEmail,
        reason,
        description,
        status: 'PENDING',
        adminNotes: null,
        createdAt: now,
        updatedAt: now,
      };

      try {
        const created = await prisma.gameReport.create({
          data: {
            id: record.id,
            gameId: record.gameId,
            reporterId: record.reporterId,
            reason: record.reason,
            description: record.description,
            status: record.status,
          },
        });
        memoryReports.set(record.id, record);
        return reply.status(201).send({
          report: {
            id: created.id,
            gameId: created.gameId,
            gameSlug: game.slug,
            gameTitle: game.title,
            reporterId: created.reporterId,
            reason: created.reason,
            description: created.description,
            status: created.status,
            createdAt: created.createdAt,
          },
        });
      } catch {
        // Fallback in memory
        memoryReports.set(record.id, record);
        return reply.status(201).send({ report: record });
      }
    }
  );
};
