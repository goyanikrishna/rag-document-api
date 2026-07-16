import { Request, Response, NextFunction } from 'express';
import { ValidationError as ExpressValidationError } from 'express-validation';
import httpStatus from 'http-status';
import APIError from '@/common/errors/api-error';
import { logger } from '@/config/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // 1. Convert Express Validation Error
  if (err instanceof ExpressValidationError) {
    const mergedErrors = ([] as any[]).concat(
      ...Object.values(err.details || {}).map((paramErrors: any) =>
        paramErrors.map((e: any) => e.message),
      ),
    );
    const unifiedErrorMessage = mergedErrors.join(', ');
    error = new APIError(unifiedErrorMessage, err.statusCode || httpStatus.BAD_REQUEST, true);
  }
  // 2. Convert standard Errors to APIError
  else if (err instanceof Error && err.name !== 'APIError') {
    const status = (err as any).status || httpStatus.INTERNAL_SERVER_ERROR;
    error = new APIError(err.message, status, false);
  }

  const statusCode = error instanceof APIError ? error.status : 500;

  // Log server/internal errors
  if (statusCode >= 500) {
    logger.error(
      `[500 Error] ${req.method} ${req.path} - Message: ${error.message} | Stack: ${error.stack}`,
    );
  } else {
    logger.warn(`[${statusCode} Warning] ${req.method} ${req.path} - Message: ${error.message}`);
  }

  // Determine error message based on publicity and status code (hide 500/internal errors in prod)
  const isPublic = error instanceof APIError ? error.isPublic : false;
  const message =
    isPublic && statusCode !== 500
      ? error.message
      : (httpStatus as any)[statusCode] || 'Internal Server Error';

  res.status(statusCode).json({
    status: statusCode,
    message,
  });
};
