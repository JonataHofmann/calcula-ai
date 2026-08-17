# ADR-004: Independent AI Service (AI-MS)

## Context

The AI assistant answers financial questions and performs actions. LLM
workloads have different scaling, latency, cost and security profiles than
CRUD APIs.

## Problem

Where should agent logic, prompts, providers and conversations live, and how
does the AI access financial data safely?

## Decision

Separate NestJS service (`services/ai-ms`) owning: finance agent, prompts,
tools, provider abstraction, model routing (9Router), conversations, usage
tracking, SSE streaming. Data access ONLY through authorized tools that call
the API-MS application layer with the user's auth context. No SQL in AI-MS.

## Alternatives

- AI inside API-MS: couples LLM latency/failures to financial API; blurs the
  security boundary.
- AI with direct DB access: prompt injection could become data exfiltration.

## Consequences

- Clear security boundary; every AI capability is an auditable tool.
- Extra HTTP hop for tool calls (acceptable; tools are user-scoped).
- Sensitive writes require explicit user confirmation.
