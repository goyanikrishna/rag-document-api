import { v4 as uuidv4 } from 'uuid';
import httpStatus from 'http-status';
import { Document } from '@prisma/client';
// config
import { logger } from '@/config/logger';
// database
import { prisma } from '@/database/client';
// common
import APIError from '@/common/errors/api-error';
// interfaces
import {
  ICreateDocumentInput,
  ICreateChunkInput,
  IDocumentQueryParams,
  IPaginatedResult,
} from '@/modules/document/interfaces/document.interface';

/**
 * Creates a new Document entry in the database.
 */
async function create(data: ICreateDocumentInput): Promise<Document> {
  try {
    return await prisma.document.create({
      data: {
        userId: data.userId || null,
        originalName: data.originalName,
        filename: data.filename,
        mimeType: data.mimeType,
        size: data.size,
      },
    });
  } catch (error: any) {
    logger.error(`Database Error creating document: ${error.message}`);
    throw new APIError(
      `Failed to save document metadata: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

/**
 * Inserts multiple document chunks with their vector embeddings in a single database transaction.
 * Utilizes custom raw SQL execution to map the float arrays to the pgvector type.
 */
async function createChunksWithEmbeddings(chunks: ICreateChunkInput[]): Promise<void> {
  try {
    // Execute each insert inside a single database transaction
    await prisma.$transaction(
      chunks.map((chunk) => {
        const chunkId = uuidv4();
        return prisma.$executeRaw`
          INSERT INTO "document_chunks" (id, document_id, chunk_index, page_number, content, embedding)
          VALUES (
            ${chunkId}::uuid, 
            ${chunk.documentId}::uuid, 
            ${chunk.chunkIndex}, 
            ${chunk.pageNumber}, 
            ${chunk.content}, 
            CAST(${JSON.stringify(chunk.embedding)} AS vector)
          )
        `;
      }),
    );
  } catch (error: any) {
    logger.error(`Database Error inserting chunks: ${error.message}`);
    throw new APIError(
      `Failed to save document chunks and vectors: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

/**
 * Retrieves documents belonging to a user with pagination, search, and sorting.
 */
async function findAll(
  userId?: string,
  params: IDocumentQueryParams = {},
): Promise<IPaginatedResult<Document>> {
  try {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const search = params.search?.trim();

    // Map snake_case query params to Prisma model property names
    const sortFieldMap: Record<string, string> = {
      uploaded_at: 'uploadedAt',
      original_name: 'originalName',
      size: 'size',
    };
    const sortField = sortFieldMap[params.sort || 'uploaded_at'] || 'uploadedAt';
    const sortOrder = params.order || 'desc';

    const whereCondition: any = {
      ...(userId && { userId }),
      ...(search && {
        originalName: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.document.findMany({
        where: whereCondition,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.document.count({
        where: whereCondition,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  } catch (error: any) {
    logger.error(`Database Error fetching documents: ${error.message}`);
    throw new APIError(
      `Failed to retrieve documents: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

/**
 * Retrieves a document by its ID.
 */
async function findById(id: string): Promise<Document | null> {
  try {
    return await prisma.document.findUnique({
      where: { id },
    });
  } catch (error: any) {
    logger.error(`Database Error finding document ${id}: ${error.message}`);
    throw new APIError(
      `Failed to find document: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

/**
 * Deletes a document by ID. Chunks are cascade deleted automatically.
 */
async function deleteDocument(id: string): Promise<void> {
  try {
    await prisma.document.delete({
      where: { id },
    });
  } catch (error: any) {
    logger.error(`Database Error deleting document ${id}: ${error.message}`);
    throw new APIError(
      `Failed to delete document: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

/**
 * Updates the processing status of a document.
 */
async function updateStatus(
  id: string,
  status: string,
  processedAt?: Date | null,
  errorMessage?: string | null,
): Promise<Document> {
  try {
    return await prisma.document.update({
      where: { id },
      data: {
        status,
        ...(processedAt !== undefined && { processedAt }),
        ...(errorMessage !== undefined && { errorMessage }),
      },
    });
  } catch (error: any) {
    logger.error(`Database Error updating document status ${id}: ${error.message}`);
    throw new APIError(
      `Failed to update document status: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

export default {
  create,
  createChunksWithEmbeddings,
  findAll,
  findById,
  deleteDocument,
  updateStatus,
};
