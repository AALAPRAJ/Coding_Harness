import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  buildProjectContext,
  createInitialUserPrompt,
  createErrorFeedbackPrompt,
} from '../src/agent/prompts';
import { ToolCallParser } from '../src/agent/parser';
import { LLMClient } from '../src/agent/llmClient';
import { AgentLoop } from '../src/agent/agentLoop';
import { ToolRegistry } from '../src/tools/toolRegistry';
import { GitService } from '../src/services/gitService';

/**
 * Diagnostic and integration test suite for Phase 4:
 * AI Agent Orchestration, Context Building, Tool Parsing, and Mock Agent Loop.
 */
export async function runPhase4Tests(): Promise<boolean> {
  console.log('\n========================================');
  console.log('   🤖  PHASE 4: AI AGENT LOOP TESTS');
  console.log('========================================');

  let allPassed = true;
  const tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-test-agent-'));

  try {
    // ----------------------------------------------------
    // 1. Context Gathering: buildProjectContext
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing buildProjectContext... ');
    await fs.writeFile(
      path.join(tempWorkspace, 'package.json'),
      JSON.stringify({
        name: 'test-harness-app',
        version: '1.0.0',
        scripts: { test: 'jest', build: 'tsc' },
        dependencies: { express: '^4.18.2' },
      }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(tempWorkspace, 'README.md'),
      '# Test Harness App\nThis is a sample project for testing AI context building.',
      'utf-8',
    );

    const context = await buildProjectContext(tempWorkspace);
    assert.ok(context.includes('test-harness-app'), 'Context should include package name');
    assert.ok(context.includes('express'), 'Context should include dependencies');
    assert.ok(context.includes('Test Harness App'), 'Context should include README content');
    console.log('✓ OK (Extracted manifest, README & file listing)');

    // ----------------------------------------------------
    // 2. Prompt Formatters
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Prompt Formatters... ');
    const userPrompt = createInitialUserPrompt('Fix bug in auth middleware', context);
    assert.ok(userPrompt.includes('Fix bug in auth middleware'));
    assert.ok(userPrompt.includes('test-harness-app'));

    const errorPrompt = createErrorFeedbackPrompt(
      'npm test',
      1,
      'Test Suites: 1 failed',
      'TypeError: Cannot read property of undefined',
    );
    assert.ok(errorPrompt.includes('npm test'));
    assert.ok(errorPrompt.includes('TypeError: Cannot read property'));
    console.log('✓ OK (Task prompt and error feedback formatters verified)');

    // ----------------------------------------------------
    // 3. ToolCallParser: Native OpenAI & Fallback Text Parsing
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing ToolCallParser... ');
    const nativeCalls = ToolCallParser.parseOpenAIToolCalls([
      {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'view_file',
          arguments: '{"path":"src/index.ts","startLine":1,"endLine":20}',
        },
      },
    ]);
    assert.strictEqual(nativeCalls.length, 1);
    assert.strictEqual(nativeCalls[0].name, 'view_file');
    assert.strictEqual(nativeCalls[0].args.path, 'src/index.ts');
    assert.strictEqual(nativeCalls[0].args.startLine, 1);

    // Test text-embedded markdown fallback
    const textOutput =
      'I will inspect the file now:\n```json\n{"tool":"list_dir","args":{"path":"src"}}\n```';
    const textCalls = ToolCallParser.parseTextToolCalls(textOutput);
    assert.strictEqual(textCalls.length, 1);
    assert.strictEqual(textCalls[0].name, 'list_dir');
    assert.strictEqual(textCalls[0].args.path, 'src');
    console.log('✓ OK (Native & text-fallback parsers verified)');

    // ----------------------------------------------------
    // 4. LLMClient: Tool Schema Formatting
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing LLMClient tool formatting... ');
    const definitions = ToolRegistry.getToolDefinitions();
    const openAITools = LLMClient.formatToolsForOpenAI(definitions);
    assert.strictEqual(openAITools.length, 6);
    assert.strictEqual(openAITools[0].type, 'function');
    assert.ok(openAITools[0].function.name);
    assert.ok(openAITools[0].function.description);
    assert.ok(openAITools[0].function.parameters);
    console.log(`✓ OK (${openAITools.length} tools formatted for OpenAI specs)`);

    // ----------------------------------------------------
    // 5. Mock Agent Loop Execution End-to-End
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Mock Agent Loop end-to-end execution... ');
    // Initialize git repository in workspace so diff can be computed
    await GitService.initRepository(tempWorkspace);

    const mockLlm = new LLMClient(undefined, undefined, true);
    const progressLogs: string[] = [];

    const agentResult = await AgentLoop.run({
      taskId: 'test-agent-task-42',
      workspacePath: tempWorkspace,
      prompt: 'Inspect files and update documentation',
      llmClient: mockLlm,
      maxIterations: 5,
      onProgress: (log) => {
        progressLogs.push(log);
      },
    });

    assert.strictEqual(agentResult.success, true);
    assert.ok(agentResult.iterations > 0);
    assert.ok(agentResult.totalToolCalls > 0);
    assert.ok(progressLogs.length > 0);
    assert.ok(progressLogs.some((l) => l.includes('Phase 4')));
    console.log(
      `✓ OK (${agentResult.iterations} iteration(s), ${agentResult.totalToolCalls} tool call(s))`,
    );

    console.log('\n✅ All Phase 4 AI Agent Loop tests passed successfully!\n');
  } catch (err) {
    allPassed = false;
    console.error('\n❌ Phase 4 test failed with error:');
    console.error(err);
  } finally {
    try {
      await fs.rm(tempWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }

  return allPassed;
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('phase4.test')) {
  runPhase4Tests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
