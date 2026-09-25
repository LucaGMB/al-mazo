import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initializeSocketServer } from './realtime/socket-server.js';
import { redis } from './db/redis.js';
import { prisma } from './db/prisma.js';

async function bootstrap() {
  const app = await buildApp();

  // Initialize Socket.io on the underlying HTTP server
  const io = initializeSocketServer(app.server, env.CORS_ORIGIN);

  // Attempt Redis connection
  await redis.connect();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`[al-mazo-server] Running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    io.close();
    await app.close();
    await redis.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
