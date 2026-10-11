import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

export const authRoutes = Router();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.get('/me', authenticate, getMe);
