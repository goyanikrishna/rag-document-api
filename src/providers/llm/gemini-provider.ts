import { GoogleGenerativeAI } from '@google/generative-ai';
import httpStatus from 'http-status';
// config
import { env } from '@/config/env';
import { logger } from '@/config/logger';
// common
import APIError from '@/common/errors/api-error';
// interfaces
import { IChatMessage, ILLMResponse } from './llm-provider.interface';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const modelName = env.GEMINI_MODEL;

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
    logger.error(`Gemini LLM API Error: ${error.message}`);
    throw new APIError(
      `Gemini Generation failed: ${error.message}`,
      httpStatus.BAD_GATEWAY as number,
      false,
    );
  }
}

/**
 * Generates a chat response given a history of messages. (FOR NOW N0T IN USE)
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

    // Map our message formats to Gemini's history structure (only user and model roles are supported by history)
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
    logger.error(`Gemini LLM Chat Error: ${error.message}`);
    throw new APIError(
      `Gemini Chat Generation failed: ${error.message}`,
      httpStatus.BAD_GATEWAY as number,
      false,
    );
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
      for await (const chunk of resultStream.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    }

    return makeGenerator();
  } catch (error: any) {
    logger.error(`Gemini LLM API Streaming Error: ${error.message}`);
    throw new APIError(
      `Gemini Streaming Generation failed: ${error.message}`,
      httpStatus.BAD_GATEWAY as number,
      false,
    );
  }
}

export default {
  generateResponse,
  generateChatResponse,
  generateResponseStream,
};
