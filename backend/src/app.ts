import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { apiRouter } from './routes';
import { getHealthStatus } from './controllers/healthController';

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
      credentials: true,
    }),
  );

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Direct root health endpoint (convenience for load balancers & pingers)
  app.get('/health', getHealthStatus);

  // Mount API versioned router
  app.use('/api', apiRouter);

  // Fallback 404 handler
  app.use(notFoundHandler);

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}
