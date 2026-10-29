import React, { useEffect, useState } from 'react';
import { TaskStatus, AgentStepLog, AgentActionType } from '@coding-harness/shared';
import { ApiService } from '../services/api';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  GitCommit,
  Wrench,
  Brain,
  ShieldCheck,
  ExternalLink,
  Server,
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
  const [vmReachable, setVmReachable] = useState<boolean | null>(null);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    if (!demoMode) return;
    let active = true;
    const checkVm = async () => {
      try {
        const health = await ApiService.getHealth();
        if (active) setVmReachable(health?.service === 'coding-harness-backend');
      } catch {
        if (active) setVmReachable(false);
      }
    };
    checkVm();
    const timer = setInterval(checkVm, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [demoMode]);

  let repositoryLink: string | undefined;
  if (repoUrl) {
    try {
      const url = new URL(repoUrl);
      if (url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password) repositoryLink = url.href;
    } catch {
      // Uploaded archives and other identifiers are displayed as text.
    }
  }

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
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Agent State</h3>
        <div>{getStatusBadge()}</div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-gray-400">Repository</p>
        {repositoryLink ? (
          <a href={repositoryLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-start gap-1.5 text-sm text-brand-400 hover:text-brand-300 break-all">
            <span>{repoUrl}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          </a>
        ) : <p className="mt-1 text-sm text-white break-all">{repoUrl || 'Repository unavailable'}</p>}
      </div>

      {/* Metrics Row */}
      {demoMode ? (
        <div className="my-4 rounded-xl border border-dark-border bg-dark-100 p-3">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Server className="h-3.5 w-3.5 text-cyan-400" />
            <span>Execution environment</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-white" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${vmReachable === true ? 'bg-emerald-400' : vmReachable === false ? 'bg-amber-400' : 'bg-gray-500'}`} />
            {vmReachable === true ? 'GCP VM running' : vmReachable === false ? 'GCP VM status unavailable' : 'Checking GCP VM…'}
          </p>
          <p className="mt-1 text-xs text-gray-400">{vmReachable === true ? 'Backend reachable · Use trusted repositories only.' : 'Checking whether the demo backend is reachable.'}</p>
        </div>
      ) : (
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
      )}

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
