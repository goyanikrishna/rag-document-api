import { Router } from 'express';
import { validate } from 'express-validation';
import rateLimit from 'express-rate-limit';
// common
import { uploadMiddleware } from '@/common/middlewares/file-upload';
import { authenticateUser } from '@/common/middlewares/auth-middleware';
// modules
import documentController from '@/modules/document/controllers/document.controller';
import documentParams from '@/modules/document/validators/document.validator';

const router = Router();

// All document routes require a valid JWT Bearer token
router.use(authenticateUser);

// Rate limiter for file uploads: max 5 uploads per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { status: 429, message: 'Too many upload requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/documents/upload - Upload a file (PDF/DOCX/TXT)
router.post(
  '/upload',
  uploadLimiter,
  uploadMiddleware.single('file'),
  documentController.uploadDocument,
);

// GET /api/documents - List all documents belonging to the authenticated user (supports page, limit, search, sort, order)
router.get('/', validate(documentParams.getDocumentsQuery), documentController.getDocuments);

// GET /api/documents/:id - Get a single document (must belong to authenticated user)
router.get('/:id', validate(documentParams.documentIdParam), documentController.getDocument);

// DELETE /api/documents/:id - Delete a document (must belong to authenticated user)
router.delete('/:id', validate(documentParams.documentIdParam), documentController.deleteDocument);

export default router;
