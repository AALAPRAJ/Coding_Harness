import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  GitBranch,
  FolderArchive,
  ArrowRight,
  Sparkles,
  Loader2,
  Link2,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import { ApiService } from '../services/api';

export function TaskForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<'url' | 'zip'>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!prompt.trim()) {
      setErrorMessage('Please enter a natural language task prompt for the agent.');
      return;
    }

    if (sourceType === 'url' && !repoUrl.trim()) {
      setErrorMessage('Please provide a Git repository clone URL.');
      return;
    }

    if (sourceType === 'zip' && !file) {
      setErrorMessage('Please select a .zip repository archive to upload.');
      return;
    }

    setIsSubmitting(true);

    try {
      const task = await ApiService.submitTask({
        repoUrl: sourceType === 'url' ? repoUrl.trim() : undefined,
        branch: branch.trim() || undefined,
        prompt: prompt.trim(),
        file: sourceType === 'zip' && file ? file : undefined,
      });

      // Redirect immediately to the live execution view
      router.push(`/tasks/${task.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while submitting your task.');
      setIsSubmitting(false);
    }
  };

  const setExamplePrompt = (exampleText: string) => {
    setPrompt(exampleText);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-dark-border">
      {/* Decorative gradient glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <span>Submit Coding Task</span>
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Provide your repository and instructions. The agent will work in a cloned workspace and
          produce a Git diff.
        </p>
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <p className="text-xs text-amber-300 mt-2">
            Use only trusted public GitHub repositories. The agent can run code on the demo VM.
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-200 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Type Toggle */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
            Repository Source
          </label>
          <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-dark-100 border border-dark-border">
            <button
              type="button"
              onClick={() => setSourceType('url')}
              className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                sourceType === 'url'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>Git URL</span>
            </button>
            {process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && (
              <button
                type="button"
                onClick={() => setSourceType('zip')}
                className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  sourceType === 'zip'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-dark-card'
                }`}
              >
                <FolderArchive className="w-4 h-4" />
                <span>Upload ZIP Archive</span>
              </button>
            )}
          </div>
        </div>

        {/* URL Inputs */}
        {sourceType === 'url' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Git Repository URL <span className="text-brand-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/repository.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-100 border border-dark-border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center justify-between">
                <span>Branch (Optional)</span>
                <span className="text-gray-500 text-xs">Defaults to default branch</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <GitBranch className="w-4 h-4 text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="main, master, develop..."
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-100 border border-dark-border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Zip File Upload Input */
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Upload Repository (.zip archive) <span className="text-brand-400">*</span>
            </label>
            <div className="border-2 border-dashed border-dark-border hover:border-brand-500/50 rounded-xl p-6 text-center cursor-pointer bg-dark-100/50 hover:bg-dark-100 transition-all relative">
              <input
                type="file"
                accept=".zip"
                required={sourceType === 'zip'}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-10 h-10 text-brand-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">
                {file ? file.name : 'Click or drag a .zip file here'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected`
                  : 'Supports up to 50MB repositories'}
              </p>
            </div>
          </div>
        )}

        {/* Task Prompt Input */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Task Description / Instructions <span className="text-brand-400">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Explain the changes you want the AI to make. Example: 'Add unit tests for user authentication and verify they pass using npm test'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-4 py-3 bg-dark-100 border border-dark-border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-y font-sans"
          />

          {/* Quick suggestions */}
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-gray-500">Quick ideas:</span>
            <button
              type="button"
              onClick={() =>
                setExamplePrompt(
                  'Fix failing unit tests in the test suite and verify clean test execution',
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-dark-100 hover:bg-dark-border text-gray-300 transition-colors"
            >
              Fix failing tests
            </button>
            <button
              type="button"
              onClick={() =>
                setExamplePrompt('Add a /health status endpoint and test it with curl or tests')
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-dark-100 hover:bg-dark-border text-gray-300 transition-colors"
            >
              Add /health endpoint
            </button>
            <button
              type="button"
              onClick={() =>
                setExamplePrompt(
                  'Refactor database query logic to use connection pooling and handle timeouts',
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-dark-100 hover:bg-dark-border text-gray-300 transition-colors"
            >
              Refactor DB query logic
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Queueing Task & Provisioning Workspace...</span>
            </>
          ) : (
            <>
              <span>Launch Autonomous Agent</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
