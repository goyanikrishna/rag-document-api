import { Router } from 'express';
import { validate } from 'express-validation';
// common
import { uploadMiddleware } from '@/common/middlewares/file-upload';
// modules
import documentController from '@/modules/document/controllers/document.controller';
import documentParams from '@/modules/document/validators/document.validator';

const router = Router();

// POST /api/documents/upload - Upload a file (PDF/DOCX)
router.post('/upload', uploadMiddleware.single('file'), documentController.uploadDocument);

// GET /api/documents - List all document metadata
router.get('/', documentController.getDocuments);

// GET /api/documents/:id - Get a single document metadata
router.get('/:id', validate(documentParams.documentIdParam), documentController.getDocument);

// DELETE /api/documents/:id - Delete a document and its segments
router.delete('/:id', validate(documentParams.documentIdParam), documentController.deleteDocument);

export default router;
