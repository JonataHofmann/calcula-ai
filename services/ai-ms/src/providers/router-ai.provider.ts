import { Injectable, Logger } from '@nestjs/common';
import type { AIUsageMetrics } from '@finance/observability';
import type {
  AIGenerateInput,
  AIGenerateOutput,
  AIProvider,
  AIStreamChunk,
} from '../common/ai-provider';

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * AIProvider backed by the 9Router / AI Gateway (OpenAI-compatible chat
 * completions). Reads AI_ROUTER_URL + AI_ROUTER_API_KEY from the environment.
 * Never logs message content, only model/usage metadata.
 */
const PROVIDER = '9router';

@Injectable()
export class RouterAiProvider implements AIProvider {
  private readonly logger = new Logger(RouterAiProvider.name);
  private readonly base = process.env.AI_ROUTER_URL ?? '';
  private readonly apiKey = process.env.AI_ROUTER_API_KEY ?? '';

  async generate(input: AIGenerateInput): Promise<AIGenerateOutput> {
    if (!this.base || !this.apiKey) {
      throw new Error('AI_ROUTER_URL / AI_ROUTER_API_KEY not configured');
    }

    const started = Date.now();
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        // The gateway streams (SSE) by default; force a single JSON body so
        // res.json() below can parse it.
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`AI router error ${res.status}: ${body.slice(0, 200)}`);
      throw new Error(`AI router request failed with status ${res.status}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    const model = data.model ?? input.model;
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

    // Structured AI usage metrics (model/tokens/latency) — never the message content.
    const metrics: AIUsageMetrics = {
      provider: PROVIDER,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs: Date.now() - started,
    };
    this.logger.log(`AI usage ${JSON.stringify(metrics)}`);

    return { content, model, promptTokens, completionTokens };
  }

  // eslint-disable-next-line require-yield
  async *stream(_input: AIGenerateInput): AsyncIterable<AIStreamChunk> {
    throw new Error('RouterAiProvider.stream not implemented');
  }
}
