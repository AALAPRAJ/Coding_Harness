import { spawn } from 'child_process';
import readline from 'readline';
import { AgentLoopResult } from '@coding-harness/shared';

/** Run Claude Code in a dedicated, trusted demo workspace. */
export async function runClaudeCode(options: {
  workspacePath: string;
  prompt: string;
  onProgress: (message: string) => Promise<void>;
  executable?: string;
  executableArgs?: string[];
}): Promise<AgentLoopResult> {
  const model = process.env.CLAUDE_CODE_MODEL || 'gemini-3.5-flash';
  const budget = process.env.CLAUDE_CODE_MAX_BUDGET_USD || '5.00';
  const turns = process.env.CLAUDE_CODE_MAX_TURNS || '20';
  const timeoutMs = Number(process.env.CLAUDE_CODE_TIMEOUT_MS || '900000');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid Claude timeout');

  const args = [
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
    '--model',
    model,
    '--max-budget-usd',
    budget,
    '--max-turns',
    turns,
    '--dangerously-skip-permissions',
  ];
  const child = spawn(
    options.executable || process.env.CLAUDE_CODE_BINARY || 'claude',
    [...(options.executableArgs || []), ...args],
    {
      cwd: options.workspacePath,
      env: process.env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  child.stdin.on('error', () => {
    /* process failure is reported below */
  });
  child.stdin.end(options.prompt);
  let pending = Promise.resolve();
  let resultError: string | undefined;
  let finalAnswer: string | undefined;
  let lastAssistantText: string | undefined;
  let sawResult = false;
  let timedOut = false;
  const log = (message: string) => {
    pending = pending.then(() => options.onProgress(message));
  };
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try {
      const event = JSON.parse(line);
      if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
        for (const part of event.message.content) {
          if (part.type === 'text' && part.text) {
            lastAssistantText = String(part.text);
            log(lastAssistantText);
          } else if (part.type === 'tool_use') log(`Claude tool: ${part.name}`);
        }
      } else if (event.type === 'user' && Array.isArray(event.message?.content)) {
        for (const part of event.message.content) {
          if (part.type !== 'tool_result') continue;
          const output =
            typeof part.content === 'string'
              ? part.content
              : Array.isArray(part.content)
                ? part.content.map((item: { text?: string }) => item.text || '').join('\n')
                : '';
          if (output.trim()) log(`Tool output: ${output.slice(0, 6000)}`);
        }
      } else if (event.type === 'result') {
        sawResult = true;
        if (event.result) {
          finalAnswer = String(event.result);
          if (finalAnswer !== lastAssistantText) log(finalAnswer);
        }
        if (event.is_error || event.subtype !== 'success') {
          resultError = String(event.result || event.subtype || 'Claude returned an error');
        }
      }
    } catch {
      if (line.trim()) log(line);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => log(chunk.trim()));
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid && process.platform !== 'win32') {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already exited */
      }
    } else child.kill('SIGKILL');
  }, timeoutMs);
  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    await pending;
    if (timedOut) throw new Error(`Claude Code exceeded ${timeoutMs} ms`);
    if (exitCode !== 0 || resultError || !sawResult) {
      throw new Error(
        resultError || `Claude Code exited with code ${exitCode} without a successful result`,
      );
    }
    return { success: true, iterations: 0, totalToolCalls: 0, steps: [], summary: finalAnswer };
  } finally {
    clearTimeout(timer);
    lines.close();
  }
}
