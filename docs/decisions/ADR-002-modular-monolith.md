# ADR-002: API-MS as a Modular Monolith

## Context

Financial domains (accounts, transactions, cards, budgets, goals...) with
strong consistency requirements, one small team.

## Problem

Microservices from day one add distributed-system cost (network failures,
sagas, deploy orchestration) with no current benefit.

## Decision

One NestJS service (API-MS) containing all financial business rules, organized
as isolated modules with Clean Architecture boundaries. Modules communicate via
use cases and domain events, never by reaching into each other's internals.

## Alternatives

- Microservices now: premature; distributed transactions for transfers are
  much harder than a single DB transaction.
- Unstructured monolith: rules bleed across modules, extraction impossible.

## Consequences

- Transfers/installments use plain ACID transactions.
- A module can be extracted to a microservice later (interfaces + events
  already form the seam) when there is real need for independent scale,
  deploy, or ownership.
