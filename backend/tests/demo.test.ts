import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { runClaudeCode } from '../src/agent/claudeCodeRunner';
import { GitService } from '../src/services/gitService';
import { extractLegacySummary } from '../src/agent/legacySummary';

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'coding-harness-demo-'));
  const oldTimeout = process.env.CLAUDE_CODE_TIMEOUT_MS;
  try {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig('user.name', 'Demo Test');
    await git.addConfig('user.email', 'demo-test@example.invalid');
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'before\n');
    await git.add('.');
    await git.commit('baseline');
    const base = await GitService.getHeadCommit(dir);
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'committed\n');
    await git.add('.');
    await git.commit('agent commit');
    await fs.writeFile(path.join(dir, 'new.txt'), 'new file\n');
    const diff = await GitService.getGitDiff(dir, base);
    assert.match(diff, /\+committed/);
    assert.match(diff, /\+new file/);
    const clonePath = path.join(dir, 'clean-clone');
    await simpleGit().clone(dir, clonePath);
    const clean = simpleGit(clonePath);
    await clean.checkout(base.trim());
    const patchPath = path.join(dir, 'changes.patch');
    await fs.writeFile(patchPath, diff);
    await clean.raw(['apply', '--check', patchPath]);

    const logs: string[] = [];
    const script = `console.log(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'working'}]}}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'done'}))`;
    const result = await runClaudeCode({
      workspacePath: dir,
      prompt: '- test',
      onProgress: async (m) => {
        logs.push(m);
      },
      executable: process.execPath,
      executableArgs: ['-e', script, '--'],
    });
    assert.equal(result.success, true);
    assert.equal(result.summary, 'done');
    assert.deepEqual(logs, ['working', 'done']);
    const oldLog =
      '[2026-10-28T22:43:03.746Z] Claude Code will run on the demo VM. Use only trusted repositories.\n[2026-10-28T22:43:32.000Z] Here is the answer.\nMore details.\n[2026-10-28T22:43:33.501Z] Agent execution finished successfully.\n[2026-10-28T22:43:33.765Z] Task execution phase completed successfully.\n';
    assert.equal(extractLegacySummary(oldLog), 'Here is the answer.\nMore details.');
    assert.equal(
      extractLegacySummary(
        oldLog.replace('Agent execution finished successfully.', 'Task execution failed: error'),
      ),
      null,
    );
    assert.equal(
      extractLegacySummary(
        oldLog.replace('Here is the answer.\nMore details.', 'Tool output: internal'),
      ),
      null,
    );
    const duplicateLogs: string[] = [];
    const duplicateScript = `console.log(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'Final answer'}]}}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'Final answer'}))`;
    const duplicateResult = await runClaudeCode({
      workspacePath: dir,
      prompt: 'test',
      onProgress: async (m) => {
        duplicateLogs.push(m);
      },
      executable: process.execPath,
      executableArgs: ['-e', duplicateScript, '--'],
    });
    assert.equal(duplicateResult.summary, 'Final answer');
    assert.deepEqual(duplicateLogs, ['Final answer']);
    await assert.rejects(
      runClaudeCode({
        workspacePath: dir,
        prompt: 'test',
        onProgress: async () => {},
        executable: process.execPath,
        executableArgs: ['-e', 'process.exit(2)', '--'],
      }),
      /exited with code 2/,
    );
    process.env.CLAUDE_CODE_TIMEOUT_MS = '100';
    await assert.rejects(
      runClaudeCode({
        workspacePath: dir,
        prompt: 'test',
        onProgress: async () => {},
        executable: process.execPath,
        executableArgs: ['-e', 'setTimeout(() => {}, 10000)', '--'],
      }),
      /exceeded/,
    );
    console.log('Demo runner and patch tests passed');
  } finally {
    if (oldTimeout === undefined) delete process.env.CLAUDE_CODE_TIMEOUT_MS;
    else process.env.CLAUDE_CODE_TIMEOUT_MS = oldTimeout;
    await fs.rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
