import { Router } from 'express';
import { validate } from 'express-validation';
import { authenticateUser } from '@/common/middlewares/auth-middleware';
import authController from './controllers/auth.controller';
import authValidator from './validators/auth.validator';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(authValidator.register), authController.register);

// POST /api/auth/login
router.post('/login', validate(authValidator.login), authController.login);

// GET /api/auth/me
router.get('/me', authenticateUser, authController.getMe);

export default router;
