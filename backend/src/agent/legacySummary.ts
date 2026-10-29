/** Recover the final Claude Code result from logs written before summaries were stored. */
export function extractLegacySummary(logs: string): string | null {
  if (!logs.includes('Claude Code will run on the demo VM.')) return null;
  const entries = logs.split(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] /m);
  const finish = entries.findIndex(
    (entry) => entry.trim() === 'Agent execution finished successfully.',
  );
  if (finish < 1) return null;
  const answer = entries[finish - 1].trim();
  if (!answer || /^(Tool output:|Claude tool:|\[claude-code:)/.test(answer)) return null;
  return answer;
}
