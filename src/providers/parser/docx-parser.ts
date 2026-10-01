import { parseOffice } from 'officeparser';
import httpStatus from 'http-status';
// config
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
// interfaces
import { IParsedDocument, IParsedPage } from './parser.interface';

/**
 * Parses Word documents (.docx, .doc, .rtf) into structured text.
 * Uses officeparser as the single unified parser for OpenXML (.docx),
 * legacy binary Word 97-2004 (.doc), and Rich Text (.rtf) formats.
 */
async function parse(fileBuffer: Buffer): Promise<IParsedDocument> {
  try {
    const officeDoc = await parseOffice(fileBuffer);
    const textResult = await officeDoc.to('text');
    const text = (typeof textResult === 'string' ? textResult : textResult?.value || '').trim();

    if (!text) {
      throw new APIError(
        ErrMessages.noIndexableText,
        httpStatus.UNPROCESSABLE_ENTITY as number,
        true,
        ErrorCodes.NO_INDEXABLE_TEXT,
      );
    }

    const pages: IParsedPage[] = [
      {
        content: text,
        page_number: 1,
      },
    ];

    return {
      text,
      pages,
    };
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error(`Word Document Parser Error: ${error.message}`);
    throw new APIError(
      'Failed to parse Word document. Please ensure the file is a valid, uncorrupted .docx or .doc document.',
      httpStatus.BAD_REQUEST as number,
      true,
      ErrorCodes.DOCX_PARSE_FAILED,
    );
  }
}

export default { parse };


