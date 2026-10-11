import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileSystemTools } from '../src/tools/fileSystem';
import { ToolRegistry } from '../src/tools/toolRegistry';
import { DockerManager } from '../src/sandbox/dockerManager';
import { ToolName } from '@coding-harness/shared';

/**
 * Diagnostic and integration test suite for Phase 3:
 * Tool Execution Layer, FileSystem Safeguards, and Docker Sandbox Manager.
 */
export async function runPhase3Tests(): Promise<boolean> {
  console.log('\n========================================');
  console.log('   🛠️  PHASE 3: TOOLS & SANDBOX TESTS');
  console.log('========================================');

  let allPassed = true;
  const tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-test-ws-'));

  try {
    // ----------------------------------------------------
    // 1. FileSystem Security: Path Traversal Protection
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Path Traversal Defense... ');
    try {
      FileSystemTools.resolveSafePath(tempWorkspace, '../../etc/passwd');
      assert.fail('Should have thrown SECURITY_VIOLATION for directory traversal');
    } catch (err: any) {
      assert.strictEqual(err.code, 'SECURITY_VIOLATION');
    }

    try {
      FileSystemTools.resolveSafePath(tempWorkspace, 'subfolder/../../../outside');
      assert.fail('Should have thrown SECURITY_VIOLATION for nested traversal');
    } catch (err: any) {
      assert.strictEqual(err.code, 'SECURITY_VIOLATION');
    }
    console.log('✓ OK (Path traversal blocked)');

    // ----------------------------------------------------
    // 2. FileSystem: write_file tool
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing write_file tool... ');
    const writeResult = await FileSystemTools.writeFile(
      tempWorkspace,
      'src/components/Button.tsx',
      'import React from "react";\nexport function Button() {\n  return <button>Click me</button>;\n}\n',
    );
    assert.strictEqual(writeResult.filePath, 'src/components/Button.tsx');
    assert.ok(writeResult.bytesWritten > 0);
    console.log(`✓ OK (${writeResult.bytesWritten} bytes written)`);

    // ----------------------------------------------------
    // 3. FileSystem: view_file tool with line slicing
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing view_file tool... ');
    const viewFull = await FileSystemTools.viewFile(tempWorkspace, 'src/components/Button.tsx');
    assert.strictEqual(viewFull.totalLines, 5);
    assert.strictEqual(viewFull.startLine, 1);
    assert.strictEqual(viewFull.endLine, 5);
    assert.ok(viewFull.content.includes('1: import React from "react";'));

    const viewSlice = await FileSystemTools.viewFile(
      tempWorkspace,
      'src/components/Button.tsx',
      2,
      3,
    );
    assert.strictEqual(viewSlice.startLine, 2);
    assert.strictEqual(viewSlice.endLine, 3);
    assert.ok(viewSlice.content.includes('2: export function Button()'));
    console.log('✓ OK (View and 1-indexed slicing verified)');

    // ----------------------------------------------------
    // 4. FileSystem: replace_file_content tool
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing replace_file_content tool... ');
    const replaceRes = await FileSystemTools.replaceFileContent(
      tempWorkspace,
      'src/components/Button.tsx',
      '<button>Click me</button>',
      '<button className="btn-primary">Submitted</button>',
    );
    assert.strictEqual(replaceRes.replacedOccurrences, 1);

    const updatedFile = await fs.readFile(
      path.join(tempWorkspace, 'src/components/Button.tsx'),
      'utf-8',
    );
    assert.ok(updatedFile.includes('className="btn-primary"'));
    console.log('✓ OK (Snippet replaced cleanly)');

    // ----------------------------------------------------
    // 5. FileSystem: list_dir tool
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing list_dir tool... ');
    await FileSystemTools.writeFile(tempWorkspace, 'README.md', '# Test Workspace\n');
    await FileSystemTools.writeFile(tempWorkspace, 'package.json', '{"name":"test"}\n');

    const dirListing = await FileSystemTools.listDir(tempWorkspace, '.', true);
    assert.ok(dirListing.some((item) => item.path === 'README.md'));
    assert.ok(dirListing.some((item) => item.path === 'src'));
    assert.ok(dirListing.some((item) => item.path === 'src/components/Button.tsx'));
    console.log(`✓ OK (${dirListing.length} entries cataloged)`);

    // ----------------------------------------------------
    // 6. FileSystem: grep_search tool
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing grep_search tool... ');
    const grepRes = await FileSystemTools.grepSearch(tempWorkspace, 'btn-primary');
    assert.strictEqual(grepRes.totalMatches, 1);
    assert.strictEqual(grepRes.matches[0].file, 'src/components/Button.tsx');
    assert.strictEqual(grepRes.matches[0].lineNumber, 3);

    const regexGrepRes = await FileSystemTools.grepSearch(
      tempWorkspace,
      'export\\s+function',
      '.',
      true,
      true,
    );
    assert.ok(regexGrepRes.totalMatches >= 1);
    console.log(
      `✓ OK (Found ${grepRes.totalMatches} literal & ${regexGrepRes.totalMatches} regex matches)`,
    );

    // ----------------------------------------------------
    // 7. ToolRegistry: Whitelist & Schema Definitions
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing ToolRegistry schema definitions... ');
    const definitions = ToolRegistry.getToolDefinitions();
    assert.strictEqual(definitions.length, 6);
    assert.ok(ToolRegistry.isAllowedTool(ToolName.VIEW_FILE));
    assert.ok(ToolRegistry.isAllowedTool(ToolName.WRITE_FILE));
    assert.ok(ToolRegistry.isAllowedTool(ToolName.REPLACE_FILE_CONTENT));
    assert.ok(ToolRegistry.isAllowedTool(ToolName.LIST_DIR));
    assert.ok(ToolRegistry.isAllowedTool(ToolName.GREP_SEARCH));
    assert.ok(ToolRegistry.isAllowedTool(ToolName.RUN_COMMAND));
    assert.strictEqual(ToolRegistry.isAllowedTool('unauthorized_tool'), false);
    console.log('✓ OK (6 whitelisted tools verified)');

    // ----------------------------------------------------
    // 8. ToolRegistry: Dispatcher execution
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing ToolRegistry execution dispatcher... ');
    const context = {
      taskId: 'test-task-123',
      workspacePath: tempWorkspace,
    };

    const execResult = await ToolRegistry.executeTool(
      ToolName.VIEW_FILE,
      { path: 'README.md' },
      context,
    );
    assert.strictEqual(execResult.success, true);
    assert.ok(execResult.executionTimeMs >= 0);

    const invalidToolResult = await ToolRegistry.executeTool('unauthorized_tool', {}, context);
    assert.strictEqual(invalidToolResult.success, false);
    assert.ok(invalidToolResult.error?.includes('not authorized'));

    const runCmdWithoutContainer = await ToolRegistry.executeTool(
      ToolName.RUN_COMMAND,
      { command: 'ls -la' },
      context,
    );
    assert.strictEqual(runCmdWithoutContainer.success, false);
    assert.ok(runCmdWithoutContainer.error?.includes('No active Docker sandbox container'));
    console.log('✓ OK (Tool dispatcher & authorization verified)');

    // ----------------------------------------------------
    // 9. DockerManager: Connection Diagnostics
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing DockerManager connectivity diagnostics... ');
    const dockerDiagnostics = await DockerManager.checkDockerConnection();
    const dockerStatusText = dockerDiagnostics.connected
      ? `Online (v${dockerDiagnostics.version}, latency: ${dockerDiagnostics.latencyMs}ms)`
      : `Offline / Degraded (${dockerDiagnostics.message})`;
    console.log(`✓ OK (${dockerStatusText})`);

    console.log('\n✅ All Phase 3 Tool Execution & Sandbox tests passed successfully!\n');
  } catch (err) {
    allPassed = false;
    console.error('\n❌ Phase 3 test failed with error:');
    console.error(err);
  } finally {
    // Teardown temporary test workspace
    try {
      await fs.rm(tempWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }

  return allPassed;
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('phase3.test')) {
  runPhase3Tests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
