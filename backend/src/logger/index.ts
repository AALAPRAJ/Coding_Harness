import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom console format for human-friendly local development
const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` | meta: ${JSON.stringify(meta)}` : '';
  const errorDetails = stack ? `\n${stack}` : '';
  return `[${timestamp}] [${level}]: ${message}${metaString}${errorDetails}`;
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  defaultMeta: { service: 'coding-harness-backend' },
  transports: [
    new winston.transports.Console({
      format: config.isProduction
        ? combine(json())
        : combine(colorize({ all: true }), devLogFormat),
    }),
  ],
});
