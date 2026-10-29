import { Router } from 'express';
import { healthRoutes } from './healthRoutes';
import { authRoutes } from './authRoutes';
import { taskRoutes } from './taskRoutes';
import { getProjectCost } from '../services/projectCost';

export const apiRouter = Router();

apiRouter.get('/project-cost', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await getProjectCost() });
});

// Mount sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', taskRoutes);
