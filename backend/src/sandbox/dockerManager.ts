import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import Docker from 'dockerode';
import { SandboxContainerInfo } from '@coding-harness/shared';
import { config } from '../config';
import { logger } from '../logger';
import {
  CONTAINER_MANAGED_LABEL,
  CONTAINER_WORKSPACE_PATH,
  defaultSandboxLimits,
  SandboxResourceLimits,
} from './sandboxConfig';

/**
 * Result returned after executing a shell command inside a Docker sandbox.
 */
export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  executionTimeMs: number;
}

export interface ContainerStartOptions {
  image?: string;
  limits?: Partial<SandboxResourceLimits>;
  networkMode?: 'bridge' | 'none' | 'host';
}

export interface ExecCommandOptions {
  timeoutMs?: number;
  workingDir?: string;
  env?: Record<string, string>;
}

/**
 * Resolves the active Docker socket path across different operating systems and setups.
 */
function resolveDockerSocketPath(): string | undefined {
  if (config.dockerSocketPath && fs.existsSync(config.dockerSocketPath)) {
    return config.dockerSocketPath;
  }

  // Common macOS Docker Desktop user socket
  const homeDir = process.env.HOME || '';
  const macUserSocket = path.join(homeDir, '.docker/run/docker.sock');
  if (fs.existsSync(macUserSocket)) {
    return macUserSocket;
  }

  // Standard Linux / macOS root socket
  const standardSocket = '/var/run/docker.sock';
  if (fs.existsSync(standardSocket)) {
    return standardSocket;
  }

  return undefined;
}

/**
 * Singleton Dockerode instance configured for the host environment.
 */
const socketPath = resolveDockerSocketPath();
export const docker = new Docker(socketPath ? { socketPath } : undefined);

export class DockerManager {
  /**
   * Diagnostic check verifying connection to the local Docker daemon.
   */
  static async checkDockerConnection(): Promise<{
    connected: boolean;
    version?: string;
    latencyMs?: number;
    message?: string;
  }> {
    const startTime = Date.now();
    try {
      const pingResult = await Promise.race([
        docker.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Docker daemon ping timed out (1500ms)')), 1500),
        ),
      ]);

      const pingStr = Buffer.isBuffer(pingResult) ? pingResult.toString() : String(pingResult);
      if (pingStr.includes('OK') || pingStr.length > 0) {
        let versionStr: string | undefined;
        try {
          const ver = await docker.version();
          versionStr = ver?.Version;
        } catch {
          // Version fetch optional
        }

        return {
          connected: true,
          version: versionStr,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        connected: false,
        message: 'Docker daemon returned unexpected ping response',
      };
    } catch (err) {
      const error = err as Error;
      return {
        connected: false,
        message: error.message || 'Docker daemon is not running or unreachable',
      };
    }
  }

  /**
   * Ensures that the requested Docker image is available locally.
   * If not, pulls the image from Docker Hub with progress tracking.
   */
  static async ensureImage(imageName: string): Promise<void> {
    logger.info(`Checking Docker image availability: ${imageName}`);

    try {
      const img = docker.getImage(imageName);
      await img.inspect();
      logger.debug(`Image ${imageName} is already present locally.`);
      return;
    } catch {
      logger.info(`Image ${imageName} not found locally. Pulling image...`);
    }

    await new Promise<void>((resolve, reject) => {
      docker.pull(imageName, (pullErr: Error | null, stream: NodeJS.ReadableStream) => {
        if (pullErr) {
          return reject(pullErr);
        }

        docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              logger.error(`Failed to pull image ${imageName}:`, err);
              return reject(err);
            }
            logger.info(`Successfully pulled image ${imageName}`);
            resolve();
          },
          (progress: { status?: string }) => {
            if (progress?.status) {
              logger.debug(`[Docker Pull ${imageName}] ${progress.status}`);
            }
          },
        );
      });
    });
  }

  /**
   * Creates and starts a secure Docker sandbox container bound to a task's workspace directory.
   */
  static async createAndStartContainer(
    taskId: string,
    workspacePath: string,
    options: ContainerStartOptions = {},
  ): Promise<SandboxContainerInfo> {
    const imageName = options.image || config.sandboxImage;
    const limits: SandboxResourceLimits = {
      ...defaultSandboxLimits,
      ...options.limits,
    };

    logger.info(`Spinning up sandbox container for task ${taskId} using image ${imageName}`);

    // Ensure workspace directory exists on host
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    // Ensure image is downloaded
    await this.ensureImage(imageName);

    // Create container
    const container: Docker.Container = await docker.createContainer({
      Image: imageName,
      name: `ch-sandbox-${taskId}-${Date.now()}`,
      Cmd: ['sh', '-c', 'tail -f /dev/null'],
      WorkingDir: CONTAINER_WORKSPACE_PATH,
      Labels: {
        [CONTAINER_MANAGED_LABEL]: 'true',
        taskId,
        createdAt: new Date().toISOString(),
      },
      HostConfig: {
        Binds: [`${path.resolve(workspacePath)}:${CONTAINER_WORKSPACE_PATH}:rw`],
        Memory: limits.memory,
        NanoCpus: limits.nanoCpus,
        NetworkMode: options.networkMode || 'bridge',
        SecurityOpt: ['no-new-privileges:true'],
        AutoRemove: false,
      },
    });

    // Start container
    await container.start();
    logger.info(`Sandbox container ${container.id} started successfully for task ${taskId}`);

    return {
      containerId: container.id,
      taskId,
      image: imageName,
      workspacePath,
      status: 'running',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Executes a command inside the active sandbox container.
   * Captures stdout and stderr separately, enforces strict timeouts, and returns execution metrics.
   */
  static async executeCommand(
    containerId: string,
    command: string,
    options: ExecCommandOptions = {},
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || config.commandTimeoutMs;
    const container = docker.getContainer(containerId);

    logger.info(`[Sandbox ${containerId.substring(0, 8)}] Executing command: "${command}"`);

    const envVars = options.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : undefined;

    // Create exec instance inside container
    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: options.workingDir || CONTAINER_WORKSPACE_PATH,
      Env: envVars,
    });

    const stream = await exec.start({ Detach: false, Tty: false });

    // Buffers to collect demuxed stdout and stderr streams
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    // Dockerode demuxStream splits the multiplexed stream into stdout & stderr
    docker.modem.demuxStream(stream, stdoutStream, stderrStream);

    let timedOut = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const streamPromise = new Promise<void>((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Command timed out after ${timeoutMs}ms: "${command}"`));
      }, timeoutMs);
    });

    try {
      await Promise.race([streamPromise, timeoutPromise]);
    } catch (execErr) {
      if (timedOut) {
        logger.warn(`[Sandbox ${containerId.substring(0, 8)}] Command timed out: "${command}"`);
      } else {
        logger.error(`[Sandbox ${containerId.substring(0, 8)}] Stream execution error:`, execErr);
        throw execErr;
      }
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
    }

    const duration = Date.now() - startTime;
    const inspectResult = await exec.inspect();
    const exitCode = timedOut ? -1 : (inspectResult.ExitCode ?? 0);

    const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
    const stderr = Buffer.concat(stderrChunks).toString('utf-8');

    logger.info(
      `[Sandbox ${containerId.substring(0, 8)}] Command finished in ${duration}ms (exit code: ${exitCode})`,
    );

    return {
      exitCode,
      stdout,
      stderr,
      timedOut,
      executionTimeMs: duration,
    };
  }

  /**
   * Forcefully stops and removes a sandbox container.
   */
  static async stopAndRemoveContainer(containerId: string, timeoutSec: number = 5): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      logger.info(`Stopping and removing container ${containerId.substring(0, 8)}...`);

      try {
        await container.stop({ t: timeoutSec });
      } catch {
        // Container might already be stopped
      }

      await container.remove({ force: true, v: true });
      logger.info(`Container ${containerId.substring(0, 8)} removed successfully.`);
    } catch (err) {
      logger.warn(`Failed to clean up container ${containerId}:`, err);
    }
  }

  /**
   * Cleans up all orphaned containers associated with a specific task.
   */
  static async cleanupTaskContainers(taskId: string): Promise<void> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: {
          label: [`taskId=${taskId}`, `${CONTAINER_MANAGED_LABEL}=true`],
        },
      });

      for (const info of containers) {
        await this.stopAndRemoveContainer(info.Id);
      }
    } catch (err) {
      logger.warn(`Error during task container cleanup for task ${taskId}:`, err);
    }
  }

  /**
   * Cleans up all containers created and managed by Coding Harness.
   * Useful during graceful application shutdown.
   */
  static async cleanupAllManagedContainers(): Promise<void> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: {
          label: [`${CONTAINER_MANAGED_LABEL}=true`],
        },
      });

      logger.info(`Cleaning up ${containers.length} active Coding Harness sandbox containers...`);
      for (const info of containers) {
        await this.stopAndRemoveContainer(info.Id, 2);
      }
    } catch (err) {
      logger.warn('Error cleaning up managed sandbox containers:', err);
    }
  }
}
