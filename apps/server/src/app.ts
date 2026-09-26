import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './config/env.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { gamesRoutes } from './modules/games/games.routes.js';
import { matchesRoutes } from './modules/matches/matches.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
    // @fastify/cors v11 defaults to GET,HEAD,POST; the API also needs PUT/PATCH/DELETE.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Useful when behind reverse proxy
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(gamesRoutes);
  await app.register(matchesRoutes);
  await app.register(authRoutes);

  return app;
}
