# Research: App Shell & Keycloak Login

## R1. Padrão de fluxo OIDC: BFF confidential client

**Decision**: Authorization Code + PKCE conduzido pelo BFF como confidential client (`finance-web` passa a `publicClient: false` com secret). Endpoints no BFF: `GET /auth/login` (redirect ao Keycloak com `state`+`nonce`+PKCE), `GET /auth/callback` (troca code→tokens, cria sessão, seta cookie, redirect ao web), `POST /auth/logout`, `GET /auth/me`.

**Rationale**: Clarificação da spec (sessão 2026-08-17): tokens só no servidor, browser recebe cookie httpOnly. BFF já é o lugar declarado para "auth context" (AGENTS.md). PKCE mesmo em confidential client é hardening recomendado (OAuth 2.1).

**Alternatives considered**:
- SPA pública + PKCE (rejeitada na clarificação — tokens no browser).
- Auth no próprio Next.js (route handlers + next-auth/auth.js) — colocaria estado de auth no web e duplicaria verificação; BFF já existe exatamente para isso.

## R2. Biblioteca OIDC no BFF

**Decision**: `openid-client` v6 (openid-certified) para discovery, authorization URL, token exchange, refresh e RP-initiated logout URL.

**Rationale**: Certificada OpenID Foundation; API v6 funcional e tree-shakeable; evita implementar troca de code, validação de `state`/`nonce` e refresh à mão. `jose` continua em `packages/auth` para verificação de JWT no API-MS.

**Alternatives considered**: `keycloak-connect` (deprecated pela Red Hat), implementação manual com `jose` (mais superfície de erro), `passport` + strategy (camada extra sem ganho).

## R3. Armazenamento de sessão

**Decision**: Tabela `sessions` no PostgreSQL do BFF via TypeORM (BFF ganha dependência `@nestjs/typeorm` + `pg`): `id` (UUID, valor do cookie assinado), `keycloakUserId`, `encryptedTokens` (AES-256-GCM com `SESSION_SECRET`), `createdAt`, `lastActivityAt`, `expiresAt`. Cookie: `finance_session`, httpOnly, `sameSite=lax`, `secure` em produção, assinado (HMAC).

**Rationale**: Sobrevive a restart do BFF; permite expiração por inatividade server-side (30 min — FR-016) e revogação no logout; PostgreSQL já está no stack (sem Redis novo — regra 8). `sameSite=lax` permite o redirect do Keycloak no callback e protege contra CSRF em POST.

**Alternatives considered**:
- Sessão em memória — perde sessões a cada deploy/restart.
- Redis — infra nova sem necessidade atual (regra 8).
- Cookie stateless com tokens cifrados — >4KB com tokens Keycloak; sem revogação server-side.

## R4. Renovação silenciosa + inatividade 30 min

**Decision**: No `SessionAuthGuard` do BFF, a cada requisição autenticada:
1. Se `lastActivityAt` > 30 min → sessão destruída → 401 `SESSION_EXPIRED`.
2. Se access token expira em < 60s → refresh com refresh token; falha no refresh → destruir sessão → 401.
3. Atualiza `lastActivityAt` (throttle: só grava se > 60s desde a última escrita, evita write por request).

No frontend, `use-session.ts` (TanStack Query, `staleTime` 5 min, `refetchOnWindowFocus`) mantém sessão viva durante uso; resposta 401 de qualquer chamada → redirect `/auth/login?returnTo=<rota atual>`.

**Rationale**: FR-011 + FR-016. Refresh no servidor mantém tokens fora do browser. Inatividade medida no servidor (fonte de verdade), não no cliente.

**Alternatives considered**: Timer de refresh no cliente (desnecessário — cliente não tem token); Keycloak SSO Session Idle apenas (não cobre política de 30 min da aplicação de forma independente).

## R5. Proteção de rotas no Next.js

**Decision**: `apps/web/middleware.ts`: rotas do grupo `(app)` sem cookie `finance_session` → redirect 307 para `${BFF}/auth/login?returnTo=<pathname>`. Validação real da sessão acontece no `GET /auth/me` (server é a autoridade); middleware é só gate de UX (evita flash de conteúdo). `returnTo` validado no BFF: apenas paths relativos (`/...`), rejeita URLs absolutas (open redirect — FR-012).

**Rationale**: FR-001/FR-002/FR-015. Middleware Next não deve chamar rede a cada request (latência); presença de cookie é heurística barata, backend decide de verdade.

**Alternatives considered**: Validação completa da sessão no middleware via fetch ao BFF — latência em toda navegação; Server Components chamando BFF por página — repetitivo, middleware centraliza.

## R6. Logout

**Decision**: `POST /auth/logout` no BFF: destrói sessão local, limpa cookie e responde com URL de RP-initiated logout do Keycloak (`end_session_endpoint` + `id_token_hint` + `post_logout_redirect_uri=<WEB_URL>`); frontend faz `window.location.href = url`. Multi-abas: outras abas detectam 401 no próximo `GET /auth/me` (refetch on focus) e redirecionam.

**Rationale**: FR-007 — encerra app + Keycloak. `id_token_hint` evita tela de confirmação do Keycloak. POST (não GET) previne logout via CSRF de imagem/link.

**Alternatives considered**: Front-channel/back-channel logout — complexidade de SSO multi-app desnecessária com um único app web.

## R7. Validação no API-MS

**Decision**: `JwtAuthGuard` global (`APP_GUARD`) no API-MS usando `KeycloakTokenVerifier` de `packages/auth` (issuer/audience de env), com decorator `@Public()` para health/swagger. BFF repassa `Authorization: Bearer <access_token>` da sessão ao chamar o API-MS. `@CurrentUser()` injeta `AuthenticatedUser` mapeado via `toAuthenticatedUser`.

**Rationale**: FR-008/FR-009/FR-010 e regra 2. Infra de verificação já existe em `packages/auth` (jose + JWKS remoto com cache). Guard global = seguro por padrão (rota nova nasce protegida).

**Alternatives considered**: Guard por controller (risco de esquecer); introspecção de token no Keycloak (latência por request; JWT assinado dispensa).

**Nota (mapeamento de usuário local)**: `toAuthenticatedUser` exige `localUserId`; sem módulo de usuários ainda, nesta feature `id = keycloakUserId` (provisionamento local vira feature futura; decisão registrada no ADR-010).

## R8. Realm Keycloak

**Decision**: Atualizar `docker/keycloak/realm.json`: `finance-web` → `publicClient: false`, `secret` via placeholder de env (`KC_FINANCE_WEB_SECRET`, default dev `dev-secret`), `redirectUris: ["http://localhost:3002/auth/callback"]`, `webOrigins` removido do fluxo (BFF é server-side), `attributes.post.logout.redirect.uris: "http://localhost:3000/*"`. Usuário de teste dev (`test@finance.local` / senha dev) adicionado ao realm import.

**Rationale**: Callback agora aterrissa no BFF (porta 3002), não no web. Usuário seed viabiliza teste E2E do quickstart.

**Alternatives considered**: Novo client `finance-bff` separado mantendo `finance-web` público — client público ficaria órfão/ambíguo; um client confidential único é mais simples.

## R9. Indisponibilidade do provedor / callback inválido

**Decision**: BFF: discovery OIDC com retry lazy + timeout 5s; falha em `/auth/login` → redirect `WEB_URL/auth/error?reason=provider_unavailable`. Callback com `state` desconhecido/`error` do Keycloak → `auth/error?reason=invalid_callback` (sem loop: página de erro é rota pública com botão "Tentar novamente"). Acesso direto a `/auth/callback` sem fluxo → mesmo tratamento.

**Rationale**: FR-013, edge cases da spec (loop de redirect, callback adulterado, acesso direto). Página de erro pública quebra qualquer ciclo de redirecionamento.

**Alternatives considered**: Retry automático com backoff no browser — mascara o problema e arrisca loop.

## R10. App shell (sidebar + header)

**Decision**: `Sidebar` e `Header` em `apps/web/components/` (não em `packages/ui` — contêm navegação/estado específicos do app; itens genéricos visuais podem migrar depois com a feature 002). Colapso via `ui-slice.sidebarOpen` (Redux, já existe). Item ativo via `usePathname()`. Responsivo: < 768px sidebar vira overlay (estado no mesmo slice). Header consome `use-session.ts` para nome/e-mail.

**Rationale**: Regra "generic components only" em `packages/ui`; sidebar com rotas do produto é feature-specific. Redux para client state puro (regra 5).

**Alternatives considered**: Shell em `packages/ui` — violaria a fronteira genérico/feature; estado de colapso em localStorage puro — Redux já modela e persistência pode ser adicionada trivialmente.
