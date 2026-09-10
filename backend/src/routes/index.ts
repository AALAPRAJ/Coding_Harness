import { Router } from 'express';
import { healthRoutes } from './healthRoutes';
import { authRoutes } from './authRoutes';

export const apiRouter = Router();

// Mount sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
