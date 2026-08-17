# Agent Guide: Architecture

Read `docs/architecture/overview.md` first.

## Dependency direction (Clean Architecture)

```
Presentation ──► Application ──► Domain ◄── Infrastructure
```

Domain must not import: NestJS, TypeORM, PostgreSQL drivers, HTTP clients,
Keycloak, Redis, 9Router, Claude/OpenAI SDKs, or any external API.

## Where does code go?

| I need to...                | Location                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| Add a financial rule        | `services/api/src/modules/<domain>/domain`                        |
| Add a system action         | `services/api/src/modules/<domain>/application/use-cases/<name>/` |
| Persist something           | `services/api/src/modules/<domain>/infrastructure/persistence`    |
| Expose an endpoint          | `services/api/src/modules/<domain>/presentation`                  |
| Aggregate data for a screen | `services/bff/src`                                                |
| Give the AI a capability    | `services/ai-ms/src/tools/<domain>/`                              |
| Share a type/schema         | `packages/contracts`                                              |
| Add a generic UI component  | `packages/ui`                                                     |
| Add a feature screen        | `apps/web/features/<domain>/`                                     |

## Decision checklist

Before a new abstraction: "does it reduce coupling, or add complexity?"
Before a new microservice: "real need for independent deploy/scale/ownership?"
Before a new package: "real reuse across apps?"
Before putting state in Redux: "is this truly client state?"
Before an AI write operation: "is there an authorized tool + explicit confirmation?"

Significant decisions require a new ADR in `docs/decisions/`.
