# Architecture Overview

## Topology

```
Keycloak ── auth (OIDC/JWT) ──► Next.js (web) / Mobile / Admin
                                      │
                                     BFF  (aggregation, auth context, frontend contracts)
                                ┌─────┴─────┐
                                ▼           ▼
                             API-MS       AI-MS
                          (all financial  (agent, tools, model router)
                           business rules)     │
                                │           9Router ──► Claude / OpenAI / others
                                ▼
                            PostgreSQL
```

## Boundaries

| Component | Owns                                                       | Never does                              |
| --------- | ---------------------------------------------------------- | --------------------------------------- |
| API-MS    | financial domain rules, persistence, migrations            | trust frontend userId                   |
| BFF       | aggregation, contract shaping, auth propagation, SSE proxy | business rules                          |
| AI-MS     | agent, prompts, tools, model routing, conversations        | SQL, direct DB access                   |
| web/admin | presentation, client state                                 | financial rules, direct DB/API-MS calls |
| Keycloak  | credentials, OAuth2/OIDC, MFA, roles                       | —                                       |

## API-MS internal modules (bounded contexts)

users, accounts, categories, transactions, cards, installments, recurring,
budgets, goals. Each module follows Clean Architecture
(domain / application / infrastructure / presentation) and can be extracted to
its own microservice later without rewriting the domain.

## Extraction criteria (future microservices)

Extract a module ONLY when there is a real need for independent scale, deploy,
ownership, or isolation. Document the decision in an ADR first.

## Data flow (write example)

```
JWT ► AuthenticatedUser ► Controller ► Use Case ► Repository (interface)
                                            ▲
                              TypeORM implementation (infrastructure)
```

## AI data flow

```
User ► BFF ► AI-MS ► Tool ► API-MS application layer ► Domain ► Repository ► PostgreSQL
```

The AI never receives raw DB access. Tool results are treated as data, never
as instructions (prompt-injection defense).
