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
// providers
import parserFactory from '@/providers/parser/parser-factory';
import embeddingProvider from '@/providers/embedding/langchain-gemini-embeddings-provider';
// modules
import documentRepository from '@/modules/document/repositories/document.repository';
import chunkerService from '@/modules/rag/services/chunker.service';
// interfaces
import { ICreateChunkInput } from '@/modules/document/interfaces/document.interface';

/**
 * Orchestrates the document ingestion pipeline.
 * Parses, cleans, chunks, generates embeddings, and saves the document in PostgreSQL.
 */
async function uploadAndProcess(file: Express.Multer.File): Promise<Document> {
  // logger.info(`Starting ingestion pipeline for file: "${file.originalname}" (${file.size} bytes)`);

  // 1. Resolve parser matching MIME type and extract content
  const fileBuffer = file.buffer || fs.readFileSync(file.path);
  const parser = parserFactory.getParser(file.mimetype);
  const parsedDoc = await parser.parse(fileBuffer);

  // 2. Save Document metadata in PostgreSQL
  const document = await documentRepository.create({
    originalName: file.originalname,
    filename: file.filename, // Multer generated safe filename
    mimeType: file.mimetype,
    size: file.size,
  });

  try {
    // 3. Clean and split each page's content into chunks
    const chunkInputs: { pageNumber: number; content: string }[] = [];
    let globalChunkIndex = 0;

    for (const page of parsedDoc.pages) {
      const pageChunks = chunkerService.splitPageText(
        page.content,
        page.pageNumber,
        globalChunkIndex,
      );

      for (const chunk of pageChunks) {
        chunkInputs.push({
          pageNumber: chunk.pageNumber,
          content: chunk.content,
        });
        globalChunkIndex++;
      }
    }

    if (chunkInputs.length === 0) {
      throw new APIError(ErrMessages.noIndexableText, httpStatus.BAD_REQUEST as number, true);
    }

    // logger.info(`Document split into ${chunkInputs.length} chunks. Generating embeddings...`);

    // 4. Generate embeddings in batches for efficiency
    const textsToEmbed = chunkInputs.map((c) => c.content);
    const embeddings = await embeddingProvider.generateEmbeddings(textsToEmbed);

    // 5. Structure chunk data with vectors
    const chunksToInsert: ICreateChunkInput[] = chunkInputs.map((chunk, index) => ({
      documentId: document.id,
      chunkIndex: index,
      pageNumber: chunk.pageNumber,
      content: chunk.content,
      embedding: embeddings[index],
    }));

    // 6. Save chunks with embeddings inside database
    await documentRepository.createChunksWithEmbeddings(chunksToInsert);

    logger.info(`Ingestion pipeline completed successfully for document ID: ${document.id}`);
    return document;
  } catch (error) {
    // Cleanup: Delete the newly created metadata record if processing fails
    logger.warn(`Ingestion failed. Rolling back database metadata for: ${document.id}`);
    await documentRepository.deleteDocument(document.id).catch(() => {});
    throw error;
  }
}

/**
 * Fetches metadata for all documents.
 */
async function getAllDocuments(): Promise<Document[]> {
  return await documentRepository.findAll();
}

/**
 * Fetches metadata for a single document.
 */
async function getDocumentById(id: string): Promise<Document> {
  const document = await documentRepository.findById(id);
  if (!document) {
    throw new APIError(ErrMessages.documentNotFound, httpStatus.NOT_FOUND as number, true);
  }
  return document;
}

/**
 * Deletes a document record and deletes its physically stored file.
 */
async function deleteDocument(id: string): Promise<void> {
  const document = await getDocumentById(id);

  // 1. Delete database records (will cascade delete chunks and vectors)
  await documentRepository.deleteDocument(id);

  // 2. Delete local file
  const filePath = path.join(UPLOAD_DIR, document.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(`Failed to delete local file at "${filePath}": ${err.message}`);
    } else {
      logger.debug(`Successfully deleted local file: "${filePath}"`);
    }
  });

  logger.info(`Document ID ${id} deleted successfully`);
}

export default {
  uploadAndProcess,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
};
