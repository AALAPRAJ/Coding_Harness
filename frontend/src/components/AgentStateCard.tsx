import React from 'react';
import { TaskStatus, AgentStepLog, AgentActionType } from '@coding-harness/shared';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  GitCommit,
  Wrench,
  Brain,
  ShieldCheck,
} from 'lucide-react';

interface AgentStateCardProps {
  status: TaskStatus;
  latestStep?: AgentStepLog;
  iterations?: number;
  toolCallsCount?: number;
  repoUrl?: string;
}

export function AgentStateCard({
  status,
  latestStep,
  iterations = 0,
  toolCallsCount = 0,
  repoUrl,
}: AgentStateCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
          </span>
        );
      case TaskStatus.FAILED:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-semibold">
            <XCircle className="w-4 h-4" />
            <span>Failed</span>
          </span>
        );
      case TaskStatus.RUNNING:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Running</span>
          </span>
        );
      case TaskStatus.PENDING:
      default:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold">
            <Clock className="w-4 h-4" />
            <span>Pending in Queue</span>
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-dark-border shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-dark-border/60">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Agent State
          </h3>
          <p className="text-white text-base font-bold mt-0.5 truncate max-w-xs sm:max-w-md">
            {repoUrl ? repoUrl.replace('https://github.com/', '') : 'Repository Workspace'}
          </p>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
        <div className="bg-dark-100 p-3 rounded-xl border border-dark-border">
          <div className="flex items-center space-x-2 text-gray-400 text-xs">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Iterations</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{iterations}</div>
        </div>

        <div className="bg-dark-100 p-3 rounded-xl border border-dark-border">
          <div className="flex items-center space-x-2 text-gray-400 text-xs">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tool Calls</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{toolCallsCount}</div>
        </div>

        <div className="bg-dark-100 p-3 rounded-xl border border-dark-border col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-2 text-gray-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sandbox</span>
          </div>
          <div className="text-sm font-bold text-white mt-1">Docker Isolated</div>
        </div>
      </div>

      {/* Active Step Info */}
      {latestStep && (
        <div className="mt-4 p-3.5 rounded-xl bg-dark-100/70 border border-dark-border">
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
            <span>Current Step: {latestStep.action}</span>
            {latestStep.toolName && (
              <span className="px-2 py-0.5 rounded bg-brand-950 text-brand-300 font-mono text-[10px]">
                {latestStep.toolName}
              </span>
            )}
          </div>
          {latestStep.thought && (
            <p className="text-xs text-gray-300 line-clamp-2 mt-1 italic">
              &quot;{latestStep.thought}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
