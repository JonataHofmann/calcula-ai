# Implementation Plan: App Shell & Keycloak Login

**Branch**: `001-app-shell-keycloak-login` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-app-shell-keycloak-login/spec.md`

## Summary

Login OIDC Authorization Code conduzido pelo BFF (confidential client Keycloak): usuário não autenticado é redirecionado ao Keycloak, retorna via callback no BFF, que troca o code por tokens, guarda-os em sessão server-side e emite cookie httpOnly ao browser. Frontend Next.js ganha app shell (sidebar + header) com rotas protegidas via middleware que consulta a sessão. Backends (BFF e API-MS) validam credenciais em toda requisição via guard NestJS usando `KeycloakTokenVerifier` existente (`packages/auth`). Renovação silenciosa por refresh token; expiração por inatividade de 30 min; logout encerra sessão local + Keycloak (RP-initiated logout).

## Technical Context

**Language/Version**: TypeScript 5.7; Node.js ≥ 20; React 19; Next.js 15 (App Router); NestJS 11

**Primary Dependencies**: `openid-client` v6 (fluxo OIDC no BFF, a adicionar); `jose` (já usado em `packages/auth`); `iron-session` NÃO — sessão server-side em memória/PostgreSQL (ver research R3); cookie assinado httpOnly; Redux Toolkit (`ui-slice.sidebarOpen` já existe); TanStack Query (dados de usuário via BFF)

**Storage**: Tabela `sessions` no PostgreSQL (BFF) — id, tokens cifrados, userId, expiração, lastActivity

**Testing**: Vitest (packages, web); Jest (BFF/API — já configurado); fakes para verifier/session store

**Target Platform**: Web (browsers evergreen); dev local via docker compose (Keycloak 26.1 + PostgreSQL 17)

**Project Type**: Web app (Next.js) + 2 serviços NestJS (BFF, API-MS) + realm Keycloak

**Performance Goals**: Redirect login→app < 2s pós-autenticação; validação JWT no guard < 5ms (JWKS cacheado)

**Constraints**: Tokens nunca chegam ao browser (clarificação 2026-08-17); inatividade 30 min; userId só do JWT verificado (regra 2); cookie `httpOnly`+`secure`+`sameSite=lax`

**Scale/Scope**: 1 realm, 2 clients Keycloak; ~6 rotas protegidas placeholder; 3 endpoints de auth no BFF; 1 guard compartilhado

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` é template não preenchido — aplicam-se regras de `AGENTS.md`:

| Regra | Status |
|---|---|
| 2. userId só do JWT verificado via `AuthenticatedUser` | PASS — guard extrai de `Authorization`/sessão; nunca de body/query |
| 4. Clean Architecture no API-MS | PASS — guard em `common/`, sem regra de negócio; nenhum módulo de domínio novo |
| 5. Redux = client state | PASS — `sidebarOpen`/tema em Redux; dados do usuário via TanStack Query |
| 6. BFF sem regras financeiras | PASS — BFF ganha só auth/sessão (contexto de auth é responsabilidade declarada do BFF) |
| 8. Sem complexidade prematura | PASS — sem lib de sessão pesada; tabela simples + cookie assinado |
| 10. Nunca logar JWTs/secrets | PASS — logger já redige; endpoints de auth não logam tokens |

**Pós-Phase 1**: PASS. Decisão significativa (sessão server-side no BFF) → ADR-010 a criar na implementação.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-shell-keycloak-login/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bff-auth-api.md
│   └── frontend-auth.md
└── tasks.md  (gerado por /speckit.tasks)
```

### Source Code (repository root)

```text
docker/keycloak/realm.json          # finance-web → confidential (secret via env), redirect BFF callback

packages/config/src/env.ts          # + SESSION_SECRET, BFF_PUBLIC_URL, WEB_URL, KEYCLOAK_* obrigatórios p/ BFF
packages/contracts/src/auth/
└── session.ts                      # sessionUserSchema (id, name, email, roles) — contrato BFF→web

services/bff/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts          # GET /auth/login, GET /auth/callback, POST /auth/logout, GET /auth/me
│   ├── auth.service.ts             # OIDC flow (openid-client), refresh, RP-initiated logout
│   ├── session/
│   │   ├── session.store.ts        # interface SessionStore
│   │   ├── typeorm-session.store.ts# tabela sessions (tokens cifrados AES-256-GCM)
│   │   └── session.entity.ts
│   ├── guards/session-auth.guard.ts# valida cookie → sessão → refresh se necessário → req.user
│   └── decorators/current-user.decorator.ts
├── app.module.ts                   # + AuthModule, cookie-parser
└── main.ts                         # + cookie-parser

services/api/src/common/auth/
├── jwt-auth.guard.ts               # Bearer JWT via KeycloakTokenVerifier (packages/auth)
├── current-user.decorator.ts
└── auth.module.ts                  # provê TokenVerifier

apps/web/
├── middleware.ts                   # proteção de rotas: sem cookie → redirect /auth/login?returnTo=...
├── app/
│   ├── layout.tsx                  # shell condicional
│   ├── (app)/                      # grupo autenticado
│   │   ├── layout.tsx              # <Sidebar/> + <Header/> + main
│   │   ├── page.tsx                # Visão Geral
│   │   ├── contas/page.tsx         # placeholders
│   │   ├── transacoes/page.tsx
│   │   ├── cartoes/page.tsx
│   │   ├── orcamentos/page.tsx
│   │   └── metas/page.tsx
│   └── auth/error/page.tsx         # provedor indisponível / callback inválido
├── components/
│   ├── sidebar.tsx                 # itens, colapso (Redux sidebarOpen), item ativo, responsivo
│   └── header.tsx                  # nome/e-mail do usuário, logout
├── features/auth/
│   ├── use-session.ts              # TanStack Query → GET /auth/me
│   └── session-keepalive.ts        # renovação silenciosa em atividade
└── services/auth-api.ts            # chamadas ao BFF (credentials: 'include')
```

**Structure Decision**: Fluxo OIDC inteiro no BFF (`services/bff/src/auth/`) — alinhado ao papel declarado do BFF ("auth context"). API-MS só valida Bearer JWT repassado pelo BFF (`Authorization: Bearer <access_token>` da sessão). Web nunca vê tokens; `middleware.ts` faz gate barato por presença de cookie e o `GET /auth/me` valida de fato.

## Complexity Tracking

| Item | Justificativa | Alternativa rejeitada |
|---|---|---|
| Tabela `sessions` no PostgreSQL | Tokens não podem ir ao browser (clarificação); BFF precisa de estado de sessão sobrevivendo a restart | Cookie stateless com tokens cifrados — estoura limite 4KB (access+refresh+id token Keycloak) e impede revogação por inatividade server-side |
| `openid-client` no BFF | Fluxo code+PKCE, discovery, refresh e RP-logout prontos e certificados | Implementação manual com `jose` — mais código de segurança artesanal, maior risco |
