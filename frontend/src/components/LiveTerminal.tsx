import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, ArrowDown, Search, Filter } from 'lucide-react';

interface LiveTerminalProps {
  logs: string;
  isRunning?: boolean;
}

export function LiveTerminal({ logs, isRunning = false }: LiveTerminalProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logLines = logs ? logs.split('\n') : [];
  const filteredLines = searchQuery
    ? logLines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : logLines;

  // Formats line coloring based on contents
  const renderLogLine = (line: string, index: number) => {
    if (!line.trim()) return null;

    let textColor = 'text-gray-300';

    if (
      line.includes('error') ||
      line.includes('Error') ||
      line.includes('failed') ||
      line.includes('SECURITY_VIOLATION')
    ) {
      textColor = 'text-red-400 bg-red-950/20';
    } else if (line.includes('warn') || line.includes('Warning')) {
      textColor = 'text-amber-400';
    } else if (line.includes('Agent Reasoning:') || line.includes('[Agent Thought]')) {
      textColor = 'text-purple-300 font-semibold';
    } else if (line.includes('Executing tool') || line.includes('Tool [')) {
      textColor = 'text-emerald-400 font-medium';
    } else if (line.includes('completed successfully') || line.includes('PASSED')) {
      textColor = 'text-green-300 font-semibold';
    } else if (line.includes('--- Starting Agent Iteration')) {
      textColor = 'text-cyan-400 font-bold';
    }

    return (
      <div
        key={index}
        className={`flex items-start font-mono text-xs py-0.5 px-2 rounded hover:bg-white/5 ${textColor}`}
      >
        <span className="text-gray-600 select-none mr-3 w-8 text-right flex-shrink-0">
          {index + 1}
        </span>
        <span className="break-all whitespace-pre-wrap">{line}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-dark-300 border border-dark-border overflow-hidden shadow-2xl">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-100 border-b border-dark-border flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <Terminal className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold text-gray-200">Execution Console</span>
          {isRunning && (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[10px] font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping mr-1" />
              Live Streaming
            </span>
          )}
        </div>

        {/* Console Controls */}
        <div className="flex items-center space-x-2">
          {/* Search filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2 py-1 bg-dark-card border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 w-32 sm:w-44"
            />
          </div>

          {/* Autoscroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              autoScroll
                ? 'bg-brand-500/20 border-brand-500/30 text-brand-300'
                : 'bg-dark-card border-dark-border text-gray-400 hover:text-white'
            }`}
            title={autoScroll ? 'Autoscroll ON' : 'Autoscroll OFF'}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-xs text-gray-300 hover:text-white hover:bg-dark-border transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-brand-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-xs terminal-scroll space-y-0.5 bg-[#0d0f12]">
        {filteredLines.length > 0 ? (
          filteredLines.map((line, idx) => renderLogLine(line, idx))
        ) : (
          <div className="p-8 text-center text-gray-500">
            {searchQuery
              ? 'No log lines match your search filter.'
              : 'Waiting for task logs to stream...'}
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
