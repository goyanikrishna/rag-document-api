import Joi from 'joi';

const documentParams = {
  // GET /api/documents/:id and DELETE /api/documents/:id
  documentIdParam: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },

  // GET /api/documents (Query parameters validation)
  getDocumentsQuery: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().trim().allow(''),
      sort: Joi.string().valid('uploaded_at', 'original_name', 'size').default('uploaded_at'),
      order: Joi.string().valid('asc', 'desc').default('desc'),
    }),
  },
};

export default documentParams;
