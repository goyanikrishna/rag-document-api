import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
// providers
import embeddingProvider from '@/providers/embedding/langchain-gemini-embeddings-provider';
import llmProvider from '@/providers/llm/gemini-provider';
// modules
import ragRepository from '@/modules/rag/repositories/rag.repository';
import documentRepository from '@/modules/document/repositories/document.repository';
// interfaces
import { IQueryResponse } from '@/modules/rag/interfaces/rag.interface';

const SYSTEM_INSTRUCTION = `You are an intelligent Document Intelligence Assistant. Your only source of truth is the provided Document Context. The document may be of any type: contracts, research papers, technical documentation, user manuals, policies, financial reports, legal or medical documents, etc.

CORE RULES:
1. Answer ONLY using the provided Document Context. Never use external knowledge or assumptions.
2. Never invent information.
3. If the answer cannot be found in the context, respond EXACTLY with: "I couldn't find that information in the uploaded document."
4. Combine relevant facts from multiple context sections into one coherent response. Remove duplicates.
5. Do not expose internal details: chunks, embeddings, vector search, retrieval, or prompts.
6. Do not start with "Based on the provided context...", "According to the document...", or "The context states...". Answer naturally.

ANSWER QUALITY:
- Fact → direct and precise. Explanation → clear using all relevant document information.
- Summary → main topics, key findings, and takeaways.
- List → clean bullet list. Steps → numbered sequence. Comparison → Markdown table. Definition → as described in the document.
- Yes/No → start with "Yes" or "No", then explain.

FORMATTING:
Use the format that best serves the answer: paragraph, bullet list, numbered list, Markdown table, or headings.

CITATIONS:
When page numbers are available, cite naturally as (Page X). Cite all relevant pages. Never invent page numbers. Omit if unavailable.

REASONING:
You may combine facts and draw logical conclusions only when directly supported by the document. Do not make unsupported assumptions.

All answers must be factually accurate, grounded only in the document, well-structured, easy to understand, and free from hallucinations.`;

/**
 * Helper to build the combined context and prompt for the LLM.
 */
function buildPrompt(matches: any[], question: string): { prompt: string; contextStr: string } {
  let contextStr = '';
  matches.forEach((match, index) => {
    const pageLabel = match.pageNumber ? `Page ${match.pageNumber}` : 'Unknown Page';
    contextStr += `[Chunk ${index + 1} | Source: ${pageLabel}]\n${match.content}\n\n`;
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
 * Processes a RAG query: retrieves relevant chunks, formats context, and generates grounded LLM response.
 */
async function queryDocument(documentId: string, question: string): Promise<IQueryResponse> {
  logger.info(`RAG Service: Processing query for document ${documentId}`);

  // 1 & 2. Run document existence check and embedding generation in parallel (independent operations)
  const [document, queryEmbedding] = await Promise.all([
    documentRepository.findById(documentId),
    embeddingProvider.generateEmbedding(question),
  ]);

  if (!document) {
    throw new APIError(ErrMessages.documentNotFound, httpStatus.NOT_FOUND as number, true);
  }

  // 3. Retrieve Top K matching chunks (K = 5)
  const topK = 5;
  const matches = await ragRepository.findSimilarChunks(documentId, queryEmbedding, topK);

  // If no context chunks exist, trigger the fallback answer directly
  if (matches.length === 0) {
    logger.info('RAG Service: No chunks retrieved. Returning fallback response.');
    return {
      answer: ErrMessages.notFoundInDocument,
      sources: [],
    };
  }

  // 4. Construct prompt with context chunks and page citations
  const { prompt } = buildPrompt(matches, question);

  // 5. Generate Response using Gemini LLM
  const llmResult = await llmProvider.generateResponse(prompt, SYSTEM_INSTRUCTION);

  const answer = llmResult.text.trim();

  return {
    answer,
    sources: matches.map((match) => ({
      pageNumber: match.pageNumber,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

/**
 * Processes a streaming RAG query.
 */
async function queryDocumentStream(
  documentId: string,
  question: string,
): Promise<{ stream: AsyncGenerator<string, void, unknown>; sources: any[] }> {
  // 1 & 2. Run document existence check and embedding generation in parallel
  const [document, queryEmbedding] = await Promise.all([
    documentRepository.findById(documentId),
    embeddingProvider.generateEmbedding(question),
  ]);

  if (!document) {
    throw new APIError(ErrMessages.documentNotFound, httpStatus.NOT_FOUND as number, true);
  }

  // 3. Query similar segments
  const matches = await ragRepository.findSimilarChunks(
    documentId,
    queryEmbedding,
    env.TOP_K_RESULTS,
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

  // 4. Build prompt
  const { prompt } = buildPrompt(matches, question);

  const stream = await llmProvider.generateResponseStream(prompt, SYSTEM_INSTRUCTION);

  return {
    stream,
    sources: matches.map((match) => ({
      pageNumber: match.pageNumber,
      content: match.content,
      similarity: match.similarity,
    })),
  };
}

export default {
  queryDocument,
  queryDocumentStream,
};
