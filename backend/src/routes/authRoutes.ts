import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';

export const authRoutes = Router();

authRoutes.post('/register', authRateLimiter, register);
authRoutes.post('/login', authRateLimiter, login);
authRoutes.get('/me', authenticate, getMe);
