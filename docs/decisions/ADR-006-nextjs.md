# ADR-006: Next.js for Web and Admin

## Context

User-facing web app (dashboard, transactions, AI chat) and an admin app.

## Problem

Framework choice for fast, SEO-capable, streaming-friendly frontends that AI
agents can navigate predictably.

## Decision

Next.js App Router with React Server Components, Tailwind CSS v4, feature-based
folders (`features/<domain>`), shared design system in `packages/ui`.
Admin is a separate Next.js app reusing `ui` and `contracts`.

## Alternatives

- Vite SPA: no RSC/streaming; more client bundle.
- Remix: viable, but the team standardizes on one meta-framework.

## Consequences

- SSE streaming for AI chat integrates naturally.
- Feature folders form the seam for potential future microfrontends
  (no Module Federation until a real need exists).
