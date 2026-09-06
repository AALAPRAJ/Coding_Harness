import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '@coding-harness/shared';
import { logger } from '../logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 handler for routes that do not exist.
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

/**
 * Global centralized error handler middleware.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const details = err instanceof AppError ? err.details : undefined;

  logger.error('Unhandled Application Error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    statusCode,
  });

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      details,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}
