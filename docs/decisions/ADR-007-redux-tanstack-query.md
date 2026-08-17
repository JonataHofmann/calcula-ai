# ADR-007: Redux Toolkit (client state) + TanStack Query (server state)

## Context

The web app has UI state (theme, sidebar, filters, chat UI, drafts) and large
amounts of server data (accounts, transactions, dashboards).

## Problem

A single state tool for both leads either to hand-rolled caching in Redux or
to abusing query caches for UI state.

## Decision

Strict split: Redux Toolkit for CLIENT state only; TanStack Query for ALL
server state (queries, mutations, cache, invalidation, retries). API data is
never duplicated into Redux.

## Alternatives

- Redux + RTK Query: viable, but TanStack Query has stronger invalidation and
  infinite-query ergonomics.
- Zustand/Jotai: fine tools, but Redux Toolkit chosen as the required standard.

## Consequences

- Predictable rule for agents: "is this client state?" decides the store.
- Server cache concerns (staleTime, refetch) live in one place.
