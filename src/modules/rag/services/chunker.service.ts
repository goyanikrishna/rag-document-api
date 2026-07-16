import { env } from '@/config/env';

import { IChunkResult } from '@/modules/rag/interfaces/rag.interface';

/**
 * Cleans raw text by normalizing whitespaces and newlines.
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ') // Collapse multiple horizontal spaces
    .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
    .trim();
}

/**
 * Splits text content from a specific page into multiple overlapping chunks.
 * Leverages look-back boundaries to split at word limits (spaces/newlines).
 */
function splitPageText(
  text: string,
  pageNumber: number,
  startingChunkIndex: number = 0,
): IChunkResult[] {
  const chunkSize = env.CHUNK_SIZE;
  const chunkOverlap = env.CHUNK_OVERLAP;

  const cleanedText = cleanText(text);
  if (!cleanedText) return [];

  // If the text is smaller than the chunk size, return it as a single chunk
  if (cleanedText.length <= chunkSize) {
    return [
      {
        content: cleanedText,
        pageNumber,
        chunkIndex: startingChunkIndex,
      },
    ];
  }

  const chunks: IChunkResult[] = [];
  let start = 0;
  let currentChunkIndex = startingChunkIndex;

  while (start < cleanedText.length) {
    let end = start + chunkSize;

    // Adjust the end boundary to split at a space or newline to avoid cutting words
    if (end < cleanedText.length) {
      const lookBackRange = Math.floor(chunkSize * 0.2); // Look back up to 20% of chunk size
      let boundaryIndex = -1;

      for (let i = end; i > end - lookBackRange; i--) {
        const char = cleanedText[i];
        if (char === ' ' || char === '\n') {
          boundaryIndex = i;
          break;
        }
      }

      if (boundaryIndex !== -1) {
        end = boundaryIndex;
      }
    }

    const chunkContent = cleanedText.substring(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        pageNumber,
        chunkIndex: currentChunkIndex++,
      });
    }

    // Slide window: end index minus overlap
    start = end - chunkOverlap;

    // Safety exits to prevent infinite loops
    if (start >= cleanedText.length || end >= cleanedText.length) {
      break;
    }
  }

  return chunks;
}

export default {
  cleanText,
  splitPageText,
};
