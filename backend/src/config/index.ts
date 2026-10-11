import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  databaseUrl: string;
  corsOrigin: string;
  logLevel: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  workspacesDir: string;
  uploadsDir: string;
  dockerSocketPath?: string;
  sandboxImage: string;
  sandboxMemoryLimit: number;
  sandboxNanoCpus: number;
  commandTimeoutMs: number;
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl?: string;
  aiModel: string;
  agentMaxIterations: number;
  agentTemperature: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgrespassword@localhost:5432/coding_harness?schema=public',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  jwtSecret: process.env.JWT_SECRET || 'coding-harness-dev-jwt-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  workspacesDir:
    process.env.WORKSPACES_DIR ||
    path.resolve(process.env.TMPDIR || '/tmp', 'coding-harness/workspaces'),
  uploadsDir:
    process.env.UPLOADS_DIR || path.resolve(process.env.TMPDIR || '/tmp', 'coding-harness/uploads'),
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH || undefined,
  sandboxImage: process.env.SANDBOX_IMAGE || 'node:18-alpine',
  sandboxMemoryLimit: parseInt(process.env.SANDBOX_MEMORY_LIMIT || `${512 * 1024 * 1024}`, 10),
  sandboxNanoCpus: parseInt(process.env.SANDBOX_NANOCPUS || `${1 * 1000000000}`, 10),
  commandTimeoutMs: parseInt(process.env.COMMAND_TIMEOUT_MS || '60000', 10),
  aiProvider: process.env.AI_PROVIDER || 'openai',
  aiApiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  agentMaxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || '10', 10),
  agentTemperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.2'),
};
