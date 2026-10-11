import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, GitBranch, RefreshCw, AlertCircle, Share2, Check } from 'lucide-react';
import { ApiService } from '../../services/api';
import { subscribeToTask } from '../../services/socket';
import { LiveTerminal } from '../../components/LiveTerminal';
import { AgentStateCard } from '../../components/AgentStateCard';
import { DiffViewer } from '../../components/DiffViewer';
import { TaskWithSessions, TaskStatus, AgentStepLog } from '@coding-harness/shared';

export default function TaskExecutionView() {
  const router = useRouter();
  const { id } = router.query;
  const taskId = typeof id === 'string' ? id : '';

  const [task, setTask] = useState<TaskWithSessions | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [diff, setDiff] = useState<string>('');
  const [latestStep, setLatestStep] = useState<AgentStepLog | undefined>(undefined);
  const [iterations, setIterations] = useState<number>(0);
  const [toolCallsCount, setToolCallsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // 1. Fetch initial task snapshot
  const fetchTaskDetails = async () => {
    if (!taskId) return;
    try {
      const data = await ApiService.getTask(taskId);
      setTask(data);
      setStatus(data.status);

      // Extract existing session logs if available
      const latestSession = data.sessions && data.sessions[0];
      if (latestSession) {
        if (latestSession.logs) {
          setLogs(latestSession.logs);
        }
        if (latestSession.resultDiff) {
          setDiff(latestSession.resultDiff);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load task details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  // 2. Real-time WebSocket connection
  useEffect(() => {
    if (!taskId) return;

    const unsubscribe = subscribeToTask(taskId, {
      onLog: (newLog) => {
        setLogs((prev) => (prev ? `${prev}${newLog}\n` : `${newLog}\n`));
      },
      onStatus: (newStatus) => {
        setStatus(newStatus);
      },
      onStep: (stepLog) => {
        setLatestStep(stepLog);
        if (stepLog.step) {
          setIterations(stepLog.step);
        }
        if (stepLog.action === 'TOOL_CALL') {
          setToolCallsCount((prev) => prev + 1);
        }
      },
      onDiff: (newDiff) => {
        setDiff(newDiff);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [taskId]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading task session details...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !task) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Task Not Found</h2>
        <p className="text-sm text-gray-400">{errorMessage}</p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-dark-card hover:bg-dark-border border border-dark-border text-sm text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-border">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-dark-100 hover:bg-dark-card border border-dark-border text-gray-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
                Task: {taskId.substring(0, 12)}...
              </h1>
              <span className="text-xs text-gray-500 font-mono">
                {task?.createdAt ? new Date(task.createdAt).toLocaleTimeString() : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
              <GitBranch className="w-3.5 h-3.5 text-brand-400" />
              <span className="truncate max-w-xs">{task?.repoUrl}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchTaskDetails}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-100 hover:bg-dark-card border border-dark-border text-xs text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-100 hover:bg-dark-card border border-dark-border text-xs text-gray-300 hover:text-white transition-colors"
          >
            {linkCopied ? (
              <Check className="w-3.5 h-3.5 text-brand-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{linkCopied ? 'Link Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Task Prompt Overview Banner */}
      {task?.prompt && (
        <div className="p-4 rounded-xl bg-dark-100 border border-dark-border">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Prompt Instructions
          </span>
          <p className="text-sm text-gray-200">{task.prompt}</p>
        </div>
      )}

      {/* Split-Pane Execution View (Pane 1: Terminal, Pane 2: State & Diff) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pane 1: Live Terminal UI (7 cols on large screens) */}
        <div className="lg:col-span-7 h-[680px]">
          <LiveTerminal logs={logs} isRunning={status === TaskStatus.RUNNING} />
        </div>

        {/* Pane 2: Agent State & Result Diff Viewer (5 cols on large screens) */}
        <div className="lg:col-span-5 space-y-6">
          <AgentStateCard
            status={status}
            latestStep={latestStep}
            iterations={iterations}
            toolCallsCount={toolCallsCount}
            repoUrl={task?.repoUrl}
          />

          <DiffViewer diff={diff} taskId={taskId} />
        </div>
      </div>
    </div>
  );
}
