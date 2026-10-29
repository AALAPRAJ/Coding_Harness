import path from 'path';
import fs from 'fs/promises';
import { simpleGit, SimpleGit } from 'simple-git';
import { config } from '../config';
import { logger } from '../logger';

export interface CloneOptions {
  branch?: string;
  token?: string;
  depth?: number;
}

export class GitService {
  /**
   * Generates the absolute path to a task's isolated workspace.
   */
  static getWorkspacePath(taskId: string): string {
    return path.join(config.workspacesDir, taskId);
  }

  /**
   * Prepares and initializes a clean, dedicated workspace directory for a task.
   */
  static async prepareWorkspace(taskId: string): Promise<string> {
    const workspacePath = this.getWorkspacePath(taskId);
    await fs.mkdir(workspacePath, { recursive: true });
    logger.debug(`Prepared workspace directory at ${workspacePath}`);
    return workspacePath;
  }

  /**
   * Safely deletes an isolated task workspace directory.
   */
  static async cleanupWorkspace(taskId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(taskId);
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
      logger.debug(`Cleaned up workspace directory at ${workspacePath}`);
    } catch (err) {
      logger.warn(`Failed to cleanup workspace ${workspacePath}:`, err);
    }
  }

  /**
   * Clones a remote Git repository into the target workspace directory.
   * Supports branch selection and OAuth/access token injection for private repositories.
   */
  static async cloneRepository(
    repoUrl: string,
    targetDir: string,
    options: CloneOptions = {},
  ): Promise<SimpleGit> {
    logger.info(`Cloning repository ${repoUrl} to ${targetDir}`);

    let cloneUrl = repoUrl;

    // Inject token for private GitHub/GitLab repositories if provided
    if (options.token && repoUrl.startsWith('https://')) {
      const urlWithoutScheme = repoUrl.replace('https://', '');
      cloneUrl = `https://${encodeURIComponent(options.token)}@${urlWithoutScheme}`;
    }

    const cloneParams: string[] = [];
    if (options.branch) {
      cloneParams.push('--branch', options.branch);
    }
    if (options.depth) {
      cloneParams.push('--depth', options.depth.toString());
    }

    const git = simpleGit();
    await git.clone(cloneUrl, targetDir, cloneParams);

    const repoGit = simpleGit(targetDir);
    // Configure default committer for automated operations
    await repoGit.addConfig('user.name', 'Coding Harness Agent');
    await repoGit.addConfig('user.email', 'agent@coding-harness.local');

    logger.info(`Successfully cloned ${repoUrl} into ${targetDir}`);
    return repoGit;
  }

  /**
   * Initializes a Git repository in an existing directory (e.g., after zip extraction),
   * and creates an initial baseline commit so changes can be diffed.
   */
  static async initRepository(repoDir: string): Promise<SimpleGit> {
    const git = simpleGit(repoDir);
    const isRepo = await this.isGitRepo(repoDir);

    if (!isRepo) {
      await git.init();
      await git.addConfig('user.name', 'Coding Harness Agent');
      await git.addConfig('user.email', 'agent@coding-harness.local');
      await git.add('.');
      await git.commit('Initial baseline commit before agent execution');
      logger.info(`Initialized git repository with baseline commit at ${repoDir}`);
    }

    return git;
  }

  /**
   * Checks whether a directory is currently a valid Git repository.
   */
  static async isGitRepo(repoDir: string): Promise<boolean> {
    try {
      const git = simpleGit(repoDir);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /**
   * Produces a unified Git diff showing all modifications made compared to HEAD.
   */
  static async getHeadCommit(repoDir: string): Promise<string> {
    return simpleGit(repoDir).revparse(['HEAD']);
  }

  static async getGitDiff(repoDir: string, baseCommit?: string): Promise<string> {
    const isRepo = await this.isGitRepo(repoDir);
    if (!isRepo) {
      return '';
    }

    const git = simpleGit(repoDir);

    try {
      // Include new files in the patch without staging their contents.
      await git.raw(['add', '--intent-to-add', '--all']);
      const diff = await git.diff([baseCommit || 'HEAD', '--binary']);
      if (diff && diff.trim().length > 0) {
        return diff;
      }

      // If HEAD has no diff, check working tree vs index
      return await git.diff();
    } catch (error) {
      if (baseCommit) throw error;
      // Fallback to basic diff
      return await git.diff();
    }
  }

  /**
   * Switches to an existing branch or creates a new one.
   */
  static async checkoutBranch(
    repoDir: string,
    branchName: string,
    createNew: boolean = false,
  ): Promise<void> {
    const git = simpleGit(repoDir);
    if (createNew) {
      await git.checkoutLocalBranch(branchName);
    } else {
      await git.checkout(branchName);
    }
    logger.debug(`Checked out branch "${branchName}" in ${repoDir}`);
  }

  /**
   * Stages all changes and creates a commit.
   */
  static async commitChanges(repoDir: string, message: string): Promise<string> {
    const git = simpleGit(repoDir);
    await git.add('.');
    const commitResult = await git.commit(message);
    logger.info(`Committed changes: ${commitResult.commit}`);
    return commitResult.commit;
  }
}
