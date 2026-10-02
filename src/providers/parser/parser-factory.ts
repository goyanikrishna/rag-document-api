import path from 'path';
import httpStatus from 'http-status';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { AllowedMimeTypes, AllowedFileExtensions } from '@/common/enums/file-type.enum';
import { ErrorCodes } from '@/common/constants/error-codes';
// interfaces
import { IDocumentParser } from './parser.interface';
// providers
import pdfParser from './pdf-parser';
import docxParser from './docx-parser';
import txtParser from './txt-parser';

/**
 * Resolves the appropriate parser module for a given MIME type or file extension.
 */
function getParser(mimeType: string, originalName?: string): IDocumentParser {
  const ext = originalName ? path.extname(originalName).toLowerCase() : '';

  if (mimeType === AllowedMimeTypes.PDF || ext === AllowedFileExtensions.PDF) {
    return pdfParser;
  }

  if (
    mimeType === AllowedMimeTypes.DOCX ||
    mimeType === AllowedMimeTypes.DOC ||
    ext === AllowedFileExtensions.DOCX ||
    ext === AllowedFileExtensions.DOC
  ) {
    return docxParser;
  }

  if (mimeType === AllowedMimeTypes.TXT || ext === AllowedFileExtensions.TXT) {
    return txtParser;
  }

  throw new APIError(
    `${ErrMessages.unsupportedFileType} (MIME: ${mimeType || 'unknown'}, extension: ${ext || 'none'})`,
    httpStatus.BAD_REQUEST as number,
    true,
    ErrorCodes.INVALID_FILE_TYPE,
  );
}

export default { getParser };
