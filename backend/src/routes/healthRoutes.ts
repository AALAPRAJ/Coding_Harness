import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController';

export const healthRoutes = Router();

healthRoutes.get('/', getHealthStatus);
