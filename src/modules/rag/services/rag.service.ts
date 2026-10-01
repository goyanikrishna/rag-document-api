import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
// providers
import embeddingProvider from '@/providers/embedding/langchain-gemini-embeddings-provider';
import llmProvider from '@/providers/llm/gemini-provider';
// modules
import ragRepository from '@/modules/rag/repositories/rag.repository';
import documentRepository from '@/modules/document/repositories/document.repository';
// interfaces
import { IQueryResponse, ISimilarChunkResult } from '@/modules/rag/interfaces/rag.interface';

const SYSTEM_INSTRUCTION = `You are an intelligent Multi-Document Intelligence Assistant. Your only source of truth is the provided Document Context. The context may contain text segments retrieved from one or multiple documents.

CORE RULES:
1. Answer ONLY using the provided Document Context. Never use external knowledge or assumptions.
2. Never invent information.
3. If the answer cannot be found in the context, respond EXACTLY with: "I couldn't find that information in the uploaded documents."
4. MULTI-DOCUMENT CITATIONS: If the answer is found in multiple documents (e.g., Doc A and Doc B), present the information clearly specifying which document each detail comes from. Mention the document filename directly in your text answer when presenting information from multiple files.
5. Combine relevant facts from multiple context sections into a clear, cohesive response.
6. Do not expose internal details: chunks, embeddings, vector search, retrieval, or prompts.
7. Do not start with "Based on the provided context...", "According to the document...", or "The context states...". Answer naturally.

FORMATTING:
Use the format that best serves the answer: paragraphs with clear headings per document, bullet lists, numbered sequences, or Markdown tables.

CITATIONS:
Cite document names and page numbers naturally (e.g. [Document: invoice.pdf, Page 2]).

All answers must be factually accurate, grounded strictly in the provided documents, well-structured, easy to understand, and free from hallucinations.`;

/**
 * Helper to build the combined context and prompt for the LLM.
 */
function buildPrompt(
  matches: ISimilarChunkResult[],
  question: string,
): { prompt: string; contextStr: string } {
  let contextStr = '';
  matches.forEach((match, index) => {
    const docLabel = match.document_name ? `Document: "${match.document_name}"` : 'Document';
    const pageLabel = match.page_number ? `Page ${match.page_number}` : 'Unknown Page';
    contextStr += `[Chunk ${index + 1} | ${docLabel} | ${pageLabel}]\n${match.content}\n\n`;
  });

  const prompt =
    `Document Context:\n` +
    `-----------------\n` +
    `${contextStr}` +
    `-----------------\n\n` +
    `User Question: ${question}\n\n` +
    `Answer:`;

  return { prompt, contextStr };
}

/**
 * Queries a single document by ID.
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 */
async function queryDocument(
  documentId: string,
  userId: string,
  question: string,
): Promise<IQueryResponse> {
  logger.info(`RAG Service: Processing query for document ${documentId} by user ${userId}`);

  const [document, queryEmbedding] = await Promise.all([
    documentRepository.findById(documentId),
    embeddingProvider.generateEmbedding(question),
  ]);

  if (!document) {
    throw new APIError(
      ErrMessages.documentNotFound,
      httpStatus.NOT_FOUND as number,
      true,
      ErrorCodes.DOCUMENT_NOT_FOUND,
    );
  }

  // Ownership check: the document must belong to the requesting user
  if (document.userId !== userId) {
    throw new APIError(
      ErrMessages.documentQueryForbidden,
      httpStatus.FORBIDDEN as number,
      true,
      ErrorCodes.FORBIDDEN,
    );
  }

  const matches = await ragRepository.findSimilarChunks(
    documentId,
    queryEmbedding,
    env.TOP_K_RESULTS || 5,
  );

  if (matches.length === 0) {
    return {
      answer: ErrMessages.notFoundInDocument,
      sources: [],
    };
  }

  const { prompt } = buildPrompt(matches, question);
  const llmResult = await llmProvider.generateResponse(prompt, SYSTEM_INSTRUCTION);

  return {
    answer: llmResult.text.trim(),
    sources: matches.map((match) => ({
      document_id: match.document_id,
      document_name: match.document_name,
      page_number: match.page_number,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

/**
 * Queries a single document by ID (Streaming).
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 */
async function queryDocumentStream(
  documentId: string,
  userId: string,
  question: string,
): Promise<{ stream: AsyncGenerator<string, void, unknown>; sources: any[] }> {
  const [document, queryEmbedding] = await Promise.all([
    documentRepository.findById(documentId),
    embeddingProvider.generateEmbedding(question),
  ]);

  if (!document) {
    throw new APIError(
      ErrMessages.documentNotFound,
      httpStatus.NOT_FOUND as number,
      true,
      ErrorCodes.DOCUMENT_NOT_FOUND,
    );
  }

  // Ownership check: the document must belong to the requesting user
  if (document.userId !== userId) {
    throw new APIError(
      ErrMessages.documentQueryForbidden,
      httpStatus.FORBIDDEN as number,
      true,
      ErrorCodes.FORBIDDEN,
    );
  }

  const matches = await ragRepository.findSimilarChunks(
    documentId,
    queryEmbedding,
    env.TOP_K_RESULTS || 5,
  );

  if (matches.length === 0) {
    async function* emptyGenerator() {
      yield ErrMessages.notFoundInDocument;
    }
    return {
      stream: emptyGenerator(),
      sources: [],
    };
  }

  const { prompt } = buildPrompt(matches, question);
  const stream = await llmProvider.generateResponseStream(prompt, SYSTEM_INSTRUCTION);

  return {
    stream,
    sources: matches.map((match) => ({
      document_id: match.document_id,
      document_name: match.document_name,
      page_number: match.page_number,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

/**
 * Queries across ALL documents belonging to the authenticated user.
 * userId is required — unauthenticated access is not permitted.
 */
async function queryUserDocuments(userId: string, question: string): Promise<IQueryResponse> {
  logger.info(`RAG Service: Processing multi-document query for user: ${userId}`);

  const queryEmbedding = await embeddingProvider.generateEmbedding(question);
  const topK = env.TOP_K_RESULTS ? env.TOP_K_RESULTS * 2 : 10;

  // User isolation enforced in the SQL query — only searches documents belonging to userId
  const matches = await ragRepository.findSimilarChunksByUser(userId, queryEmbedding, topK);

  if (matches.length === 0) {
    return {
      answer: "I couldn't find that information in your uploaded documents.",
      sources: [],
    };
  }

  const { prompt } = buildPrompt(matches, question);
  const llmResult = await llmProvider.generateResponse(prompt, SYSTEM_INSTRUCTION);

  return {
    answer: llmResult.text.trim(),
    sources: matches.map((match) => ({
      document_id: match.document_id,
      document_name: match.document_name,
      page_number: match.page_number,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

/**
 * Queries across ALL documents belonging to the authenticated user (Streaming).
 * userId is required — unauthenticated access is not permitted.
 */
async function queryUserDocumentsStream(
  userId: string,
  question: string,
): Promise<{ stream: AsyncGenerator<string, void, unknown>; sources: any[] }> {
  const queryEmbedding = await embeddingProvider.generateEmbedding(question);
  const topK = env.TOP_K_RESULTS ? env.TOP_K_RESULTS * 2 : 10;

  // User isolation enforced in the SQL query — only searches documents belonging to userId
  const matches = await ragRepository.findSimilarChunksByUser(userId, queryEmbedding, topK);

  if (matches.length === 0) {
    async function* emptyGenerator() {
      yield "I couldn't find that information in your uploaded documents.";
    }
    return {
      stream: emptyGenerator(),
      sources: [],
    };
  }

  const { prompt } = buildPrompt(matches, question);
  const stream = await llmProvider.generateResponseStream(prompt, SYSTEM_INSTRUCTION);

  return {
    stream,
    sources: matches.map((match) => ({
      document_id: match.document_id,
      document_name: match.document_name,
      page_number: match.page_number,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

export default {
  queryDocument,
  queryDocumentStream,
  queryUserDocuments,
  queryUserDocumentsStream,
};
