import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import { env } from '@/config/env';
import APIError from '@/common/errors/api-error';
import { ErrorCodes } from '@/common/constants/error-codes';

export interface IAuthenticatedUser {
  id: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthenticatedUser;
    }
  }
}

/**
 * Authentication Middleware — JWT Only
 * Enforces a valid, non-expired JWT Bearer token from the Authorization header.
 * Rejects all requests without a proper token. Does NOT accept x-user-id header.
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email?: string };

      req.user = {
        id: decoded.sub,
        email: decoded.email,
      };
      return next();
    }

    throw new APIError(
      'Authentication required. Please provide a valid Bearer token.',
      httpStatus.UNAUTHORIZED as number,
      true,
      ErrorCodes.AUTHENTICATION_REQUIRED,
    );
  } catch (error: any) {
    if (error instanceof APIError) {
      return next(error);
    }
    return next(
      new APIError(
        'Invalid or expired authentication token.',
        httpStatus.UNAUTHORIZED as number,
        true,
        ErrorCodes.INVALID_TOKEN,
      ),
    );
  }
}
