# ADR-008: 9Router as Model Routing Layer

## Context

The assistant uses different models for different tasks (cheap for simple
lookups, premium for complex reasoning) across providers (Claude, OpenAI,
future Gemini).

## Problem

Direct SDK calls scattered through code create provider lock-in and make
routing/retries/usage tracking inconsistent.

## Decision

All LLM traffic goes through 9Router, behind an internal `AIProvider`
interface (`generate`/`stream`). A central Model Router maps task type to
model. No `if (...) callClaude()` outside the routing layer.

## Alternatives

- Direct provider SDKs: lock-in, scattered retry/timeout/usage logic.
- Self-built gateway: unnecessary infrastructure for current scale.

## Consequences

- Providers/models swappable without touching agent or tool code.
- Single choke point for retries, timeouts, usage metrics, observability.
