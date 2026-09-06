import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// Prevent multiple instances of Prisma Client in development during hot-reload
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check helper to test database connectivity and latency.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  message?: string;
}> {
  const startTime = Date.now();
  try {
    // Run simple lightweight query
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return { connected: true, latencyMs };
  } catch (error) {
    const err = error as Error;
    logger.warn('Database health check ping failed', { error: err.message });
    return {
      connected: false,
      message: err.message || 'Unable to reach database',
    };
  }
}
