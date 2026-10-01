import { Request, Response, NextFunction } from 'express';
import { ValidationError as ExpressValidationError } from 'express-validation';
import httpStatus from 'http-status';
import APIError from '@/common/errors/api-error';
import { ErrorCodes } from '@/common/constants/error-codes';
import { logger } from '@/config/logger';

/**
 * Global error handler — must be registered as the last middleware in app.ts.
 *
 * Produces a consistent, structured error response in all cases:
 * {
 *   "success": false,
 *   "message": "Human-readable description (public errors only; 500s return generic text)",
 *   "error": { "code": "MACHINE_READABLE_CODE" }
 * }
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // 1. Convert Express Validation Error → APIError(400, VALIDATION_ERROR)
  if (err instanceof ExpressValidationError) {
    const mergedErrors = ([] as any[]).concat(
      ...Object.values(err.details || {}).map((paramErrors: any) =>
        paramErrors.map((e: any) => e.message),
      ),
    );
    const unifiedErrorMessage = mergedErrors.join(', ');
    error = new APIError(
      unifiedErrorMessage,
      err.statusCode || (httpStatus.BAD_REQUEST as number),
      true,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  // 2. Convert standard (non-API) Errors → APIError(500, INTERNAL_SERVER_ERROR)
  else if (err instanceof Error && err.name !== 'APIError') {
    const status = (err as any).status || (httpStatus.INTERNAL_SERVER_ERROR as number);
    error = new APIError(err.message, status, false, ErrorCodes.INTERNAL_SERVER_ERROR);
  }

  const statusCode: number = error instanceof APIError ? error.status : 500;
  const errorCode: string =
    error instanceof APIError ? error.errorCode : ErrorCodes.INTERNAL_SERVER_ERROR;

  // Log server/internal errors with full stack; client errors with a warning
  if (statusCode >= 500) {
    logger.error(
      `[500 Error] ${req.method} ${req.path} - Code: ${errorCode} - Message: ${error.message} | Stack: ${error.stack}`,
    );
  } else {
    logger.warn(
      `[${statusCode} Warning] ${req.method} ${req.path} - Code: ${errorCode} - Message: ${error.message}`,
    );
  }

  // Determine the public-facing message:
  // - Public errors (isPublic=true) and non-500s → use the original message
  // - 500s and internal errors → return generic HTTP status text (no internal detail leakage)
  const isPublic = error instanceof APIError ? error.isPublic : false;
  const message =
    isPublic && statusCode !== 500
      ? error.message
      : ((httpStatus as any)[statusCode] ?? 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    error: {
      code: errorCode,
    },
  });
};
