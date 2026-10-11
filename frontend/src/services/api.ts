import { ApiResponse, Task, TaskWithSessions, HealthCheckResponse } from '@coding-harness/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SubmitTaskPayload {
  repoUrl?: string;
  branch?: string;
  prompt: string;
  file?: File;
}

export class ApiService {
  /**
   * Fetches backend system health metrics and database/redis/docker status.
   */
  static async getHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/health`);
    const json: ApiResponse<HealthCheckResponse> = await res.json();
    return json.data;
  }

  /**
   * Submits a new coding task with either a remote git URL or an uploaded .zip repository.
   */
  static async submitTask(payload: SubmitTaskPayload): Promise<Task> {
    let res: Response;

    if (payload.file) {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('prompt', payload.prompt);
      if (payload.branch) formData.append('branch', payload.branch);

      res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: payload.repoUrl,
          branch: payload.branch,
          prompt: payload.prompt,
        }),
      });
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error?.message || `Failed to submit task (Status: ${res.status})`);
    }

    const json: ApiResponse<Task> = await res.json();
    return json.data;
  }

  /**
   * Fetches the detailed task view along with its execution sessions and logs.
   */
  static async getTask(taskId: string): Promise<TaskWithSessions> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
    if (!res.ok) {
      throw new Error(`Task ${taskId} not found`);
    }
    const json: ApiResponse<TaskWithSessions> = await res.json();
    return json.data;
  }

  /**
   * Lists tasks with pagination and status filters.
   */
  static async listTasks(
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ tasks: Task[]; total: number }> {
    const res = await fetch(`${API_BASE_URL}/api/tasks?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
      throw new Error('Failed to list tasks');
    }
    const json: ApiResponse<{ tasks: Task[]; total: number }> = await res.json();
    return json.data;
  }

  /**
   * Fetches the latest Git diff for a task.
   */
  static async getTaskDiff(taskId: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/diff`);
    if (!res.ok) {
      return '';
    }
    const json: ApiResponse<{ diff: string }> = await res.json();
    return json.data.diff || '';
  }
}
