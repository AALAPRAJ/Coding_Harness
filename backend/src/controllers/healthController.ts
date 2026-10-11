import { Request, Response } from 'express';
import { ApiResponse, HealthCheckResponse } from '@coding-harness/shared';
import { checkDatabaseConnection } from '../db/client';
import { checkRedisConnection } from '../jobs/queue';
import { config } from '../config';

const startTime = Date.now();

/**
 * Health check handler returning system metrics, uptime, database, and Redis states.
 */
export async function getHealthStatus(_req: Request, res: Response): Promise<void> {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);
  const memoryUsage = process.memoryUsage();

  const toMB = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 100) / 100} MB`;

  const isHealthy = dbHealth.connected && redisHealth.connected;

  const healthData: HealthCheckResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    service: 'coding-harness-backend',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbHealth,
    redis: redisHealth,
    memory: {
      rss: toMB(memoryUsage.rss),
      heapTotal: toMB(memoryUsage.heapTotal),
      heapUsed: toMB(memoryUsage.heapUsed),
    },
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthData,
    message: healthData.status === 'ok' ? 'System healthy' : 'System running in degraded mode',
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}
