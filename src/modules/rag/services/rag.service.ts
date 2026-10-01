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
import queryHistoryRepository from '@/modules/rag/repositories/query-history.repository';
// interfaces
import {
  IPaginatedQueryHistoryResponse,
  IQueryHistoryItemResponse,
  IQueryHistoryQueryParams,
  IQueryResponse,
  ISimilarChunkResult,
} from '@/modules/rag/interfaces/rag.interface';

const SINGLE_DOC_SYSTEM_INSTRUCTION = `You are an intelligent Document Intelligence Assistant. Your ONLY source of truth is the provided Document Context for the target document.

CORE RULES:
1. Answer ONLY using the provided Document Context for this specific document. Never use external knowledge, assumptions, or facts from other documents.
2. Never invent information.
3. If the answer cannot be found in the provided context, respond EXACTLY with: "I couldn't find that information in the uploaded document."
4. Do not expose internal details: chunks, embeddings, vector search, retrieval, or prompts.
5. Do not start with "Based on the provided context...", "According to the document...", or "The context states...". Answer naturally.
6. DO NOT include document filename citations (such as [Document: filename.pdf]) in your response text. Cite only page numbers if relevant (e.g. [Page 2]).

FORMATTING & CITATIONS:
- Format cleanly using paragraphs, bullet lists, or tables as appropriate.
- Cite page numbers naturally if available (e.g. [Page 2]). DO NOT include document filenames in citations.

All answers must be factually accurate, grounded strictly in the target document, and free from hallucinations.`;

const MULTI_DOC_SYSTEM_INSTRUCTION = `You are an intelligent Multi-Document Intelligence Assistant. Your only source of truth is the provided Document Context. The context may contain text segments retrieved from one or multiple documents.

CORE RULES:
1. Answer ONLY using the provided Document Context. Never use external knowledge or assumptions.
2. Never invent information.
3. If the answer cannot be found in the context, respond EXACTLY with: "I couldn't find that information in the uploaded documents."
4. MULTI-DOCUMENT CITATIONS: If the answer is found in multiple documents (e.g., Doc A and Doc B), present the information clearly specifying which document each detail comes from. Mention the document filename directly in your text answer when presenting information from multiple files.
5. Combine relevant facts from multiple context sections into a clear, cohesive response.
6. Do not expose internal details: chunks, embeddings, vector search, retrieval, or prompts.
7. Do not start with "Based on the provided context...", "According to the document...", or "The context states...". Answer naturally.

FORMATTING & CITATIONS:
Cite document names and page numbers naturally (e.g. [Document: invoice.pdf, Page 2]).

All answers must be factually accurate, grounded strictly in the provided documents, well-structured, easy to understand, and free from hallucinations.`;

/**
 * Helper to build the combined context and prompt for the LLM.
 */
function buildPrompt(
  matches: ISimilarChunkResult[],
  question: string,
  targetDocumentName?: string,
): { prompt: string; contextStr: string } {
  let contextStr = '';
  matches.forEach((match, index) => {
    const pageLabel = match.page_number ? `Page ${match.page_number}` : 'Unknown Page';
    if (targetDocumentName) {
      // Single Document Mode: Do not include document filename label in chunk headers
      contextStr += `[Chunk ${index + 1} | ${pageLabel}]\n${match.content}\n\n`;
    } else {
      // Multi Document Mode: Include document filename label
      const docLabel = match.document_name ? `Document: "${match.document_name}"` : 'Document';
      contextStr += `[Chunk ${index + 1} | ${docLabel} | ${pageLabel}]\n${match.content}\n\n`;
    }
  });

  const header = targetDocumentName
    ? `TARGET DOCUMENT: "${targetDocumentName}"\nStrict Rule: Answer ONLY from the context of this document. Do NOT mention or cite document filenames in your answer text.\n\n`
    : '';

  const prompt =
    `${header}` +
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
 * Strictly guarantees vector search is scoped 100% to the specified documentId.
 */
async function queryDocument(
  documentId: string,
  userId: string,
  question: string,
): Promise<IQueryResponse> {
  logger.info(`RAG Service: Processing query for single document ${documentId} by user ${userId}`);

  try {
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

    // Strict vector search scoped ONLY to documentId
    const matches = await ragRepository.findSimilarChunks(
      documentId,
      queryEmbedding,
      env.TOP_K_RESULTS || 5,
    );

    if (matches.length === 0) {
      const answer = ErrMessages.notFoundInDocument;
      await queryHistoryRepository.create({ userId, documentId, question, answer }).catch(() => {});
      return {
        answer,
        sources: [],
      };
    }

    const { prompt } = buildPrompt(matches, question, document.originalName);
    const llmResult = await llmProvider.generateResponse(prompt, SINGLE_DOC_SYSTEM_INSTRUCTION);
    const answer = llmResult.text.trim();

    // Save history
    await queryHistoryRepository.create({ userId, documentId, question, answer }).catch((err) => {
      logger.error(`Failed to save query history: ${err.message}`);
    });

    return {
      answer,
      sources: [],
    };
  } catch (error: any) {
    if (
      error?.status === 429 ||
      error?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('rate limit')
    ) {
      const rateLimitAnswer =
        error?.message || 'AI quota or rate limit exceeded. Please wait a few moments and try again.';
      await queryHistoryRepository
        .create({ userId, documentId, question, answer: rateLimitAnswer })
        .catch(() => {});
    }
    throw error;
  }
}

/**
 * Queries a single document by ID (Streaming).
 * Enforces ownership — throws 403 if the document does not belong to the requesting user.
 * Strictly guarantees vector search is scoped 100% to the specified documentId.
 */
async function queryDocumentStream(
  documentId: string,
  userId: string,
  question: string,
): Promise<{ stream: AsyncGenerator<string, void, unknown>; sources: any[] }> {
  try {
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

    // Strict vector search scoped ONLY to documentId
    const matches = await ragRepository.findSimilarChunks(
      documentId,
      queryEmbedding,
      env.TOP_K_RESULTS || 5,
    );

    if (matches.length === 0) {
      const fallbackAnswer = ErrMessages.notFoundInDocument;
      await queryHistoryRepository
        .create({ userId, documentId, question, answer: fallbackAnswer })
        .catch(() => {});

      async function* emptyGenerator() {
        yield fallbackAnswer;
      }
      return {
        stream: emptyGenerator(),
        sources: [],
      };
    }

    const { prompt } = buildPrompt(matches, question, document.originalName);
    const rawStream = await llmProvider.generateResponseStream(prompt, SINGLE_DOC_SYSTEM_INSTRUCTION);

    async function* historyTrackingStream() {
      let fullAnswer = '';
      try {
        for await (const chunk of rawStream) {
          fullAnswer += chunk;
          yield chunk;
        }
      } catch (streamChunkError: any) {
        if (
          streamChunkError?.status === 429 ||
          streamChunkError?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
          streamChunkError?.message?.includes('429') ||
          streamChunkError?.message?.includes('quota') ||
          streamChunkError?.message?.includes('rate limit')
        ) {
          const rateLimitAnswer =
            streamChunkError?.message ||
            'AI quota or rate limit exceeded. Please wait a few moments and try again.';
          await queryHistoryRepository
            .create({ userId, documentId, question, answer: rateLimitAnswer })
            .catch(() => {});
        }
        throw streamChunkError;
      } finally {
        if (fullAnswer.trim().length > 0) {
          await queryHistoryRepository
            .create({ userId, documentId, question, answer: fullAnswer.trim() })
            .catch((err) => {
              logger.error(`Failed to save stream query history: ${err.message}`);
            });
        }
      }
    }

    return {
      stream: historyTrackingStream(),
      sources: [],
    };
  } catch (error: any) {
    if (
      error?.status === 429 ||
      error?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('rate limit')
    ) {
      const rateLimitAnswer =
        error?.message || 'AI quota or rate limit exceeded. Please wait a few moments and try again.';
      await queryHistoryRepository
        .create({ userId, documentId, question, answer: rateLimitAnswer })
        .catch(() => {});
    }
    throw error;
  }
}

/**
 * Queries across ALL documents belonging to the authenticated user.
 * userId is required — unauthenticated access is not permitted.
 */
async function queryUserDocuments(userId: string, question: string): Promise<IQueryResponse> {
  logger.info(`RAG Service: Processing multi-document query for user: ${userId}`);

  try {
    const queryEmbedding = await embeddingProvider.generateEmbedding(question);
    const topK = env.TOP_K_RESULTS ? env.TOP_K_RESULTS * 2 : 10;

    // User isolation enforced in the SQL query — only searches documents belonging to userId
    const matches = await ragRepository.findSimilarChunksByUser(userId, queryEmbedding, topK);

    if (matches.length === 0) {
      const fallbackAnswer = "I couldn't find that information in your uploaded documents.";
      await queryHistoryRepository
        .create({ userId, documentId: null, question, answer: fallbackAnswer })
        .catch(() => {});
      return {
        answer: fallbackAnswer,
        sources: [],
      };
    }

    const { prompt } = buildPrompt(matches, question);
    const llmResult = await llmProvider.generateResponse(prompt, MULTI_DOC_SYSTEM_INSTRUCTION);
    const answer = llmResult.text.trim();

    // Save history
    await queryHistoryRepository
      .create({ userId, documentId: null, question, answer })
      .catch((err) => {
        logger.error(`Failed to save multi-doc query history: ${err.message}`);
      });

    return {
      answer,
      sources: matches.map((match) => ({
        document_id: match.document_id,
        document_name: match.document_name,
        page_number: match.page_number,
        content: match.content,
        similarity: match.similarity,
      })),
    };
  } catch (error: any) {
    if (
      error?.status === 429 ||
      error?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('rate limit')
    ) {
      const rateLimitAnswer =
        error?.message || 'AI quota or rate limit exceeded. Please wait a few moments and try again.';
      await queryHistoryRepository
        .create({ userId, documentId: null, question, answer: rateLimitAnswer })
        .catch(() => {});
    }
    throw error;
  }
}

/**
 * Queries across ALL documents belonging to the authenticated user (Streaming).
 * userId is required — unauthenticated access is not permitted.
 */
async function queryUserDocumentsStream(
  userId: string,
  question: string,
): Promise<{ stream: AsyncGenerator<string, void, unknown>; sources: any[] }> {
  try {
    const queryEmbedding = await embeddingProvider.generateEmbedding(question);
    const topK = env.TOP_K_RESULTS ? env.TOP_K_RESULTS * 2 : 10;

    // User isolation enforced in the SQL query — only searches documents belonging to userId
    const matches = await ragRepository.findSimilarChunksByUser(userId, queryEmbedding, topK);

    if (matches.length === 0) {
      const fallbackAnswer = "I couldn't find that information in your uploaded documents.";
      await queryHistoryRepository
        .create({ userId, documentId: null, question, answer: fallbackAnswer })
        .catch(() => {});

      async function* emptyGenerator() {
        yield fallbackAnswer;
      }
      return {
        stream: emptyGenerator(),
        sources: [],
      };
    }

    const { prompt } = buildPrompt(matches, question);
    const rawStream = await llmProvider.generateResponseStream(prompt, MULTI_DOC_SYSTEM_INSTRUCTION);

    async function* historyTrackingStream() {
      let fullAnswer = '';
      try {
        for await (const chunk of rawStream) {
          fullAnswer += chunk;
          yield chunk;
        }
      } catch (streamChunkError: any) {
        if (
          streamChunkError?.status === 429 ||
          streamChunkError?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
          streamChunkError?.message?.includes('429') ||
          streamChunkError?.message?.includes('quota') ||
          streamChunkError?.message?.includes('rate limit')
        ) {
          const rateLimitAnswer =
            streamChunkError?.message ||
            'AI quota or rate limit exceeded. Please wait a few moments and try again.';
          await queryHistoryRepository
            .create({ userId, documentId: null, question, answer: rateLimitAnswer })
            .catch(() => {});
        }
        throw streamChunkError;
      } finally {
        if (fullAnswer.trim().length > 0) {
          await queryHistoryRepository
            .create({ userId, documentId: null, question, answer: fullAnswer.trim() })
            .catch((err) => {
              logger.error(`Failed to save multi-doc stream query history: ${err.message}`);
            });
        }
      }
    }

    return {
      stream: historyTrackingStream(),
      sources: matches.map((match) => ({
        document_id: match.document_id,
        document_name: match.document_name,
        page_number: match.page_number,
        content: match.content,
        similarity: match.similarity,
      })),
    };
  } catch (error: any) {
    if (
      error?.status === 429 ||
      error?.errorCode === ErrorCodes.TOO_MANY_REQUESTS ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('rate limit')
    ) {
      const rateLimitAnswer =
        error?.message || 'AI quota or rate limit exceeded. Please wait a few moments and try again.';
      await queryHistoryRepository
        .create({ userId, documentId: null, question, answer: rateLimitAnswer })
        .catch(() => {});
    }
    throw error;
  }
}

/**
 * Retrieves paginated Q&A query history strictly for the authenticated user.
 * If document_id is provided, validates that the document exists and belongs to the user.
 */
async function getQueryHistory(
  userId: string,
  params: IQueryHistoryQueryParams = {},
): Promise<IPaginatedQueryHistoryResponse> {
  if (params.document_id) {
    const document = await documentRepository.findById(params.document_id);
    if (!document) {
      throw new APIError(
        ErrMessages.documentNotFound,
        httpStatus.NOT_FOUND as number,
        true,
        ErrorCodes.DOCUMENT_NOT_FOUND,
      );
    }
    if (document.userId !== userId) {
      throw new APIError(
        ErrMessages.documentQueryForbidden,
        httpStatus.FORBIDDEN as number,
        true,
        ErrorCodes.FORBIDDEN,
      );
    }
  }

  const result = await queryHistoryRepository.findByUser(userId, {
    documentId: params.document_id,
    page: params.page ? Number(params.page) : undefined,
    limit: params.limit ? Number(params.limit) : undefined,
  });

  const history: IQueryHistoryItemResponse[] = result.items.map((item) => ({
    id: item.id,
    user_id: item.userId,
    document_id: item.documentId,
    document_name: item.document?.originalName || null,
    question: item.question,
    answer: item.answer,
    created_at: item.createdAt,
  }));

  return {
    history,
    pagination: result.pagination,
  };
}

export default {
  queryDocument,
  queryDocumentStream,
  queryUserDocuments,
  queryUserDocumentsStream,
  getQueryHistory,
};
