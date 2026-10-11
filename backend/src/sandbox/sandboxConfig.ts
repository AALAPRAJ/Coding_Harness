import { config } from '../config';

/**
 * Supported container base images for sandboxed task execution.
 */
export const SUPPORTED_SANDBOX_IMAGES: Record<string, string> = {
  node18: 'node:18-alpine',
  node20: 'node:20-alpine',
  python39: 'python:3.9-alpine',
  python311: 'python:3.11-alpine',
};

/**
 * Sandbox resource constraints and limits.
 */
export interface SandboxResourceLimits {
  /** Memory in bytes (default 512MB) */
  memory: number;
  /** NanoCPUs (1 CPU = 1_000_000_000) */
  nanoCpus: number;
  /** Maximum process execution time in milliseconds (default 60s) */
  timeoutMs: number;
  /** Maximum bytes captured from stdout / stderr before truncating */
  maxOutputBytes: number;
}

export const defaultSandboxLimits: SandboxResourceLimits = {
  memory: config.sandboxMemoryLimit,
  nanoCpus: config.sandboxNanoCpus,
  timeoutMs: config.commandTimeoutMs,
  maxOutputBytes: 10 * 1024 * 1024, // 10MB
};

/**
 * Path where the workspace directory is mounted inside the Docker container.
 */
export const CONTAINER_WORKSPACE_PATH = '/workspace';

/**
 * System label applied to all Docker containers spawned by Coding Harness.
 * Allows easy identification and safe bulk cleanup.
 */
export const CONTAINER_MANAGED_LABEL = 'coding-harness-sandbox';
