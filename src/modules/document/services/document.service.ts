import fs from 'fs';
import path from 'path';
import httpStatus from 'http-status';
import { Document } from '@prisma/client';
// config
import { UPLOAD_DIR } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
import { DocumentStatus } from '@/common/enums/document-status.enum';
// providers
import parserFactory from '@/providers/parser/parser-factory';
import embeddingProvider from '@/providers/embedding/langchain-gemini-embeddings-provider';
// modules
import documentRepository from '@/modules/document/repositories/document.repository';
import chunkerService from '@/modules/rag/services/chunker.service';
// interfaces
import {
  ICreateChunkInput,
  IDocumentQueryParams,
  IPaginatedResult,
  IPreparedChunkInput,
} from '@/modules/document/interfaces/document.interface';

/**
 * Orchestrates the document ingestion pipeline.
 * Parses, cleans, chunks, generates embeddings, and saves the document in PostgreSQL.
 * Tracks full processing lifecycle: PENDING -> PROCESSING -> READY / FAILED.
 */
async function uploadAndProcess(file: Express.Multer.File, userId: string): Promise<Document> {
  // 1. Resolve parser matching MIME type and parse content
  const fileBuffer = file.buffer || fs.readFileSync(file.path);
  const parser = parserFactory.getParser(file.mimetype, file.originalname);

  // 2. Save Document metadata in PostgreSQL (status default: PENDING)
  let document = await documentRepository.create({
    userId,
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
  });

  try {
    // 3. Mark status as PROCESSING
    document = await documentRepository.updateStatus(document.id, DocumentStatus.PROCESSING);

    const parsedDoc = await parser.parse(fileBuffer);

    // 4. Clean and split each page's content into chunks
    const chunkInputs: IPreparedChunkInput[] = [];
    let globalChunkIndex = 0;

    for (const page of parsedDoc.pages) {
      const pageChunks = chunkerService.splitPageText(
        page.content,
        page.page_number,
        globalChunkIndex,
      );

      for (const chunk of pageChunks) {
        chunkInputs.push({
          pageNumber: chunk.page_number,
          content: chunk.content,
        });
        globalChunkIndex++;
      }
    }

    if (chunkInputs.length === 0) {
      const errorMsg = ErrMessages.noIndexableText;
      await documentRepository.updateStatus(document.id, DocumentStatus.FAILED, null, errorMsg);
      throw new APIError(
        errorMsg,
        httpStatus.BAD_REQUEST as number,
        true,
        ErrorCodes.NO_INDEXABLE_TEXT,
      );
    }

    // 5. Generate embeddings in batches for efficiency
    const textsToEmbed = chunkInputs.map((c) => c.content);
    const embeddings = await embeddingProvider.generateEmbeddings(textsToEmbed);

    // 6. Structure chunk data with vectors
    const chunksToInsert: ICreateChunkInput[] = chunkInputs.map((chunk, index) => ({
      documentId: document.id,
      chunkIndex: index,
      pageNumber: chunk.pageNumber,
      content: chunk.content,
      embedding: embeddings[index],
    }));

    // 7. Save chunks with embeddings inside database
    await documentRepository.createChunksWithEmbeddings(chunksToInsert);

    // 8. Mark document status as READY with processedAt timestamp
    document = await documentRepository.updateStatus(
      document.id,
      DocumentStatus.READY,
      new Date(),
      null,
    );

    logger.info(`Ingestion pipeline completed successfully for document ID: ${document.id}`);
    return document;
  } catch (error: any) {
    logger.error(`Ingestion failed for document ID: ${document.id}. Error: ${error.message}`);
    // Mark status as FAILED and record error message
    await documentRepository
      .updateStatus(document.id, DocumentStatus.FAILED, null, error.message || 'Processing failed')
      .catch(() => {});
    throw error;
  }
}

/**
 * Fetches metadata for all documents belonging to the authenticated user with pagination, search, and sorting.
 */
async function getAllDocuments(
  userId: string,
  params: IDocumentQueryParams = {},
): Promise<IPaginatedResult<Document>> {
  return await documentRepository.findAll(userId, params);
}

/**
 * Fetches metadata for a single document.
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 */
async function getDocumentById(id: string, userId: string): Promise<Document> {
  const document = await documentRepository.findById(id);

  if (!document) {
    throw new APIError(
      ErrMessages.documentNotFound,
      httpStatus.NOT_FOUND as number,
      true,
      ErrorCodes.DOCUMENT_NOT_FOUND,
    );
  }

  // Ownership check: document must belong to the authenticated user
  if (document.userId !== userId) {
    throw new APIError(
      ErrMessages.documentAccessForbidden,
      httpStatus.FORBIDDEN as number,
      true,
      ErrorCodes.FORBIDDEN,
    );
  }

  return document;
}

/**
 * Deletes a document record and its physically stored file.
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 */
async function deleteDocument(id: string, userId: string): Promise<void> {
  // Ownership is verified inside getDocumentById
  const document = await getDocumentById(id, userId);

  // 1. Delete database records (will cascade delete chunks and vectors)
  await documentRepository.deleteDocument(id);

  // 2. Delete local file (non-blocking; log errors but do not fail the request)
  const filePath = path.join(UPLOAD_DIR, document.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(`Failed to delete local file at "${filePath}": ${err.message}`);
    } else {
      logger.debug(`Successfully deleted local file: "${filePath}"`);
    }
  });

  logger.info(`Document ID ${id} deleted successfully by user ${userId}`);
}

/**
 * Fetches the physical file details for downloading or streaming inline.
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 */
async function getDocumentFile(
  id: string,
  userId: string,
): Promise<{ filePath: string; mimeType: string; originalName: string }> {
  const document = await getDocumentById(id, userId);
  const filePath = path.join(UPLOAD_DIR, document.filename);

  if (!fs.existsSync(filePath)) {
    throw new APIError(
      ErrMessages.documentNotFound,
      httpStatus.NOT_FOUND as number,
      true,
      ErrorCodes.DOCUMENT_NOT_FOUND,
    );
  }

  return {
    filePath,
    mimeType: document.mimeType,
    originalName: document.originalName,
  };
}

export default {
  uploadAndProcess,
  getAllDocuments,
  getDocumentById,
  getDocumentFile,
  deleteDocument,
};
