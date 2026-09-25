import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      redisOk = (await redis.get('__healthcheck__')) !== undefined;
    } catch {
      redisOk = false;
    }

    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
      },
    });
  });
};
