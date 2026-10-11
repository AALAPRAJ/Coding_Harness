import {
  ToolDefinition,
  ToolName,
  ToolResult,
  ViewFileInput,
  WriteFileInput,
  ReplaceFileContentInput,
  ListDirInput,
  GrepSearchInput,
  RunCommandInput,
} from '@coding-harness/shared';
import { FileSystemTools } from './fileSystem';
import { CommandRunner } from './commandRunner';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../logger';

/**
 * Runtime execution context provided to every tool call.
 */
export interface ToolExecutionContext {
  taskId: string;
  workspacePath: string;
  containerId?: string;
}

/**
 * JSON Schema definitions for LLM tool / function calling (Phase 4 ready).
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: ToolName.VIEW_FILE,
    description:
      'Reads and returns the contents of a specified file with optional 1-indexed line numbers.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to inspect within the workspace.',
        },
        startLine: {
          type: 'integer',
          description: 'Optional 1-indexed starting line number.',
        },
        endLine: {
          type: 'integer',
          description: 'Optional 1-indexed ending line number.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: ToolName.WRITE_FILE,
    description:
      'Creates a new file or completely overwrites an existing file with the provided content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to write within the workspace.',
        },
        content: {
          type: 'string',
          description: 'The exact content to write into the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: ToolName.REPLACE_FILE_CONTENT,
    description:
      'Replaces an exact target snippet of code inside an existing file with replacement content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to edit.',
        },
        targetContent: {
          type: 'string',
          description: 'The exact matching text or block of code to find and replace.',
        },
        replacementContent: {
          type: 'string',
          description: 'The new text or block of code to replace the target snippet with.',
        },
      },
      required: ['path', 'targetContent', 'replacementContent'],
    },
  },
  {
    name: ToolName.LIST_DIR,
    description:
      'Lists files and directories located in the specified relative path within the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the directory to inspect (defaults to root workspace).',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to recursively traverse subdirectories (default false).',
        },
        maxDepth: {
          type: 'integer',
          description: 'Maximum recursion depth if recursive is true (default 3).',
        },
      },
      required: [],
    },
  },
  {
    name: ToolName.GREP_SEARCH,
    description: 'Searches for a text pattern or regular expression across files in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or pattern to search for.',
        },
        path: {
          type: 'string',
          description: 'Relative subdirectory to search within (defaults to root workspace).',
        },
        caseInsensitive: {
          type: 'boolean',
          description: 'Whether search should ignore case (default true).',
        },
        isRegex: {
          type: 'boolean',
          description: 'Whether the query is a regular expression pattern (default false).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: ToolName.RUN_COMMAND,
    description:
      'Executes a shell command (e.g. "npm test", "npm run build", "python script.py") strictly inside the isolated Docker sandbox.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command line to execute inside the sandbox.',
        },
        timeoutMs: {
          type: 'integer',
          description:
            'Maximum allowed execution time in milliseconds before terminating (default 60000).',
        },
        workingDir: {
          type: 'string',
          description: 'Working directory inside the sandbox (defaults to /workspace).',
        },
      },
      required: ['command'],
    },
  },
];

export class ToolRegistry {
  /**
   * Retrieves all whitelisted tool definitions formatted for LLM schema consumption.
   */
  static getToolDefinitions(): ToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  /**
   * Checks whether a tool name is currently supported and whitelisted.
   */
  static isAllowedTool(toolName: string): boolean {
    return Object.values(ToolName).includes(toolName as ToolName);
  }

  /**
   * Dispatches and executes an authorized tool call within the task workspace and sandbox context.
   */
  static async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    logger.info(
      `[Task ${context.taskId}] Executing tool "${toolName}" with args: ${JSON.stringify(args)}`,
    );

    if (!this.isAllowedTool(toolName)) {
      return {
        toolName,
        success: false,
        error: `Tool "${toolName}" is not recognized or not authorized in the execution registry.`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      let output: unknown;

      switch (toolName) {
        case ToolName.VIEW_FILE: {
          const input = args as unknown as ViewFileInput;
          if (!input.path) throw new AppError('Missing required parameter: "path"', 400);
          output = await FileSystemTools.viewFile(
            context.workspacePath,
            input.path,
            input.startLine,
            input.endLine,
          );
          break;
        }

        case ToolName.WRITE_FILE: {
          const input = args as unknown as WriteFileInput;
          if (!input.path || input.content === undefined) {
            throw new AppError('Missing required parameters: "path" and "content"', 400);
          }
          output = await FileSystemTools.writeFile(
            context.workspacePath,
            input.path,
            input.content,
          );
          break;
        }

        case ToolName.REPLACE_FILE_CONTENT: {
          const input = args as unknown as ReplaceFileContentInput;
          if (
            !input.path ||
            input.targetContent === undefined ||
            input.replacementContent === undefined
          ) {
            throw new AppError('Missing required parameters for replace_file_content', 400);
          }
          output = await FileSystemTools.replaceFileContent(
            context.workspacePath,
            input.path,
            input.targetContent,
            input.replacementContent,
          );
          break;
        }

        case ToolName.LIST_DIR: {
          const input = args as unknown as ListDirInput;
          output = await FileSystemTools.listDir(
            context.workspacePath,
            input.path || '.',
            input.recursive || false,
            input.maxDepth || 3,
          );
          break;
        }

        case ToolName.GREP_SEARCH: {
          const input = args as unknown as GrepSearchInput;
          if (!input.query) throw new AppError('Missing required parameter: "query"', 400);
          output = await FileSystemTools.grepSearch(
            context.workspacePath,
            input.query,
            input.path || '.',
            input.caseInsensitive ?? true,
            input.isRegex ?? false,
          );
          break;
        }

        case ToolName.RUN_COMMAND: {
          const input = args as unknown as RunCommandInput;
          if (!input.command) throw new AppError('Missing required parameter: "command"', 400);

          if (!context.containerId) {
            throw new AppError(
              'Cannot execute run_command: No active Docker sandbox container attached to this task session.',
              400,
              'NO_SANDBOX',
            );
          }

          output = await CommandRunner.runCommand({
            command: input.command,
            containerId: context.containerId,
            workingDir: input.workingDir,
            timeoutMs: input.timeoutMs,
          });
          break;
        }

        default:
          throw new AppError(`Unhandled tool: "${toolName}"`, 400);
      }

      const duration = Date.now() - startTime;
      return {
        toolName,
        success: true,
        output,
        executionTimeMs: duration,
      };
    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - startTime;
      logger.warn(`Tool execution error [${toolName}]: ${err.message}`);

      return {
        toolName,
        success: false,
        error: err.message,
        executionTimeMs: duration,
      };
    }
  }
}
