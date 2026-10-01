import httpStatus from 'http-status';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { AllowedMimeTypes } from '@/common/enums/file-type.enum';
// interfaces
import { IDocumentParser } from './parser.interface';
// providers
import pdfParser from './pdf-parser';
import docxParser from './docx-parser';
import txtParser from './txt-parser';

/**
 * Resolves the appropriate parser module for a given MIME type.
 */
function getParser(mimeType: string): IDocumentParser {
  switch (mimeType) {
    case AllowedMimeTypes.PDF:
      return pdfParser;
    case AllowedMimeTypes.DOCX:
    case AllowedMimeTypes.DOC:
      return docxParser;
    case AllowedMimeTypes.TXT:
      return txtParser;
    default:
      throw new APIError(
        `${ErrMessages.unsupportedFileType} (MIME: ${mimeType})`,
        httpStatus.BAD_REQUEST as number,
        true,
      );
  }
}

export default { getParser };
