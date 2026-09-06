import { Router } from 'express';
import { healthRoutes } from './healthRoutes';

export const apiRouter = Router();

// Mount sub-routes
apiRouter.use('/health', healthRoutes);
