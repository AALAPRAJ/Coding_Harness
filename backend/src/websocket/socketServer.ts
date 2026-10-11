import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { AgentStepLog, TaskStatus } from '@coding-harness/shared';
import { config } from '../config';
import { logger } from '../logger';

let ioInstance: SocketIOServer | null = null;

export class SocketServer {
  /**
   * Initializes the Socket.IO WebSocket server attached to Express HTTP server.
   */
  static init(server: HttpServer): SocketIOServer {
    if (ioInstance) {
      return ioInstance;
    }

    const allowedOrigins =
      config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map((o) => o.trim());

    ioInstance = new SocketIOServer(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    ioInstance.on('connection', (socket: Socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Client subscribes to real-time events for a specific task
      socket.on('join:task', (taskId: string) => {
        if (!taskId) return;
        const room = `task:${taskId}`;
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined room ${room}`);
        socket.emit('joined:task', { taskId, room });
      });

      // Client unsubscribes from a task room
      socket.on('leave:task', (taskId: string) => {
        if (!taskId) return;
        const room = `task:${taskId}`;
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left room ${room}`);
      });

      socket.on('disconnect', (reason) => {
        logger.debug(`WebSocket client ${socket.id} disconnected: ${reason}`);
      });
    });

    logger.info('WebSocket Server (Socket.IO) initialized successfully');
    return ioInstance;
  }

  /**
   * Retrieves the active Socket.IO server instance.
   */
  static getInstance(): SocketIOServer | null {
    return ioInstance;
  }

  /**
   * Broadcasts a real-time terminal log entry to all clients listening to a task.
   */
  static emitTaskLog(taskId: string, logLine: string): void {
    if (!ioInstance) return;
    ioInstance.to(`task:${taskId}`).emit('task:log', {
      taskId,
      log: logLine,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts a task lifecycle state transition event (RUNNING, COMPLETED, FAILED).
   */
  static emitTaskStatus(taskId: string, status: TaskStatus): void {
    if (!ioInstance) return;
    ioInstance.to(`task:${taskId}`).emit('task:status', {
      taskId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts an AI agent execution step (thought, tool call, verification).
   */
  static emitTaskStep(taskId: string, stepLog: AgentStepLog): void {
    if (!ioInstance) return;
    ioInstance.to(`task:${taskId}`).emit('task:step', {
      taskId,
      step: stepLog,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts the final unified Git diff once generated.
   */
  static emitTaskDiff(taskId: string, diff: string): void {
    if (!ioInstance) return;
    ioInstance.to(`task:${taskId}`).emit('task:diff', {
      taskId,
      diff,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Shuts down the Socket.IO server cleanly.
   */
  static async close(): Promise<void> {
    if (ioInstance) {
      await new Promise<void>((resolve) => {
        ioInstance!.close(() => {
          ioInstance = null;
          logger.info('WebSocket Server closed.');
          resolve();
        });
      });
    }
  }
}
