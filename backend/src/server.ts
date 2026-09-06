import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { prisma } from './db/client';

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info(`🚀 Coding Harness Backend listening on port ${config.port}`);
  logger.info(`🌐 Environment: ${config.nodeEnv}`);
  logger.info(`🩺 Health check available at: http://localhost:${config.port}/health`);
});

// Graceful shutdown handler
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await prisma.$disconnect();
      logger.info('Database connection disconnected.');
    } catch (err) {
      logger.error('Error disconnecting database:', err);
    }

    process.exit(0);
  });

  // Force exit if shutdown hangs beyond 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection detected:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});
