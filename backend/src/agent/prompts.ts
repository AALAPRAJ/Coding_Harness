import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { logger } from '../logger';

/**
 * System prompt defining the AI software developer agent's role, behavioral constraints, and workflow.
 */
export const SYSTEM_PROMPT = `You are Coding Harness Agent, an autonomous expert software engineering assistant.
You operate directly on a real codebase in an isolated workspace.

Your goal is to inspect the codebase, plan the necessary changes, modify the code using available tools, run tests/checks to verify correctness, and iterate until the task is successfully accomplished.

### Guidelines & Rules:
1. First inspect relevant files using \`view_file\`, \`list_dir\`, or \`grep_search\` before editing anything.
2. Formulate a clear, step-by-step plan before making edits.
3. Use \`write_file\` to create new files or overwrite complete contents.
4. Use \`replace_file_content\` for targeted, precise edits to existing files.
5. After editing files, run verification commands (such as \`npm test\`, \`npm run build\`, or language test suites) using \`run_command\`.
6. If a command fails or tests fail, inspect the error output, fix the mistakes, and verify again.
7. Avoid infinite loops. Make progress with each iteration.
8. When the task is complete and all verification passes, provide a concise summary of the changes made and conclude your response.
`;

/**
 * Analyzes the project workspace to extract high-value initial context for the LLM.
 * Gathers directory tree, dependency manifests (package.json, requirements.txt), and README summaries.
 */
export async function buildProjectContext(workspacePath: string): Promise<string> {
  const contextParts: string[] = [];

  try {
    // 1. Check for package.json (Node.js / TypeScript projects)
    const pkgPath = path.join(workspacePath, 'package.json');
    if (fsSync.existsSync(pkgPath)) {
      try {
        const pkgContent = await fs.readFile(pkgPath, 'utf-8');
        const parsed = JSON.parse(pkgContent);
        contextParts.push(
          `### Project Manifest (package.json):
- Name: ${parsed.name || 'unnamed'}
- Version: ${parsed.version || '0.0.0'}
- Scripts: ${JSON.stringify(parsed.scripts || {}, null, 2)}
- Dependencies: ${Object.keys(parsed.dependencies || {}).join(', ') || 'none'}
- DevDependencies: ${Object.keys(parsed.devDependencies || {}).join(', ') || 'none'}`,
        );
      } catch {
        // Ignore json parse error
      }
    }

    // 2. Check for Python requirements.txt or pyproject.toml
    const reqPath = path.join(workspacePath, 'requirements.txt');
    if (fsSync.existsSync(reqPath)) {
      try {
        const reqContent = await fs.readFile(reqPath, 'utf-8');
        contextParts.push(
          `### Python Dependencies (requirements.txt):
${reqContent.slice(0, 500)}`,
        );
      } catch {
        // Ignore read error
      }
    }

    // 3. Check for README.md
    const readmePath = path.join(workspacePath, 'README.md');
    if (fsSync.existsSync(readmePath)) {
      try {
        const readmeContent = await fs.readFile(readmePath, 'utf-8');
        // Include first 800 characters of README
        const summary = readmeContent.slice(0, 800);
        contextParts.push(
          `### Project README Summary:
${summary}${readmeContent.length > 800 ? '\n...(truncated)' : ''}`,
        );
      } catch {
        // Ignore read error
      }
    }

    // 4. Root directory listing
    try {
      const entries = await fs.readdir(workspacePath, { withFileTypes: true });
      const visibleEntries = entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));

      contextParts.push(
        `### Workspace Root Files:
${visibleEntries.join(', ')}`,
      );
    } catch {
      // Ignore readdir error
    }
  } catch (err) {
    logger.warn('Failed to compile project context:', err);
  }

  return contextParts.length > 0
    ? contextParts.join('\n\n')
    : 'No manifest or README found in project root.';
}

/**
 * Creates the initial user task prompt incorporating the project context and user request.
 */
export function createInitialUserPrompt(prompt: string, projectContext: string): string {
  return `Task Objective:
"${prompt}"

Here is the initial context of the repository:
${projectContext}

Please inspect the necessary files, plan your modifications, apply the changes, and verify your work.`;
}

/**
 * Formats command failure output into an iteration fix prompt for the agent.
 */
export function createErrorFeedbackPrompt(
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): string {
  return `The command "${command}" failed with exit code ${exitCode}.
Stderr:
${stderr || 'No stderr output'}

Stdout:
${stdout || 'No stdout output'}

Please analyze the error, locate the issue in the codebase, make the necessary fix, and re-run verification.`;
}
