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
};
