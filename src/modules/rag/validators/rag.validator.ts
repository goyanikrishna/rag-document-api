import Joi from 'joi';

const ragParams = {
  // POST /api/documents/:id/query
  queryDocument: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
    body: Joi.object({
      question: Joi.string().trim().min(1).max(500).required(),
      stream: Joi.boolean().optional(),
    }),
  },
};

export default ragParams;
