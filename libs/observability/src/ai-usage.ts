export interface AIUsageMetrics {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  conversationId?: string;
  toolCalls?: number;
}
