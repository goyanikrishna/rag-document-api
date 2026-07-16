import { Router } from 'express';
import { validate } from 'express-validation';
// modules
import ragController from './controllers/rag.controller';
import ragParams from './validators/rag.validator';

const router = Router();

// POST /api/documents/:id/query - Query a specific document using RAG
router.post('/:id/query', validate(ragParams.queryDocument), ragController.queryDocument);

export default router;
