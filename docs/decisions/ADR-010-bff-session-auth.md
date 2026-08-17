# ADR-010: Server-side Session Auth in the BFF

## Context

Feature 001 (App Shell & Keycloak Login) requires OIDC login where tokens
never reach the browser (spec clarification 2026-08-17). The BFF is the
declared owner of "auth context" (AGENTS.md).

## Problem

Where do OAuth tokens live, and how does the browser prove identity without
holding a JWT?

## Decision

1. **BFF drives the whole OIDC flow** (Authorization Code + PKCE) as the
   Keycloak confidential client `finance-web` using `openid-client` v6.
2. **Sessions are server-side rows** in the PostgreSQL table `sessions`
   (BFF-owned): `id` (UUID), `keycloak_user_id`, `encrypted_tokens`
   (AES-256-GCM, key derived from `SESSION_SECRET`), `created_at`,
   `last_activity_at` (60s write throttle), `expires_at`.
3. **Browser holds only a signed cookie** `finance_session` =
   `<sessionId>.<hmac-sha256>`; httpOnly, sameSite=lax, secure in production.
4. **SessionAuthGuard** (global in BFF): cookie → session → 30 min inactivity
   check (`SESSION_EXPIRED`) → silent refresh when the access token expires in
   <60s → `req.user`.
5. **API-MS validates Bearer JWTs** via global `JwtAuthGuard` +
   `KeycloakTokenVerifier` (`packages/auth`); BFF forwards
   `Authorization: Bearer <accessToken>` from the session.
6. **Provisional user id**: no local user module exists yet, so
   `AuthenticatedUser.id = keycloakUserId` (research R7). When local user
   provisioning lands, the mapping changes in ONE place (guards) without
   contract changes.

## Consequences

- Tokens are never exposed to the browser; logout and inactivity are enforced
  server-side (revocable).
- BFF gains a DB dependency (TypeORM + `sessions` migration) — acceptable, as
  PostgreSQL is already in the stack (no Redis, rule 8).
- Sessions survive BFF restarts; horizontal scaling works (shared store).
- Stateless-cookie alternative rejected: Keycloak token trio exceeds 4KB and
  prevents server-side revocation.
