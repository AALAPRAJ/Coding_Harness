import React, { useState } from 'react';
import { Check, Clipboard, FileText } from 'lucide-react';

/** Render common Markdown safely as React elements; raw HTML is never interpreted. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={index} className="rounded bg-dark-border px-1 text-emerald-200">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

function MarkdownResult({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let code: string[] | null = null;
  let language = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      if (code === null) {
        code = [];
        language = line.trim().slice(3).trim();
      } else {
        blocks.push(
          <pre
            key={`code-${i}`}
            className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-gray-200"
          >
            <code aria-label={language || undefined}>{code.join('\n')}</code>
          </pre>,
        );
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      blocks.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }
    if (/^\s*---\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${i}`} className="border-dark-border my-3" />);
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <div
          key={`heading-${i}`}
          role="heading"
          aria-level={Math.min(heading[1].length + 3, 6)}
          className="mt-3 text-sm font-semibold text-white"
        >
          {inline(heading[2])}
        </div>,
      );
      continue;
    }
    const list = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)(.*)$/);
    if (list) {
      blocks.push(
        <div key={`item-${i}`} className="flex gap-2 pl-2">
          <span aria-hidden="true" className="text-brand-400">
            •
          </span>
          <span>{inline(list[1])}</span>
        </div>,
      );
      continue;
    }
    blocks.push(<p key={`line-${i}`}>{inline(line)}</p>);
  }
  if (code !== null)
    blocks.push(
      <pre key="unfinished-code" className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">
        <code>{code.join('\n')}</code>
      </pre>,
    );
  return <div className="space-y-1 text-sm leading-6 text-gray-300 break-words">{blocks}</div>;
}

export function TaskResult({ summary, prompt }: { summary: string; prompt?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      className="glass-panel rounded-2xl border border-dark-border overflow-hidden shadow-xl"
      aria-labelledby="task-result-heading"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-dark-100 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-400" />
          <h2 id="task-result-heading" className="text-sm font-bold text-white">
            Task Result
          </h2>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-gray-200 hover:text-white"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy result'}
        </button>
      </div>
      {prompt && (
        <div className="border-b border-dark-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Your request
          </p>
          <p className="mt-1 text-sm text-gray-300 whitespace-pre-wrap">{prompt}</p>
        </div>
      )}
      <div className="max-h-[620px] overflow-y-auto px-5 py-4">
        <MarkdownResult text={summary} />
      </div>
    </section>
  );
}
