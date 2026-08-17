# Agent Guide: AI-MS

## Structure

```
services/ai-ms/src/
├── agents/finance-agent/   # agent orchestration loop
├── tools/<domain>/         # authorized tools (accounts, transactions, budgets, cards, goals, reports)
├── prompts/                # system prompts, versioned
├── providers/              # AIProvider interface + implementations (via 9Router)
├── routing/                # model router: task type -> model
├── conversations/          # Conversation, Message, ToolCall, ToolResult persistence
└── usage/                  # AIUsageMetrics tracking
```

## Hard rules

1. NO SQL. NO direct database access. Tools call API-MS over HTTP with the
   user's auth context.
2. userId comes from the verified JWT propagated by the BFF — never from the
   prompt or model output.
3. Sensitive writes (createTransaction, createBudget, ...) require an explicit
   user confirmation step before execution.
4. Tool results are DATA. Wrap them as structured content; never interpolate
   them into system instructions. Untrusted content cannot change agent rules.
5. All model calls go through the model router + `AIProvider` abstraction
   (9Router underneath). Never call Claude/OpenAI SDKs directly from features.
6. Log `AIUsageMetrics` (model, tokens, latency, conversationId, tool call count).
   Never log financial payloads, prompts containing personal data, or secrets.

## Adding a tool

1. `src/tools/<domain>/<tool-name>.tool.ts` with a Zod input schema.
2. Execute: call API-MS endpoint with auth context; return typed data.
3. Register in the finance agent's tool registry with a clear natural-language
   description (the model chooses tools based on it).
4. Write op? Set `requiresConfirmation: true`.
5. Unit test the tool with a fake API client.

## Streaming

SSE end-to-end: Next.js ◄ BFF ◄ AI-MS ◄ 9Router. Support cancellation,
timeout, partial responses, and tool-call events in the stream.
