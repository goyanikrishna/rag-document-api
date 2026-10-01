import { Router } from 'express';
import { validate } from 'express-validation';
import rateLimit from 'express-rate-limit';
import { authenticateUser } from '@/common/middlewares/auth-middleware';
// modules
import ragController from './controllers/rag.controller';
import ragParams from './validators/rag.validator';

const router = Router();

// All RAG query routes require a valid JWT Bearer token
router.use(authenticateUser);

// Rate limiter for query endpoints: max 30 queries per minute per IP
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { status: 429, message: 'Too many query requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/documents/query - Query across ALL documents belonging to the authenticated user
router.post(
  '/query',
  queryLimiter,
  validate(ragParams.queryUserDocuments),
  ragController.queryUserDocuments,
);

// POST /api/documents/:id/query - Query a specific document (must belong to authenticated user)
router.post(
  '/:id/query',
  queryLimiter,
  validate(ragParams.queryDocument),
  ragController.queryDocument,
);

export default router;
