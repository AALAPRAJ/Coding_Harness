import rateLimit from 'express-rate-limit';
import { ApiErrorResponse } from '@coding-harness/shared';
import { Request, Response } from 'express';

const createRateLimitHandler = (message: string, code: string) => {
  return (_req: Request, res: Response) => {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    };
    res.status(429).json(errorResponse);
  };
};

/**
 * General API rate limiter preventing volumetric abuse.
 * 300 requests per 15-minute window per IP.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many API requests. Please slow down and try again later.',
    'RATE_LIMIT_EXCEEDED',
  ),
});

/**
 * Strict authentication limiter preventing credential stuffing and brute-force attacks.
 * 15 attempts per 15-minute window per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many authentication attempts. Please try again after 15 minutes.',
    'AUTH_RATE_LIMIT_EXCEEDED',
  ),
});

/**
 * Task submission limiter preventing resource exhaustion on background job queues and Docker sandboxes.
 * 20 task submissions per 15-minute window per IP.
 */
export const taskSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Task submission rate limit exceeded. Please wait before scheduling more coding tasks.',
    'TASK_RATE_LIMIT_EXCEEDED',
  ),
});
