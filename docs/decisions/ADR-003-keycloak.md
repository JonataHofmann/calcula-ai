# ADR-003: Keycloak for Identity

## Context

The platform needs login, OAuth2/OIDC, JWT, refresh, MFA, roles and groups.

## Problem

Building authentication in-house is high-risk (credential storage, MFA,
session management) and not a differentiator.

## Decision

Keycloak as the identity provider. Applications never store passwords. The
local `User` record stores only `keycloakUserId` + profile/preferences.
`packages/auth` verifies JWTs (JWKS) and maps them to `AuthenticatedUser`
(`{ id, keycloakUserId, roles }`).

## Alternatives

- Custom auth: unacceptable security burden.
- SaaS (Auth0/Clerk): vendor cost/lock-in; Keycloak is self-hosted and free.

## Consequences

- Keycloak container required in dev (docker compose).
- All services trust only verified JWTs; userId never comes from clients.
