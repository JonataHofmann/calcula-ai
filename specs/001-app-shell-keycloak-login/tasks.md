# Tasks: App Shell & Keycloak Login

**Input**: Design documents from `/specs/001-app-shell-keycloak-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos (Definition of Done do AGENTS.md exige testes; spec exige validação back+front).

**Organization**: Agrupado por user story. US1 (login) e US4 (validação backend) são P1; US4 primeiro pois US1 depende do guard de sessão.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Atualizar `docker/keycloak/realm.json`: `finance-web` → `publicClient: false` + secret dev, `redirectUris: ["http://localhost:3002/auth/callback"]`, `attributes` de post-logout redirect `http://localhost:3000/*`, usuário seed `test@finance.local`/`test1234` com role `user` (research R8)
- [x] T002 [P] Estender `packages/config/src/env.ts` com `SESSION_SECRET` (min 32 chars), `BFF_PUBLIC_URL`, `WEB_URL`, `NEXT_PUBLIC_BFF_URL` (opcionais no schema global; validação de obrigatoriedade no bootstrap do BFF) + testes em `packages/config/src/env.spec.ts`
- [x] T003 [P] Criar contrato `sessionUserSchema` em `packages/contracts/src/auth/session.ts` (`{id, name, email?, roles}` — data-model §3) e exportar em `packages/contracts/src/index.ts`
- [x] T004 Adicionar deps ao BFF em `services/bff/package.json`: `openid-client@^6`, `cookie-parser`, `@nestjs/typeorm`, `typeorm`, `pg`, `uuid` (+ types dev); rodar `pnpm install`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Bloqueia todas as user stories

- [x] T005 Criar `SessionStore` (interface) em `services/bff/src/auth/session/session.store.ts` e entidade TypeORM `SessionEntity` em `services/bff/src/auth/session/session.entity.ts` (campos do data-model §1)
- [x] T006 Implementar `TypeormSessionStore` em `services/bff/src/auth/session/typeorm-session.store.ts`: CRUD de sessão, cifragem AES-256-GCM dos tokens com chave derivada de `SESSION_SECRET`, throttle de `lastActivityAt` (60s), limpeza oportunista de sessões expiradas
- [x] T007 Configurar TypeORM no BFF (`services/bff/src/app.module.ts` + datasource) apontando `DATABASE_URL`; migração da tabela `sessions` em `services/bff/src/auth/session/migrations/`
- [x] T008 Implementar utilitário de cookie assinado (HMAC com `SESSION_SECRET`) em `services/bff/src/auth/session/cookie.util.ts`: `sign/verify` do valor `finance_session`, atributos httpOnly/secure/sameSite=lax (data-model §2)
- [x] T009 Habilitar `cookie-parser` em `services/bff/src/main.ts` e CORS `WEB_URL` com `credentials: true`
- [x] T010 [P] Testes unitários do store e cookie util em `services/bff/src/auth/session/typeorm-session.store.spec.ts` (fake repo) e `cookie.util.spec.ts` (assinatura válida/adulterada)

**Checkpoint**: Infra de sessão pronta

---

## Phase 3: User Story 4 - Proteção e validação no backend (Priority: P1)

**Goal**: Toda requisição a BFF/API-MS validada; identidade só do token verificado.

**Independent Test**: `curl` sem credencial/expirada/adulterada → 401; com credencial válida → 200 com identidade (quickstart US4).

### Implementation

- [x] T011 [P] [US4] Criar `AuthModule` do API-MS em `services/api/src/common/auth/auth.module.ts` provendo `KeycloakTokenVerifier` (de `@finance/auth`) com `KEYCLOAK_URL`/`KEYCLOAK_REALM`
- [x] T012 [US4] Implementar `JwtAuthGuard` global (`APP_GUARD`) em `services/api/src/common/auth/jwt-auth.guard.ts`: extrai Bearer, verifica via `TokenVerifier`, popula `req.user` com `toAuthenticatedUser` (id = keycloakUserId, research R7); decorator `@Public()` em `services/api/src/common/auth/public.decorator.ts`; marcar health como `@Public()`
- [x] T013 [P] [US4] Criar decorator `@CurrentUser()` em `services/api/src/common/auth/current-user.decorator.ts`
- [x] T014 [US4] Implementar `SessionAuthGuard` do BFF em `services/bff/src/auth/guards/session-auth.guard.ts`: cookie → sessão → inatividade 30 min (`SESSION_EXPIRED`) → refresh se access expira <60s (research R4) → `req.user`; decorator `@Public()` + `@CurrentUser()` em `services/bff/src/auth/decorators/`
- [x] T015 [P] [US4] Testes do `JwtAuthGuard` em `services/api/src/common/auth/jwt-auth.guard.spec.ts` (fake verifier: sem header, token inválido, token válido, rota @Public)
- [x] T016 [P] [US4] Testes do `SessionAuthGuard` em `services/bff/src/auth/guards/session-auth.guard.spec.ts` (fakes: sem cookie, cookie adulterado, sessão inexistente, inatividade >30min, refresh falho, caminho feliz)

**Checkpoint**: Backends rejeitam tudo sem credencial válida (SC-003)

---

## Phase 4: User Story 1 - Login com redirecionamento (Priority: P1) 🎯 MVP

**Goal**: Não logado → Keycloak → volta autenticado à rota original.

**Independent Test**: Quickstart US1 (aba anônima, deep-link preservado, credencial inválida fica no Keycloak).

### Implementation

- [x] T017 [US1] Implementar `AuthService` OIDC em `services/bff/src/auth/auth.service.ts` com `openid-client` v6: discovery lazy com timeout 5s, authorization URL (state+nonce+PKCE S256), registro efêmero de state/returnTo TTL 10 min, token exchange, refresh, build de RP-logout URL (research R1/R2/R9)
- [x] T018 [US1] Implementar `AuthController` em `services/bff/src/auth/auth.controller.ts`: `GET /auth/login` (validação `returnTo`: path relativo, sem `//`/esquema — FR-012), `GET /auth/callback` (state/nonce/error handling → cria sessão + cookie + redirect `WEB_URL+returnTo`; falhas → `auth/error?reason=...`), `GET /auth/me` (retorna `SessionUser` dos claims — contracts/bff-auth-api.md); registrar `AuthModule` em `services/bff/src/app.module.ts` com `SessionAuthGuard` global e `@Public()` em login/callback/health
- [x] T019 [P] [US1] Testes do `AuthService`/controller em `services/bff/src/auth/auth.service.spec.ts` e `auth.controller.spec.ts` (fakes OIDC: callback ok, state inválido, error do provedor, returnTo malicioso rejeitado, provider indisponível → redirect de erro)
- [x] T020 [US1] Criar `apps/web/middleware.ts`: rotas protegidas sem cookie `finance_session` → redirect 307 `${NEXT_PUBLIC_BFF_URL}/auth/login?returnTo=<pathname+search>`; exceções `/auth/error`, `_next`, assets (contracts/frontend-auth.md)
- [x] T021 [P] [US1] Implementar `apps/web/services/auth-api.ts` (`getMe()`, `logout()` com `credentials: 'include'` + parse Zod `sessionUserSchema`) e hook `useSession()` em `apps/web/features/auth/use-session.ts` (TanStack Query `['auth','me']`, staleTime 5min, refetchOnWindowFocus, 401 → redirect login com returnTo)
- [x] T022 [P] [US1] Criar página pública de erro `apps/web/app/auth/error/page.tsx` com mensagens por `reason` (`provider_unavailable`, `invalid_callback`, genérica) + botão "Tentar novamente" sem redirect automático (FR-013)
- [x] T023 [P] [US1] Testes web em `apps/web/features/auth/use-session.spec.ts` (200 parse ok, 401 redireciona, payload inválido → erro)

**Checkpoint**: Login E2E funcional (SC-001, SC-002) — MVP

---

## Phase 5: User Story 2 - Menu lateral e header (Priority: P2)

**Goal**: Shell autenticado com sidebar (6 itens, colapso, responsivo) e header (usuário + sair).

**Independent Test**: Quickstart US2 (itens, ativo, colapso persistente na navegação, overlay mobile 375px).

### Implementation

- [x] T024 [P] [US2] Estender `apps/web/store/ui-slice.ts` com `sidebarMobileOpen` + actions (`toggleSidebarMobile`, `closeSidebarMobile`) + testes em `apps/web/store/ui-slice.spec.ts`
- [x] T025 [P] [US2] Criar constante de navegação em `apps/web/features/navigation/nav-items.ts` (6 itens — data-model §6)
- [x] T026 [US2] Implementar `Sidebar` em `apps/web/components/sidebar.tsx`: itens com ícones, ativo via `usePathname()` + `aria-current="page"`, colapso via Redux `sidebarOpen`, overlay mobile <768px com fechamento em navegação/Escape, `<nav aria-label="Menu principal">` (contracts/frontend-auth.md)
- [x] T027 [US2] Implementar `Header` em `apps/web/components/header.tsx`: nome/e-mail via `useSession()` (skeleton no loading), botão "Sair", hamburger mobile
- [x] T028 [US2] Criar grupo autenticado `apps/web/app/(app)/layout.tsx` (Sidebar + Header + main) e mover/criar páginas placeholder: `apps/web/app/(app)/page.tsx` (Visão Geral), `contas/page.tsx`, `transacoes/page.tsx`, `cartoes/page.tsx`, `orcamentos/page.tsx`, `metas/page.tsx`
- [x] T029 [P] [US2] Testes de `Sidebar`/`Header` em `apps/web/components/sidebar.spec.tsx` e `header.spec.tsx` (item ativo, colapso, aria, skeleton/nome do usuário)

**Checkpoint**: Shell completo pós-login (SC-004, SC-007)

---

## Phase 6: User Story 3 - Logout e encerramento de sessão (Priority: P2)

**Goal**: "Sair" encerra sessão no app e no Keycloak.

**Independent Test**: Quickstart US3 (logout, novo acesso exige login, multi-abas).

### Implementation

- [x] T030 [US3] Implementar `POST /auth/logout` no `AuthController` (`services/bff/src/auth/auth.controller.ts`): destrói sessão, limpa cookie, retorna `{logoutUrl}` com `id_token_hint` + `post_logout_redirect_uri=WEB_URL` (research R6); tolerante a sessão já inválida
- [x] T031 [US3] Ligar botão "Sair" do `Header` ao `logout()` de `apps/web/services/auth-api.ts` (POST → navegar `logoutUrl`; nula → `/`)
- [x] T032 [P] [US3] Testes de logout em `services/bff/src/auth/auth.controller.spec.ts` (sessão destruída, cookie limpo, logoutUrl correta, sessão inválida → 200)

**Checkpoint**: Ciclo completo login→uso→logout (SC-005)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T033 [P] Escrever ADR-010 em `docs/decisions/ADR-010-bff-session-auth.md` (sessão server-side no BFF, id=keycloakUserId provisório — research R3/R7)
- [x] T034 [P] Atualizar `docs/domains/` ou `docs/agents/backend.md` com fluxo de auth e envs novos; atualizar `.env.example`/README de setup se existirem
- [x] T035 Executar validação completa do `specs/001-app-shell-keycloak-login/quickstart.md` (US1–US4 + edge cases: callback direto, Keycloak parado, inatividade, ausência de tokens no browser)
- [x] T036 Rodar `pnpm lint && pnpm typecheck && pnpm test && pnpm build` e corrigir pendências

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US4) → Phase 4 (US1)**: sequência obrigatória (guard de sessão é pré-requisito do fluxo de login; controller usa guard)
- **Phase 5 (US2)**: depende de US1 (useSession) — pode começar T024/T025 em paralelo a US1
- **Phase 6 (US3)**: depende de US1 (sessão existente) e toca Header (US2 T027); executar após ambos
- **Phase 7**: após tudo

### Parallel Opportunities

- Phase 1: T002 ∥ T003 (pacotes distintos)
- Phase 3: T011 ∥ T013; T015 ∥ T016 (arquivos distintos, api vs bff)
- Phase 4: T019 ∥ T021 ∥ T022 ∥ T023 após T017/T018/T020
- Phase 5: T024 ∥ T025; T029 após componentes
- US2 (web puro) pode andar em paralelo com US4/US1 backend por devs distintos (mock de useSession até US1 pronto)

## Implementation Strategy

**MVP** = Phases 1–4 (Setup + Foundational + US4 + US1): login E2E com backend validado. Parar, validar quickstart US1/US4, então US2 → US3 → Polish.
