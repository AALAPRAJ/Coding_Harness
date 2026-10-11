import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TaskForm } from '../components/TaskForm';
import { ApiService } from '../services/api';
import { Task, TaskStatus } from '@coding-harness/shared';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  GitBranch,
  ArrowRight,
  History,
  Shield,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    try {
      const data = await ApiService.listTasks(10, 0);
      setTasks(data.tasks);
    } catch {
      // Backend might be booting or offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 8000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case TaskStatus.FAILED:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case TaskStatus.RUNNING:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-medium animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Running</span>
          </span>
        );
      case TaskStatus.PENDING:
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-4">
          <Shield className="w-3.5 h-3.5" />
          <span>Isolated Docker Sandbox &bull; Verified Git Diffs</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Autonomous AI Developer for Your Codebase
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-400 leading-relaxed">
          Submit any task, issue, or feature request. The system clones your repository into an
          isolated sandbox, edits files, executes real tests, and verifies the diff until it works.
        </p>
      </div>

      {/* Main Grid: Form (Left) & Recent Tasks History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Task Submission Form */}
        <div className="lg:col-span-7">
          <TaskForm />
        </div>

        {/* Right Column: Recent Tasks History */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-6 border border-dark-border shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-dark-border/60">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Recent Tasks
                </h3>
              </div>
              <button
                type="button"
                onClick={loadTasks}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-dark-card transition-colors"
                title="Refresh tasks"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Task List */}
            <div className="mt-4 space-y-3">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block p-3.5 rounded-xl bg-dark-100 hover:bg-dark-card border border-dark-border hover:border-brand-500/40 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2 truncate max-w-[200px] sm:max-w-[240px]">
                        <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">
                          {task.repoUrl.replace('https://github.com/', '')}
                        </span>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2 mt-1">{task.prompt}</p>

                    <div className="mt-2.5 pt-2 border-t border-dark-border/40 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{new Date(task.createdAt).toLocaleString()}</span>
                      <span className="text-brand-400 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1">
                        <span>View Console</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <Cpu className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs">No tasks recorded yet.</p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Submit your first task using the form on the left!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
