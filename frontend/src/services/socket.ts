import { io, Socket } from 'socket.io-client';
import { AgentStepLog, TaskStatus } from '@coding-harness/shared';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export interface TaskSubscriptionCallbacks {
  onLog?: (log: string, timestamp: string) => void;
  onStatus?: (status: TaskStatus) => void;
  onStep?: (step: AgentStepLog) => void;
  onDiff?: (diff: string) => void;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_BASE_URL || undefined, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function subscribeToTask(taskId: string, callbacks: TaskSubscriptionCallbacks): () => void {
  const ws = getSocket();

  const handleConnect = () => {
    ws.emit('join:task', taskId);
  };

  if (ws.connected) {
    ws.emit('join:task', taskId);
  } else {
    ws.on('connect', handleConnect);
  }

  const logHandler = (data: { taskId: string; log: string; timestamp: string }) => {
    if (data.taskId === taskId && callbacks.onLog) {
      callbacks.onLog(data.log, data.timestamp);
    }
  };

  const statusHandler = (data: { taskId: string; status: TaskStatus }) => {
    if (data.taskId === taskId && callbacks.onStatus) {
      callbacks.onStatus(data.status);
    }
  };

  const stepHandler = (data: { taskId: string; step: AgentStepLog }) => {
    if (data.taskId === taskId && callbacks.onStep) {
      callbacks.onStep(data.step);
    }
  };

  const diffHandler = (data: { taskId: string; diff: string }) => {
    if (data.taskId === taskId && callbacks.onDiff) {
      callbacks.onDiff(data.diff);
    }
  };

  ws.on('task:log', logHandler);
  ws.on('task:status', statusHandler);
  ws.on('task:step', stepHandler);
  ws.on('task:diff', diffHandler);

  // Return cleanup unsubscribe function
  return () => {
    ws.emit('leave:task', taskId);
    ws.off('connect', handleConnect);
    ws.off('task:log', logHandler);
    ws.off('task:status', statusHandler);
    ws.off('task:step', stepHandler);
    ws.off('task:diff', diffHandler);
  };
}
