import httpStatus from 'http-status';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
// interfaces
import { IDocumentParser } from './parser.interface';
// providers
import pdfParser from './pdf-parser';
import docxParser from './docx-parser';

/**
 * Resolves the appropriate parser module for a given MIME type.
 */
function getParser(mimeType: string): IDocumentParser {
  switch (mimeType) {
    case 'application/pdf':
      return pdfParser;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return docxParser;
    default:
      throw new APIError(
        `${ErrMessages.unsupportedFileType} (MIME: ${mimeType})`,
        httpStatus.BAD_REQUEST as number,
        true,
      );
  }
}

export default { getParser };
