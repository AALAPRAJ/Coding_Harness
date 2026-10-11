import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { TaskJobData } from '@coding-harness/shared';
import { config } from '../config';
import { logger } from '../logger';

export const TASK_QUEUE_NAME = 'TaskQueue';

/**
 * Shared Redis connection options for BullMQ and queue diagnostics.
 * - maxRetriesPerRequest: null is strictly required by BullMQ.
 * - enableOfflineQueue: false ensures commands fail immediately if Redis is offline rather than hanging.
 */
export const redisConnectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 2000,
  enableOfflineQueue: false,
  retryStrategy(times: number) {
    return Math.min(times * 1000, 5000);
  },
};

/**
 * Dedicated IORedis client for queue connection and diagnostics.
 */
export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  logger.info(`Connected to Redis at ${config.redisHost}:${config.redisPort}`);
});

redisClient.on('error', (err) => {
  logger.warn(`Redis connection warning: ${err.message}`);
});

/**
 * Checks Redis connectivity and measures roundtrip ping latency.
 * Safely guards against offline hangs using connection status check and strict timeout.
 */
export async function checkRedisConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  message?: string;
}> {
  // If Redis client is not in ready or connected state, return degraded status immediately
  if (redisClient.status !== 'ready' && redisClient.status !== 'connect') {
    return {
      connected: false,
      message: `Redis offline (status: ${redisClient.status})`,
    };
  }

  const startTime = Date.now();
  try {
    const pong = await Promise.race([
      redisClient.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), 1000),
      ),
    ]);

    if (pong === 'PONG') {
      return { connected: true, latencyMs: Date.now() - startTime };
    }
    return { connected: false, message: `Unexpected response: ${pong}` };
  } catch (error) {
    const err = error as Error;
    return {
      connected: false,
      message: err.message || 'Unable to connect to Redis',
    };
  }
}

/**
 * BullMQ Task Queue instance.
 */
export const taskQueue = new Queue<TaskJobData>(TASK_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Adds a new coding task to the BullMQ background queue with timeout safety.
 */
export async function enqueueTask(data: TaskJobData): Promise<Job<TaskJobData>> {
  logger.info(`Enqueuing task job for task ID: ${data.taskId}`);

  return Promise.race([
    taskQueue.add('execute-task', data, { jobId: data.taskId }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('BullMQ queue dispatch timed out')), 2000),
    ),
  ]);
}

/**
 * Closes Redis connections and BullMQ queue cleanly during application shutdown.
 */
export async function closeQueue(): Promise<void> {
  try {
    await taskQueue.close();
    await redisClient.quit();
    logger.info('Task queue and Redis connection closed cleanly');
  } catch (err) {
    logger.warn('Error closing task queue:', err);
  }
}
