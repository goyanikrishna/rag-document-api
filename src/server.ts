import app from '@/app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/database/client';

const server = app.listen(env.PORT, () => {
  logger.info(`==================================================`);
  logger.info(`   Document RAG Backend running in [${env.NODE_ENV}] mode`);
  logger.info(`   Listening on: http://localhost:${env.PORT}`);
  logger.info(`==================================================`);
});

/**
 * Handles graceful shutdown of the HTTP server and database pool connections.
 */
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await prisma.$disconnect();
      logger.info('Database connections disconnected.');
      process.exit(0);
    } catch (err: any) {
      logger.error(`Error disconnecting database: ${err.message}`);
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
