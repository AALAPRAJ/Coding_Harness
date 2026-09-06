import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Middleware that logs HTTP requests with method, url, status code, and duration in ms.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(logMessage, { method, url: originalUrl, statusCode, duration });
    } else if (statusCode >= 400) {
      logger.warn(logMessage, { method, url: originalUrl, statusCode, duration });
    } else {
      logger.info(logMessage, { method, url: originalUrl, statusCode, duration });
    }
  });

  next();
}
