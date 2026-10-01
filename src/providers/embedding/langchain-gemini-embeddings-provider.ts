import { GoogleGenerativeAI } from '@google/generative-ai';
import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const modelName = env.GEMINI_EMBEDDING_MODEL;

/**
 * Generates a single embedding for a given text.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      outputDimensionality: 768,
    } as any);

    if (!result.embedding || !result.embedding.values) {
      throw new Error('Received empty embedding values from Gemini API.');
    }

    return result.embedding.values;
  } catch (error: any) {
    logger.error(`Embedding Provider Error: ${error.message}`);
    const errorMsg = error?.message || '';
    const isRateLimit =
      errorMsg.includes('429') ||
      errorMsg.includes('Too Many Requests') ||
      errorMsg.includes('Quota exceeded') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      error?.status === 429;

    if (isRateLimit) {
      throw new APIError(
        'AI rate limit or free quota exceeded for embeddings. Please wait a few moments and try again.',
        httpStatus.TOO_MANY_REQUESTS as number,
        true,
      );
    }

    throw new APIError(
      `Embedding generation failed: ${error.message}`,
      httpStatus.BAD_GATEWAY as number,
      true,
    );
  }
}

/**
 * Generates embeddings in batches for efficiency.
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    const batchResult = await model.batchEmbedContents({
      requests: texts.map(
        (text) =>
          ({
            content: { role: 'user', parts: [{ text }] },
            outputDimensionality: 768,
          }) as any,
      ),
    });

    if (!batchResult.embeddings) {
      throw new Error('Received empty batch embedding values from Gemini API.');
    }

    return batchResult.embeddings.map((emb) => emb.values);
  } catch (error: any) {
    logger.error(`Embedding Provider Batch Error: ${error.message}`);
    const errorMsg = error?.message || '';
    const isRateLimit =
      errorMsg.includes('429') ||
      errorMsg.includes('Too Many Requests') ||
      errorMsg.includes('Quota exceeded') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      error?.status === 429;

    if (isRateLimit) {
      throw new APIError(
        'AI rate limit or free quota exceeded for embeddings. Please wait a few moments and try again.',
        httpStatus.TOO_MANY_REQUESTS as number,
        true,
      );
    }

    throw new APIError(
      `Batch embedding generation failed: ${error.message}`,
      httpStatus.BAD_GATEWAY as number,
      true,
    );
  }
}

export default {
  generateEmbedding,
  generateEmbeddings,
};
