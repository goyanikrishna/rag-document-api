import httpStatus from 'http-status';
// config
import { logger } from '@/config/logger';
// database
import { prisma } from '@/database/client';
// common
import APIError from '@/common/errors/api-error';
// interfaces
import { ISimilarChunkResult } from '@/modules/rag/interfaces/rag.interface';

/**
 * Performs a vector similarity search (using cosine distance) against document chunks.
 * Returns the top K matching chunks ordered by descending similarity score.
 */
async function findSimilarChunks(
  documentId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<ISimilarChunkResult[]> {
  try {
    // 1 - (embedding <=> query_vector) yields cosine similarity (1.0 = perfect match, 0.0 = orthogonal)
    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        content,
        page_number AS "pageNumber",
        1.0 - (embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector)) AS "similarity"
      FROM "document_chunks"
      WHERE "document_id" = CAST(${documentId} AS uuid)
      ORDER BY embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector) ASC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      content: row.content,
      pageNumber: row.pageNumber,
      similarity: Number(row.similarity),
    }));
  } catch (error: any) {
    logger.error(`Database error during similarity search: ${error.message}`);
    throw new APIError(
      `Failed to perform vector similarity search: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

export default { findSimilarChunks };
