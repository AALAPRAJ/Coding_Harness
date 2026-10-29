import React from 'react';
import Link from 'next/link';
import { Terminal } from 'lucide-react';
import { ProjectCostCard } from './ProjectCostCard';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-200/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-dark-100 rounded-[10px] flex items-center justify-center">
                <Terminal className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">Coding Harness</span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">AI Developer Engine</p>
            </div>
          </Link>
        </div>

        <ProjectCostCard />
      </div>
    </header>
  );
}
