/**
 * @file index.ts
 * @description Shared domain contracts, enums, and API interfaces for Coding Harness.
 * Shared between backend, frontend, and worker services to ensure end-to-end type safety.
 */

/**
 * Lifecycle states of an automated coding task.
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * User representation in the system.
 */
export interface User {
  id: string;
  email: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Automated coding task submitted by a user.
 */
export interface Task {
  id: string;
  userId?: string | null;
  repoUrl: string;
  status: TaskStatus;
  prompt: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Execution session created for a specific task run.
 * Contains runtime logs, agent output, and generated Git diffs.
 */
export interface Session {
  id: string;
  taskId: string;
  logs: string;
  resultDiff?: string | null;
  startedAt: Date | string;
  finishedAt?: Date | string | null;
}

/**
 * Payload required to submit a new coding task.
 */
export interface CreateTaskInput {
  repoUrl: string;
  prompt: string;
  branch?: string;
  userId?: string;
}

/**
 * Standardized successful API response wrapper.
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Standardized error API response wrapper.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Health check response structure for monitoring system status.
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    connected: boolean;
    latencyMs?: number;
    message?: string;
  };
  redis?: {
    connected: boolean;
    latencyMs?: number;
    message?: string;
  };
  docker?: {
    connected: boolean;
    version?: string;
    latencyMs?: number;
    message?: string;
  };
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
}

/**
 * Payload required to register a new user.
 */
export interface RegisterUserInput {
  email: string;
  password: string;
}

/**
 * Payload required to authenticate an existing user.
 */
export interface LoginUserInput {
  email: string;
  password: string;
}

/**
 * Authentication response containing user session and JWT token.
 */
export interface AuthResponse {
  user: User;
  token: string;
}

/**
 * Job payload submitted to the background task queue (BullMQ).
 */
export interface TaskJobData {
  taskId: string;
  repoUrl: string;
  prompt: string;
  branch?: string;
  userId?: string | null;
  zipFilePath?: string;
}

/**
 * Detailed Task view including all associated execution sessions.
 */
export interface TaskWithSessions extends Task {
  sessions: Session[];
}

/**
 * Supported execution tools for the AI agent in Phase 3 & 4.
 */
export enum ToolName {
  VIEW_FILE = 'view_file',
  WRITE_FILE = 'write_file',
  REPLACE_FILE_CONTENT = 'replace_file_content',
  LIST_DIR = 'list_dir',
  GREP_SEARCH = 'grep_search',
  RUN_COMMAND = 'run_command',
}

/**
 * Parameter interface for view_file tool.
 */
export interface ViewFileInput {
  path: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Parameter interface for write_file tool.
 */
export interface WriteFileInput {
  path: string;
  content: string;
}

/**
 * Parameter interface for replace_file_content tool.
 */
export interface ReplaceFileContentInput {
  path: string;
  targetContent: string;
  replacementContent: string;
}

/**
 * Parameter interface for list_dir tool.
 */
export interface ListDirInput {
  path?: string;
  recursive?: boolean;
  maxDepth?: number;
}

/**
 * Parameter interface for grep_search tool.
 */
export interface GrepSearchInput {
  query: string;
  path?: string;
  caseInsensitive?: boolean;
  isRegex?: boolean;
}

/**
 * Parameter interface for run_command tool.
 */
export interface RunCommandInput {
  command: string;
  timeoutMs?: number;
  workingDir?: string;
}

/**
 * Standardized execution result returned by all tools.
 */
export interface ToolResult<T = unknown> {
  toolName: string;
  success: boolean;
  output?: T;
  error?: string;
  executionTimeMs: number;
}

/**
 * Tool definition contract for LLM function calling registry.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Sandbox container runtime status metadata.
 */
export interface SandboxContainerInfo {
  containerId: string;
  taskId: string;
  image: string;
  workspacePath: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: string;
}

/**
 * Agent execution step action type.
 */
export enum AgentActionType {
  ANALYZE = 'ANALYZE',
  PLAN = 'PLAN',
  TOOL_CALL = 'TOOL_CALL',
  VERIFY = 'VERIFY',
  FINISH = 'FINISH',
  ERROR = 'ERROR',
}

/**
 * Logged agent step during the iteration loop.
 */
export interface AgentStepLog {
  step: number;
  action: AgentActionType;
  thought?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  timestamp: string;
}

/**
 * Result of the AI agent iteration loop.
 */
export interface AgentLoopResult {
  success: boolean;
  iterations: number;
  totalToolCalls: number;
  steps: AgentStepLog[];
  finalDiff?: string;
  error?: string;
}
