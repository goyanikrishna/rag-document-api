/**
 * Centralized error code constants.
 * Used in error responses as `error.code` so frontend clients can programmatically
 * identify and handle specific error conditions without parsing free-text messages.
 *
 * Convention: SCREAMING_SNAKE_CASE, grouped by domain.
 */
export const ErrorCodes = {
  // ─── Authentication ─────────────────────────────────────────────────────────
  /** No token provided or token format is invalid */
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  /** Token is malformed, expired, or signature is invalid */
  INVALID_TOKEN: 'INVALID_TOKEN',
  /** Credentials do not match any registered user */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** Email is already registered */
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  /** User record not found */
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // ─── Authorization ───────────────────────────────────────────────────────────
  /** Authenticated user does not own the requested resource */
  FORBIDDEN: 'FORBIDDEN',

  // ─── Validation ──────────────────────────────────────────────────────────────
  /** One or more request fields failed validation */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // ─── Document ────────────────────────────────────────────────────────────────
  /** No file was attached to the upload request */
  NO_FILE_PROVIDED: 'NO_FILE_PROVIDED',
  /** Requested document record does not exist */
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  /** File MIME type or extension is not allowed */
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  /** Document contains no extractable/indexable text */
  NO_INDEXABLE_TEXT: 'NO_INDEXABLE_TEXT',
  /** PDF parsing failed */
  PDF_PARSE_FAILED: 'PDF_PARSE_FAILED',
  /** DOCX parsing failed */
  DOCX_PARSE_FAILED: 'DOCX_PARSE_FAILED',

  // ─── RAG / Query ─────────────────────────────────────────────────────────────
  /** No relevant content found in the document(s) for the given question */
  NO_RELEVANT_CONTENT: 'NO_RELEVANT_CONTENT',

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  /** Request rate limit exceeded */
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // ─── General ─────────────────────────────────────────────────────────────────
  /** An unexpected internal server error occurred */
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  /** The requested route or resource does not exist */
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
