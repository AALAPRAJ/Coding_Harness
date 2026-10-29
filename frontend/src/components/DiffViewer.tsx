import React, { useState } from 'react';
import { GitPullRequest, Download, Copy, Check, FileCode, CheckCircle } from 'lucide-react';
import { TaskStatus } from '@coding-harness/shared';

interface DiffViewerProps {
  diff: string;
  taskId: string;
  status: TaskStatus;
}

export function DiffViewer({ diff, taskId, status }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPatch = () => {
    const blob = new Blob([diff], { type: 'text/x-diff;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${taskId.substring(0, 8)}.patch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!diff || !diff.trim()) {
    return (
      <div className="glass-panel rounded-2xl p-8 border border-dark-border text-center">
        <FileCode className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-gray-300">
          {status === TaskStatus.COMPLETED ? 'No Code Changes' : 'No Git Diff Available'}
        </h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          {status === TaskStatus.COMPLETED
            ? 'This task finished without changes to the repository.'
            : status === TaskStatus.FAILED
              ? 'No patch was recorded for this failed task.'
              : 'A diff will appear here if the agent changes files.'}
        </p>
      </div>
    );
  }

  const lines = diff.split('\n');

  return (
    <div className="glass-panel rounded-2xl border border-dark-border overflow-hidden shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-dark-100 border-b border-dark-border">
        <div className="flex items-center space-x-2">
          <GitPullRequest className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-bold text-white">Generated Code Diff</span>
          <span className="text-xs text-gray-400 font-mono ml-2">({lines.length} lines)</span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-border border border-dark-border text-xs text-gray-200 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-brand-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy Diff'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPatch}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-md shadow-brand-600/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .patch</span>
          </button>
        </div>
      </div>

      {/* Diff Code View */}
      <div className="p-4 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs space-y-0.5 bg-[#0a0c0e]">
        {lines.map((line, idx) => {
          let lineClass = 'text-gray-400';
          let bgClass = 'hover:bg-white/5';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-cyan-400 font-bold';
            bgClass = 'bg-cyan-950/20';
          } else if (line.startsWith('+')) {
            lineClass = 'text-emerald-300';
            bgClass = 'bg-emerald-950/30';
          } else if (line.startsWith('-')) {
            lineClass = 'text-red-300';
            bgClass = 'bg-red-950/30';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-blue-400 font-semibold';
            bgClass = 'bg-blue-950/25';
          } else if (line.startsWith('diff --git')) {
            lineClass = 'text-yellow-300 font-bold border-t border-dark-border/80 pt-2 mt-2';
          }

          return (
            <div key={idx} className={`flex items-start px-2 py-0.5 rounded ${bgClass}`}>
              <span className="text-gray-600 select-none mr-3 w-8 text-right flex-shrink-0">
                {idx + 1}
              </span>
              <span className={`break-all whitespace-pre-wrap ${lineClass}`}>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
