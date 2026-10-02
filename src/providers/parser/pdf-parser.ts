import httpStatus from 'http-status';
import { parseOffice } from 'officeparser';
import pdf from 'pdf-parse';
// config
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
// interfaces
import { IParsedDocument, IParsedPage } from './parser.interface';

/**
 * Parses a PDF file buffer and extracts text content per page.
 * Uses officeparser (modern PDF engine) as primary, with pdf-parse as secondary fallback.
 */
async function parse(fileBuffer: Buffer): Promise<IParsedDocument> {
  // 1. Try officeparser (handles ReportLab, PDF 1.4+, complex XRefs, etc.)
  try {
    const doc = await parseOffice(fileBuffer);
    const pages: IParsedPage[] = [];

    if (Array.isArray(doc.content) && doc.content.length > 0) {
      doc.content.forEach((item: any, idx: number) => {
        const pageText = (item.text || '').trim();
        const pageNum = item.metadata?.pageNumber || idx + 1;
        if (pageText) {
          pages.push({
            content: pageText,
            page_number: pageNum,
          });
        }
      });
    }

    const textResult = await doc.to('text');
    const fullText = (typeof textResult === 'string' ? textResult : textResult?.value || '').trim();

    if (fullText && pages.length > 0) {
      pages.sort((a, b) => a.page_number - b.page_number);
      return {
        text: fullText,
        pages,
      };
    }
  } catch (officeErr: any) {
    logger.warn(
      `officeparser PDF parsing failed (${officeErr.message}), trying pdf-parse fallback...`,
    );
  }

  // 2. Fallback: pdf-parse
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
          page_number: pageNumber,
        });

        return text;
      },
    };

    const result = await pdf(fileBuffer, options);
    pages.sort((a, b) => a.page_number - b.page_number);

    if (!result.text || !result.text.trim()) {
      throw new APIError(
        ErrMessages.noIndexableText,
        httpStatus.UNPROCESSABLE_ENTITY as number,
        true,
        ErrorCodes.NO_INDEXABLE_TEXT,
      );
    }

    return {
      text: result.text,
      pages,
    };
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error(`PDF Parser Error: ${error.message}`);
    throw new APIError(
      `${ErrMessages.pdfParseFailed} ${error.message}`,
      httpStatus.BAD_REQUEST as number,
      true,
      ErrorCodes.PDF_PARSE_FAILED,
    );
  }
}

export default { parse };
