import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// database
import { prisma } from '@/database/client';
// common
import APIError from '@/common/errors/api-error';
// interfaces
import { ISimilarChunkResult } from '@/modules/rag/interfaces/rag.interface';

/**
 * Performs vector similarity search for a single document by documentId.
 * Filters out results below the minimum similarity threshold.
 */
async function findSimilarChunks(
  documentId: string,
  queryEmbedding: number[],
  limit: number,
  minSimilarity: number = env.MIN_SIMILARITY_THRESHOLD,
): Promise<ISimilarChunkResult[]> {
  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        c.content,
        c.page_number AS "page_number",
        c.document_id AS "document_id",
        d.original_name AS "document_name",
        1.0 - (c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector)) AS "similarity"
      FROM "document_chunks" c
      JOIN "documents" d ON c.document_id = d.id
      WHERE c.document_id = CAST(${documentId} AS uuid)
        AND (1.0 - (c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector))) >= ${minSimilarity}
      ORDER BY c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector) ASC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      document_id: row.document_id,
      document_name: row.document_name,
      content: row.content,
      page_number: row.page_number,
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

/**
 * Performs vector similarity search across ALL documents belonging to a specific user.
 * Filters out results below the minimum similarity threshold.
 */
async function findSimilarChunksByUser(
  userId: string,
  queryEmbedding: number[],
  limit: number,
  minSimilarity: number = env.MIN_SIMILARITY_THRESHOLD,
): Promise<ISimilarChunkResult[]> {
  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        c.content,
        c.page_number AS "page_number",
        c.document_id AS "document_id",
        d.original_name AS "document_name",
        1.0 - (c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector)) AS "similarity"
      FROM "document_chunks" c
      JOIN "documents" d ON c.document_id = d.id
      WHERE d.user_id = CAST(${userId} AS uuid)
        AND (1.0 - (c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector))) >= ${minSimilarity}
      ORDER BY c.embedding <=> CAST(${JSON.stringify(queryEmbedding)} AS vector) ASC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      document_id: row.document_id,
      document_name: row.document_name,
      content: row.content,
      page_number: row.page_number,
      similarity: Number(row.similarity),
    }));
  } catch (error: any) {
    logger.error(`Database error during multi-document similarity search: ${error.message}`);
    throw new APIError(
      `Failed to perform multi-document vector similarity search: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

export default {
  findSimilarChunks,
  findSimilarChunksByUser,
};
