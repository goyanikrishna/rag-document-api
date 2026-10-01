import httpStatus from 'http-status';
import { ErrorCode, ErrorCodes } from '@/common/constants/error-codes';

/**
 * Custom API error class.
 * Carries an HTTP status code, a public/private flag, and a machine-readable error code
 * so that the global error handler can produce consistent, structured error responses.
 */
export default class APIError extends Error {
  public status: number;
  public isPublic: boolean;
  public errorCode: ErrorCode;

  constructor(
    message: string,
    status: number = httpStatus.INTERNAL_SERVER_ERROR as number,
    isPublic: boolean = false,
    errorCode: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.isPublic = isPublic;
    this.errorCode = errorCode;
  }
}
