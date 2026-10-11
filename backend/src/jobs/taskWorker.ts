import { Worker, Job } from 'bullmq';
import { TaskJobData, TaskStatus } from '@coding-harness/shared';
import { TASK_QUEUE_NAME, redisConnectionOptions } from './queue';
import { prisma } from '../db/client';
import { GitService } from '../services/gitService';
import { StorageService } from '../services/storageService';
import { DockerManager } from '../sandbox/dockerManager';
import { AgentLoop } from '../agent/agentLoop';
import { logger } from '../logger';

import { SocketServer } from '../websocket/socketServer';

/**
 * Executes a single coding task job.
 * Manages task workspace setup, repo cloning/extraction, and database status transitions.
 */
export async function processTaskJob(job: Job<TaskJobData>): Promise<void> {
  const { taskId, repoUrl, prompt, branch, zipFilePath } = job.data;
  const startTime = new Date();

  logger.info(`Processing task job ${job.id} for task ${taskId}`);

  // 1. Update Task status to RUNNING in database and notify WebSocket clients
  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.RUNNING },
  });
  SocketServer.emitTaskStatus(taskId, TaskStatus.RUNNING);

  // 2. Initialize a Session record to store streaming execution logs
  let session = await prisma.session.create({
    data: {
      taskId,
      logs: `[${startTime.toISOString()}] Task started.\n[${startTime.toISOString()}] Prompt: "${prompt}"\n`,
      startedAt: startTime,
    },
  });

  const appendLogs = async (logLine: string) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${logLine}\n`;
    logger.info(`[Task ${taskId}] ${logLine}`);
    SocketServer.emitTaskLog(taskId, logLine);
    session = await prisma.session.update({
      where: { id: session.id },
      data: {
        logs: {
          set: (session.logs || '') + entry,
        },
      },
    });
  };

  try {
    // 3. Prepare clean workspace directory
    await appendLogs('Preparing isolated task workspace...');
    const workspacePath = await GitService.prepareWorkspace(taskId);

    // 4. Source setup: Repository clone OR Zip archive extraction
    if (zipFilePath) {
      await appendLogs(`Extracting uploaded repository archive from ${zipFilePath}...`);
      await StorageService.extractZip(zipFilePath, workspacePath);
      await StorageService.removeUploadedFile(zipFilePath);
      await appendLogs('Initializing local Git tracking for diff generation...');
      await GitService.initRepository(workspacePath);
    } else if (repoUrl) {
      await appendLogs(
        `Cloning Git repository: ${repoUrl}${branch ? ` (branch: ${branch})` : ''}...`,
      );
      await GitService.cloneRepository(repoUrl, workspacePath, { branch });
      await appendLogs('Repository cloned successfully.');
    } else {
      throw new Error('Neither a repoUrl nor a zipFilePath was provided for this task.');
    }

    // 5. Docker Sandbox Container lifecycle (Phase 3 Tool Execution Layer)
    let containerInfo: { containerId: string } | null = null;
    try {
      const dockerStatus = await DockerManager.checkDockerConnection();
      if (dockerStatus.connected) {
        await appendLogs(
          `Docker daemon connected (v${dockerStatus.version || 'unknown'}). Spinning up isolated sandbox container...`,
        );
        containerInfo = await DockerManager.createAndStartContainer(taskId, workspacePath);
        await appendLogs(
          `Docker sandbox container initialized: ${containerInfo.containerId.substring(0, 12)}`,
        );
      } else {
        await appendLogs(
          `Notice: Docker daemon unreachable (${dockerStatus.message}). Running in container-less filesystem mode.`,
        );
      }

      // 6. AI Agent Autonomous Execution Loop (Phase 4)
      await appendLogs('Starting autonomous AI Agent reasoning and tool execution loop...');
      const agentResult = await AgentLoop.run({
        taskId,
        workspacePath,
        prompt,
        containerId: containerInfo?.containerId,
        onProgress: async (logLine, stepLog) => {
          await appendLogs(logLine);
          if (stepLog) {
            SocketServer.emitTaskStep(taskId, stepLog);
          }
        },
      });

      if (!agentResult.success && agentResult.error) {
        throw new Error(`AI Agent execution halted with error: ${agentResult.error}`);
      }

      await appendLogs(
        `Agent loop finished successfully in ${agentResult.iterations} iteration(s) with ${agentResult.totalToolCalls} tool execution(s).`,
      );

      // 7. Capture final diff
      const diff = agentResult.finalDiff || (await GitService.getGitDiff(workspacePath));
      if (diff) {
        SocketServer.emitTaskDiff(taskId, diff);
      }

      // 8. Mark session and task as COMPLETED
      const finishTime = new Date();
      await appendLogs('Task execution phase completed successfully.');

      await prisma.session.update({
        where: { id: session.id },
        data: {
          resultDiff: diff || null,
          finishedAt: finishTime,
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED },
      });
      SocketServer.emitTaskStatus(taskId, TaskStatus.COMPLETED);

      logger.info(`Task ${taskId} completed successfully`);
    } finally {
      // Ensure sandbox container is cleanly destroyed after task completion or failure
      if (containerInfo?.containerId) {
        await appendLogs(
          `Cleaning up sandbox container ${containerInfo.containerId.substring(0, 12)}...`,
        );
        await DockerManager.stopAndRemoveContainer(containerInfo.containerId);
      }
    }
  } catch (error) {
    const err = error as Error;
    const finishTime = new Date();
    await appendLogs(`Task execution failed: ${err.message}`);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        finishedAt: finishTime,
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.FAILED },
    });
    SocketServer.emitTaskStatus(taskId, TaskStatus.FAILED);

    logger.error(`Task ${taskId} failed:`, err);
    throw error;
  }
}

/**
 * Creates and initializes the BullMQ background worker.
 */
export function createTaskWorker(): Worker<TaskJobData> {
  const worker = new Worker<TaskJobData>(
    TASK_QUEUE_NAME,
    async (job) => {
      await processTaskJob(job);
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2, // Process up to 2 tasks concurrently
    },
  );

  worker.on('completed', (job) => {
    logger.info(`BullMQ Worker: Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`BullMQ Worker: Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.warn(`BullMQ Worker connection warning: ${err.message}`);
  });

  return worker;
}

// Singleton worker instance holder
let activeWorker: Worker<TaskJobData> | null = null;

export function startTaskWorker(): Worker<TaskJobData> {
  if (!activeWorker) {
    activeWorker = createTaskWorker();
    logger.info('BullMQ Task Worker started');
  }
  return activeWorker;
}

export async function stopTaskWorker(): Promise<void> {
  if (activeWorker) {
    await activeWorker.close();
    activeWorker = null;
    logger.info('BullMQ Task Worker stopped');
  }
}
