import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Terminal, Shield, Cpu, Activity, RefreshCw } from 'lucide-react';
import { ApiService } from '../services/api';
import { HealthCheckResponse } from '@coding-harness/shared';

export function Navbar() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);

  const fetchHealth = async () => {
    try {
      const data = await ApiService.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-200/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-dark-100 rounded-[10px] flex items-center justify-center">
                <Terminal className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">Coding Harness</span>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Autonomous AI
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                Isolated Sandboxed Developer Engine
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {/* Health indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'ok'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : health?.status === 'degraded'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-gray-300 font-medium">
              {health
                ? health.status === 'ok'
                  ? 'Systems Online'
                  : 'Degraded Mode'
                : 'Backend Offline'}
            </span>
            {health?.database && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  health.database.connected
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-red-950 text-red-300'
                }`}
                title="PostgreSQL Status"
              >
                DB
              </span>
            )}
            {health?.docker && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  health.docker.connected
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-amber-950 text-amber-300'
                }`}
                title="Docker Sandbox Status"
              >
                Docker
              </span>
            )}
          </div>

          <Link
            href="/"
            className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-card"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
