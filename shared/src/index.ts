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
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
}
