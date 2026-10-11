import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../logger';

export interface ViewFileResult {
  filePath: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  content: string;
}

export interface ListDirItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes?: number;
}

export interface GrepMatch {
  file: string;
  lineNumber: number;
  lineContent: string;
}

export class FileSystemTools {
  /**
   * Strictly verifies that a given relative path does not escape the workspace root.
   * Protects against Directory Traversal attacks (e.g. "../../../etc/passwd").
   */
  static resolveSafePath(workspacePath: string, relativePath: string = '.'): string {
    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTarget = path.resolve(resolvedWorkspace, relativePath);

    if (!resolvedTarget.startsWith(resolvedWorkspace)) {
      logger.error(`Directory traversal attack blocked: ${relativePath} in ${workspacePath}`);
      throw new AppError(
        `Security violation: Target path "${relativePath}" escapes task workspace`,
        400,
        'SECURITY_VIOLATION',
      );
    }

    return resolvedTarget;
  }

  /**
   * Reads and views file content with optional 1-indexed line slicing.
   */
  static async viewFile(
    workspacePath: string,
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<ViewFileResult> {
    const safePath = this.resolveSafePath(workspacePath, filePath);

    if (!fsSync.existsSync(safePath)) {
      throw new AppError(`File not found: "${filePath}"`, 404, 'FILE_NOT_FOUND');
    }

    const stat = await fs.stat(safePath);
    if (stat.isDirectory()) {
      throw new AppError(
        `Target path "${filePath}" is a directory, not a file`,
        400,
        'IS_DIRECTORY',
      );
    }

    const rawContent = await fs.readFile(safePath, 'utf-8');
    const lines = rawContent.split('\n');
    const totalLines = lines.length;

    const fromLine = Math.max(1, startLine || 1);
    const toLine = Math.min(totalLines, endLine || totalLines);

    if (fromLine > toLine) {
      throw new AppError(
        `Invalid line range: startLine (${fromLine}) cannot be greater than endLine (${toLine})`,
        400,
        'INVALID_RANGE',
      );
    }

    // Format content with line numbers (1-indexed)
    const selectedLines = lines.slice(fromLine - 1, toLine);
    const numberedContent = selectedLines
      .map((line, index) => `${fromLine + index}: ${line}`)
      .join('\n');

    return {
      filePath,
      totalLines,
      startLine: fromLine,
      endLine: toLine,
      content: numberedContent,
    };
  }

  /**
   * Writes content to a file, automatically creating parent directories if they don't exist.
   */
  static async writeFile(
    workspacePath: string,
    filePath: string,
    content: string,
  ): Promise<{ filePath: string; bytesWritten: number }> {
    const safePath = this.resolveSafePath(workspacePath, filePath);
    const parentDir = path.dirname(safePath);

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');

    const bytesWritten = Buffer.byteLength(content, 'utf-8');
    logger.debug(`Wrote ${bytesWritten} bytes to "${filePath}" in workspace ${workspacePath}`);

    return {
      filePath,
      bytesWritten,
    };
  }

  /**
   * Replaces an exact snippet of code within a file.
   */
  static async replaceFileContent(
    workspacePath: string,
    filePath: string,
    targetContent: string,
    replacementContent: string,
  ): Promise<{ filePath: string; replacedOccurrences: number }> {
    const safePath = this.resolveSafePath(workspacePath, filePath);

    if (!fsSync.existsSync(safePath)) {
      throw new AppError(`File not found: "${filePath}"`, 404, 'FILE_NOT_FOUND');
    }

    const currentContent = await fs.readFile(safePath, 'utf-8');

    if (!currentContent.includes(targetContent)) {
      throw new AppError(
        `Target content snippet was not found in "${filePath}". Ensure exact match.`,
        400,
        'TARGET_NOT_FOUND',
      );
    }

    const occurrences = currentContent.split(targetContent).length - 1;
    const newContent = currentContent.replace(targetContent, replacementContent);

    await fs.writeFile(safePath, newContent, 'utf-8');
    logger.debug(`Replaced snippet in "${filePath}" (${occurrences} match found)`);

    return {
      filePath,
      replacedOccurrences: occurrences,
    };
  }

  /**
   * Lists files and folders within a workspace directory.
   */
  static async listDir(
    workspacePath: string,
    relativePath: string = '.',
    recursive: boolean = false,
    maxDepth: number = 3,
  ): Promise<ListDirItem[]> {
    const safePath = this.resolveSafePath(workspacePath, relativePath);

    if (!fsSync.existsSync(safePath)) {
      throw new AppError(`Directory not found: "${relativePath}"`, 404, 'DIR_NOT_FOUND');
    }

    const items: ListDirItem[] = [];
    const rootWorkspace = path.resolve(workspacePath);

    async function walk(currentDir: string, currentDepth: number) {
      if (currentDepth > maxDepth) return;

      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files/directories like .git or node_modules
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }

        const fullEntryPath = path.join(currentDir, entry.name);
        const relFromWorkspace = path.relative(rootWorkspace, fullEntryPath);

        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            path: relFromWorkspace,
            isDirectory: true,
          });

          if (recursive) {
            await walk(fullEntryPath, currentDepth + 1);
          }
        } else {
          let sizeBytes: number | undefined;
          try {
            const stat = await fs.stat(fullEntryPath);
            sizeBytes = stat.size;
          } catch {
            // Ignore stat errors
          }

          items.push({
            name: entry.name,
            path: relFromWorkspace,
            isDirectory: false,
            sizeBytes,
          });
        }
      }
    }

    await walk(safePath, 1);
    return items;
  }

  /**
   * Greps/searches for a pattern recursively across files in the workspace.
   */
  static async grepSearch(
    workspacePath: string,
    query: string,
    relativePath: string = '.',
    caseInsensitive: boolean = true,
    isRegex: boolean = false,
  ): Promise<{ totalMatches: number; matches: GrepMatch[] }> {
    const safePath = this.resolveSafePath(workspacePath, relativePath);

    if (!fsSync.existsSync(safePath)) {
      throw new AppError(`Search directory not found: "${relativePath}"`, 404, 'DIR_NOT_FOUND');
    }

    const regexFlags = caseInsensitive ? 'i' : '';
    let matcher: RegExp;

    try {
      if (isRegex) {
        matcher = new RegExp(query, regexFlags);
      } else {
        // Escape special regex characters for literal string matching
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matcher = new RegExp(escaped, regexFlags);
      }
    } catch (err) {
      throw new AppError(`Invalid regular expression pattern: ${query}`, 400, 'INVALID_REGEX');
    }

    const rootWorkspace = path.resolve(workspacePath);
    const matches: GrepMatch[] = [];
    const maxMatches = 100; // Cap matches to prevent giant payloads

    async function searchDir(currentDir: string) {
      if (matches.length >= maxMatches) return;

      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (matches.length >= maxMatches) break;
        if (entry.name === '.git' || entry.name === 'node_modules') continue;

        const fullEntryPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullEntryPath);
        } else {
          try {
            // Only search text files smaller than 2MB
            const stat = await fs.stat(fullEntryPath);
            if (stat.size > 2 * 1024 * 1024) continue;

            const content = await fs.readFile(fullEntryPath, 'utf-8');
            const lines = content.split('\n');
            const relPath = path.relative(rootWorkspace, fullEntryPath);

            for (let i = 0; i < lines.length; i++) {
              if (matcher.test(lines[i])) {
                matches.push({
                  file: relPath,
                  lineNumber: i + 1,
                  lineContent: lines[i].trim(),
                });
                if (matches.length >= maxMatches) break;
              }
            }
          } catch {
            // Skip unreadable / binary files
          }
        }
      }
    }

    await searchDir(safePath);

    return {
      totalMatches: matches.length,
      matches,
    };
  }
}
