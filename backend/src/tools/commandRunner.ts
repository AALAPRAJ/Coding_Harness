import { DockerManager, CommandExecutionResult } from '../sandbox/dockerManager';
import { CONTAINER_WORKSPACE_PATH } from '../sandbox/sandboxConfig';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../logger';

export interface CommandRunnerInput {
  command: string;
  containerId: string;
  workingDir?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export class CommandRunner {
  /**
   * Routes and executes shell commands securely inside the active Docker sandbox container.
   */
  static async runCommand(input: CommandRunnerInput): Promise<CommandExecutionResult> {
    const { command, containerId, workingDir, timeoutMs, env } = input;

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      throw new AppError('Command string cannot be empty', 400, 'INVALID_COMMAND');
    }

    // Security sanitization: prevent null-byte injection and destructive host/system attacks
    if (command.includes('\0')) {
      throw new AppError(
        'Null-byte injection detected in command string',
        400,
        'SECURITY_VIOLATION',
      );
    }

    const dangerousPatterns = [
      /\brm\s+-rf\s+\/(?:\s|$|\*)/, // rm -rf /
      /\bchmod\s+.*\/etc\//,
      /\bmount\b/,
      /\bumount\b/,
      /\bchroot\b/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        logger.error(`Blocked potentially destructive command pattern: "${command}"`);
        throw new AppError(
          `Command rejected by sandbox security policy: matched dangerous pattern`,
          400,
          'SECURITY_VIOLATION',
        );
      }
    }

    if (!containerId || typeof containerId !== 'string') {
      throw new AppError(
        'Active Docker sandbox containerId is required to run commands',
        400,
        'NO_CONTAINER',
      );
    }

    logger.info(`Routing command to Docker sandbox ${containerId.substring(0, 8)}: "${command}"`);

    try {
      const result = await DockerManager.executeCommand(containerId, command, {
        workingDir: workingDir || CONTAINER_WORKSPACE_PATH,
        timeoutMs,
        env,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to execute command inside Docker sandbox: ${err.message}`);
      throw new AppError(`Docker sandbox execution error: ${err.message}`, 500, 'EXECUTION_FAILED');
    }
  }
}
