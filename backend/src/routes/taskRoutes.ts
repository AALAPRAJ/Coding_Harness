import { Router } from 'express';
import { createTask, getTaskById, listTasks, getTaskDiff } from '../controllers/taskController';
import { optionalAuthenticate } from '../middlewares/auth';
import { uploadZipMiddleware } from '../services/storageService';

export const taskRoutes = Router();

// Create new coding task (supports multipart zip upload or json with repoUrl)
taskRoutes.post('/', optionalAuthenticate, uploadZipMiddleware.single('file'), createTask);

// List tasks
taskRoutes.get('/', optionalAuthenticate, listTasks);

// Get task details and execution history
taskRoutes.get('/:id', optionalAuthenticate, getTaskById);

// Get latest generated Git diff
taskRoutes.get('/:id/diff', optionalAuthenticate, getTaskDiff);
