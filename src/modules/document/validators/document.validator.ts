import Joi from 'joi';

const documentParams = {
  // GET /api/documents/:id and DELETE /api/documents/:id
  documentIdParam: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
};

export default documentParams;
