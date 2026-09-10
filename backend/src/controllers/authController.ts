import { Request, Response } from 'express';
import { ApiResponse } from '@coding-harness/shared';

/**
 * Stub controller for user registration (detailed implementation in Phase 2).
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  const response: ApiResponse<{ message: string; email?: string }> = {
    success: true,
    data: {
      message: 'Auth registration endpoint stub. Full implementation in Phase 2.',
      email,
    },
    message: 'Registration endpoint reachable',
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}

/**
 * Stub controller for user login (detailed implementation in Phase 2).
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  const response: ApiResponse<{ message: string; email?: string }> = {
    success: true,
    data: {
      message: 'Auth login endpoint stub. Full implementation in Phase 2.',
      email,
    },
    message: 'Login endpoint reachable',
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}

/**
 * Stub controller for fetching current authenticated user.
 */
export async function getMe(_req: Request, res: Response): Promise<void> {
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: {
      message: 'Auth profile endpoint stub. Full implementation in Phase 2.',
    },
    message: 'Profile endpoint reachable',
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}
