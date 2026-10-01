import mammoth from 'mammoth';
import httpStatus from 'http-status';
// config
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
// interfaces
import { IParsedDocument, IParsedPage } from './parser.interface';

/**
 * Parses a DOCX file buffer and extracts text.
 */
async function parse(fileBuffer: Buffer): Promise<IParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = result.value;

    // Word documents do not have fixed native pages; map the entire text as Page 1
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
    logger.error(`DOCX Parser Error: ${error.message}`);
    throw new APIError(
      `${ErrMessages.docxParseFailed} ${error.message}`,
      httpStatus.BAD_REQUEST as number,
      true,
    );
  }
}

export default { parse };
