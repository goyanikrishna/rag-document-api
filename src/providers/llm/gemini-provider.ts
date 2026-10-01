import { GoogleGenerativeAI } from '@google/generative-ai';
import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
import { ErrorCodes } from '@/common/constants/error-codes';
// interfaces
import { IChatMessage, ILLMResponse } from './llm-provider.interface';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const modelName = env.GEMINI_MODEL;

function handleGeminiError(error: any, operation: string): never {
  logger.error(`Gemini LLM API ${operation} Error: ${error.message}`);
  const errorMsg = error?.message || '';
  const isRateLimit =
    errorMsg.includes('429') ||
    errorMsg.includes('Too Many Requests') ||
    errorMsg.includes('Quota exceeded') ||
    errorMsg.includes('RESOURCE_EXHAUSTED') ||
    error?.status === 429;

  if (isRateLimit) {
    throw new APIError(
      'AI quota or rate limit exceeded. Please wait a few moments and try again.',
      httpStatus.TOO_MANY_REQUESTS as number,
      true,
      ErrorCodes.TOO_MANY_REQUESTS,
    );
  }

  throw new APIError(
    `AI Generation failed: ${error.message}`,
    httpStatus.BAD_GATEWAY as number,
    true,
    ErrorCodes.INTERNAL_SERVER_ERROR,
  );
}

/**
 * Generates a standard (non-streaming) text response.
 */
async function generateResponse(prompt: string, systemInstruction?: string): Promise<ILLMResponse> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
        ? ({ role: 'system', parts: [{ text: systemInstruction }] } as any)
        : undefined,
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Received empty response from Gemini API.');
    }

    return { text };
  } catch (error: any) {
    handleGeminiError(error, 'Generation');
  }
}

/**
 * Generates a chat response given a history of messages. (FOR NOW NOT IN USE)
 */
async function generateChatResponse(
  messages: IChatMessage[],
  systemInstruction?: string,
): Promise<ILLMResponse> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
        ? ({ role: 'system', parts: [{ text: systemInstruction }] } as any)
        : undefined,
    });

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    const result = await chat.sendMessage(lastMessage);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Received empty chat response from Gemini API.');
    }

    return { text };
  } catch (error: any) {
    handleGeminiError(error, 'Chat');
  }
}

/**
 * Generates a streaming text response.
 */
async function generateResponseStream(
  prompt: string,
  systemInstruction?: string,
): Promise<AsyncGenerator<string, void, unknown>> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
        ? ({ role: 'system', parts: [{ text: systemInstruction }] } as any)
        : undefined,
    });

    const resultStream = await model.generateContentStream(prompt);

    async function* makeGenerator() {
      try {
        for await (const chunk of resultStream.stream) {
          const text = chunk.text();
          if (text) {
            yield text;
          }
        }
      } catch (streamIterError: any) {
        handleGeminiError(streamIterError, 'Streaming Chunk');
      }
    }

    return makeGenerator();
  } catch (error: any) {
    handleGeminiError(error, 'Streaming');
  }
}

export default {
  generateResponse,
  generateChatResponse,
  generateResponseStream,
};
