# ADR-009: Clean Architecture in API-MS Modules

## Context

Financial rules must be correct, testable in isolation, and survive future
extraction of modules into microservices. Code is largely written by AI agents
that need predictable placement rules.

## Problem

Framework-coupled business logic (rules inside controllers/ORM entities) is
hard to test and impossible to extract.

## Decision

Every API-MS module follows: `domain` (pure TS: entities, VOs, repository
interfaces, errors) ← `application` (use cases with constructor-injected
ports) ← `infrastructure` (TypeORM implementations, migrations) and
`presentation` (controllers/DTOs). Dependencies point inward only. Domain
imports nothing external.

## Alternatives

- Classic NestJS service/controller layers: faster to start, rules end up
  coupled to Nest/TypeORM.
- Hexagonal naming: equivalent; Clean Architecture terms adopted as standard.

## Consequences

- Use cases unit-test with fakes, no DB/Nest bootstrapping.
- More files per feature — accepted cost for predictability and extractability.
- Repository interfaces + domain events form the future microservice seam.
