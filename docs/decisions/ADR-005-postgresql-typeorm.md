# ADR-005: PostgreSQL + TypeORM

## Context

Financial data demands ACID transactions, precise decimal arithmetic and
mature tooling.

## Problem

Choice of database and data-access layer for the API-MS.

## Decision

PostgreSQL with TypeORM (entities, repositories, QueryBuilder, migrations,
transactions). Money as `NUMERIC(14,2)`, surfaced as decimal strings. Schema
changes only via migrations (`synchronize: false`). TypeORM entities are
infrastructure and never exposed as HTTP contracts.

## Alternatives

- Prisma: good DX but weaker fit for the repository-interface pattern required
  by Clean Architecture here.
- Sequelize: weaker TypeScript support.

## Consequences

- Domain repositories are interfaces; TypeORM implementations live in
  `infrastructure/persistence`, keeping the domain ORM-free.
- Transfers/installments/recurring use single DB transactions.
