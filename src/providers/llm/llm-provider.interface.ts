export interface IChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface ILLMResponse {
  text: string;
}

export interface ILLMProvider {
  generateResponse(prompt: string, systemInstruction?: string): Promise<ILLMResponse>;
  generateChatResponse(messages: IChatMessage[], systemInstruction?: string): Promise<ILLMResponse>;
  generateResponseStream(
    prompt: string,
    systemInstruction?: string,
  ): Promise<AsyncGenerator<string, void, unknown>>;
}
