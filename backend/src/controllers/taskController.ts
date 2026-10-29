import { Response, NextFunction } from 'express';
import { ApiResponse, Task, TaskStatus, TaskWithSessions } from '@coding-harness/shared';
import { prisma } from '../db/client';
import { enqueueTask } from '../jobs/queue';
import { AppError } from '../middlewares/errorHandler';
import { AuthenticatedRequest } from '../middlewares/auth';
import { GitService } from '../services/gitService';
import { logger } from '../logger';
import { config } from '../config';
import { extractLegacySummary } from '../agent/legacySummary';

/**
 * Submit a new automated coding task.
 * Supports Git repository URLs or uploaded .zip repository archives.
 */
export async function createTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { repoUrl, prompt, branch } = req.body;
    const uploadedFile = req.file;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new AppError('A natural language task prompt is required', 400, 'INVALID_INPUT');
    }

    if (!repoUrl && !uploadedFile) {
      throw new AppError(
        'Either a repoUrl or a .zip repository archive must be provided',
        400,
        'INVALID_INPUT',
      );
    }

    if (config.aiProvider === 'claude-code') {
      if (uploadedFile || typeof repoUrl !== 'string') {
        throw new AppError('This demo accepts public GitHub URLs only', 400, 'INVALID_INPUT');
      }
      let url: URL;
      try {
        url = new URL(repoUrl);
      } catch {
        throw new AppError('Invalid GitHub URL', 400, 'INVALID_INPUT');
      }
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname)
      ) {
        throw new AppError('Use a public HTTPS GitHub repository URL', 400, 'INVALID_INPUT');
      }
    }

    const taskRepoIdentifier = repoUrl
      ? repoUrl.trim()
      : uploadedFile?.originalname || 'archive.zip';

    // 1. Create Task record in database
    const task = await prisma.task.create({
      data: {
        userId: req.user?.id || null,
        repoUrl: taskRepoIdentifier,
        prompt: prompt.trim(),
        status: TaskStatus.PENDING,
      },
    });

    // 2. Add job to background BullMQ queue
    try {
      await enqueueTask({
        taskId: task.id,
        repoUrl: repoUrl ? repoUrl.trim() : '',
        prompt: prompt.trim(),
        branch: branch ? branch.trim() : undefined,
        userId: task.userId,
        zipFilePath: uploadedFile?.path,
      });
    } catch (queueError) {
      logger.warn(`Queue dispatch warning for task ${task.id}:`, queueError);
      await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.FAILED } });
      throw new AppError('Could not enqueue task', 503, 'QUEUE_UNAVAILABLE');
    }

    const response: ApiResponse<Task> = {
      success: true,
      data: task as unknown as Task,
      message: 'Coding task submitted successfully and queued for execution',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch status and session execution history for a specific task.
 */
export async function getTaskById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new AppError(`Task with ID ${id} was not found`, 404, 'NOT_FOUND');
    }

    const response: ApiResponse<TaskWithSessions> = {
      success: true,
      data: {
        ...task,
        sessions: task.sessions.map((session) => ({
          ...session,
          resultSummary:
            session.resultSummary ||
            (task.status === TaskStatus.COMPLETED ? extractLegacySummary(session.logs) : null),
        })),
      } as unknown as TaskWithSessions,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * List tasks with pagination and optional user filtering.
 */
export async function listTasks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
    const status = req.query.status as TaskStatus | undefined;

    const whereClause: {
      userId?: string;
      status?: TaskStatus;
    } = {};

    // Filter by user if requested or if caller wants only their tasks
    if (req.query.userOnly === 'true' && req.user?.id) {
      whereClause.userId = req.user.id;
    }

    if (status && Object.values(TaskStatus).includes(status)) {
      whereClause.status = status;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.task.count({ where: whereClause }),
    ]);

    const response: ApiResponse<{ tasks: Task[]; total: number; limit: number; offset: number }> = {
      success: true,
      data: {
        tasks: tasks as unknown as Task[],
        total,
        limit,
        offset,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve the latest generated Git diff for a completed or running task.
 */
export async function getTaskDiff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!task) {
      throw new AppError(`Task with ID ${id} was not found`, 404, 'NOT_FOUND');
    }

    let diff = task.sessions[0]?.resultDiff || '';

    // If session has no stored diff, attempt live diff check on the workspace
    if (!diff) {
      const workspacePath = GitService.getWorkspacePath(id);
      diff = await GitService.getGitDiff(workspacePath);
    }

    const response: ApiResponse<{ taskId: string; diff: string }> = {
      success: true,
      data: {
        taskId: id,
        diff,
      },
      message: diff ? 'Git diff retrieved' : 'No code changes recorded yet',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
