import httpStatus from 'http-status';
import pdf from 'pdf-parse';
// config
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
// interfaces
import { IParsedDocument, IParsedPage } from './parser.interface';

/**
 * Parses a PDF file buffer and extracts text content per page.
 */
async function parse(fileBuffer: Buffer): Promise<IParsedDocument> {
  try {
    const pages: IParsedPage[] = [];

    const options = {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        let lastY = 0;
        let text = '';

        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === 0) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        const pageNumber = pageData.pageIndex + 1;
        pages.push({
          content: text,
          pageNumber,
        });

        return text;
      },
    };

    const result = await pdf(fileBuffer, options);

    // Ensure pages are ordered sequentially
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      text: result.text,
      pages,
    };
  } catch (error: any) {
    logger.error(`PDF Parser Error: ${error.message}`);
    throw new APIError(
      `${ErrMessages.pdfParseFailed} ${error.message}`,
      httpStatus.BAD_REQUEST as number,
      true,
    );
  }
}

export default { parse };
