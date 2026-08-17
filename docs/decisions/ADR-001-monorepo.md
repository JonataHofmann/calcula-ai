# ADR-001: Monorepo with pnpm + Turborepo

## Context

The platform has multiple apps (web, admin, mobile), services (api, bff, ai-ms)
and shared packages (contracts, auth, ui, ...) maintained by a small team
heavily assisted by AI coding agents.

## Problem

How to organize the codebase so contracts stay in sync, tooling is shared,
and agents can navigate everything from one place?

## Decision

Single monorepo using pnpm workspaces and Turborepo (build/lint/typecheck/test
pipelines, caching, dependency graph, incremental execution).

## Alternatives

- Polyrepo: contract drift, harder agent navigation, duplicated tooling.
- Nx: more features but more configuration surface; Turborepo is simpler.

## Consequences

- Atomic cross-cutting changes (contract + producer + consumer in one PR).
- Shared configs (`@finance/tsconfig`, `@finance/eslint-config`).
- Requires workspace discipline (`workspace:*` deps, turbo task graph).
