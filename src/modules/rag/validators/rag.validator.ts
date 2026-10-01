import Joi from 'joi';

const ragParams = {
  // POST /api/documents/:id/query
  queryDocument: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
    body: Joi.object({
      question: Joi.string().trim().min(1).max(1000).required(),
      stream: Joi.boolean().default(false),
    }),
  },
  // POST /api/documents/query
  queryUserDocuments: {
    body: Joi.object({
      question: Joi.string().trim().min(1).max(1000).required(),
      stream: Joi.boolean().default(false),
    }),
  },
  // GET /api/documents/history
  getQueryHistory: {
    query: Joi.object({
      document_id: Joi.string().uuid().optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
    }),
  },
};

export default ragParams;
