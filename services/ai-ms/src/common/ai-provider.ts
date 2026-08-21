export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AIGenerateInput {
  messages: AIMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerateOutput {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIStreamChunk {
  delta: string;
  done: boolean;
}

export interface AIProvider {
  generate(input: AIGenerateInput): Promise<AIGenerateOutput>;
  stream(input: AIGenerateInput): AsyncIterable<AIStreamChunk>;
}
