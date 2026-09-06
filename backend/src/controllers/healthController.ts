import { Request, Response } from 'express';
import { ApiResponse, HealthCheckResponse } from '@coding-harness/shared';
import { checkDatabaseConnection } from '../db/client';
import { config } from '../config';

const startTime = Date.now();

/**
 * Health check handler returning system metrics, uptime, and database connection state.
 */
export async function getHealthStatus(_req: Request, res: Response): Promise<void> {
  const dbHealth = await checkDatabaseConnection();
  const memoryUsage = process.memoryUsage();

  const toMB = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 100) / 100} MB`;

  const healthData: HealthCheckResponse = {
    status: dbHealth.connected ? 'ok' : 'degraded',
    service: 'coding-harness-backend',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbHealth,
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

  // Return 200 even if degraded so monitoring tools can read the diagnostic payload
  res.status(200).json(response);
}
