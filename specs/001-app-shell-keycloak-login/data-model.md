# Data Model: App Shell & Keycloak Login

## 1. Session (tabela `sessions` — BFF, PostgreSQL)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | UUID (PK) | gerado no callback; valor referenciado pelo cookie assinado |
| `keycloakUserId` | varchar | `sub` do ID token verificado |
| `encryptedTokens` | text | JSON `{accessToken, refreshToken, idToken, accessTokenExpiresAt}` cifrado AES-256-GCM com chave derivada de `SESSION_SECRET`; NUNCA em claro, NUNCA logado |
| `createdAt` | timestamptz | — |
| `lastActivityAt` | timestamptz | atualizado com throttle de 60s |
| `expiresAt` | timestamptz | teto absoluto (= expiração do refresh token / SSO Session Max) |

**Ciclo de vida**:

```
(callback ok) → ACTIVE
ACTIVE → ACTIVE            [request autenticada; lastActivityAt atualizado; refresh se access expira <60s]
ACTIVE → DESTROYED         [logout | inatividade >30min | refresh falhou | expiresAt atingido]
DESTROYED → (cookie limpo, linha removida)
```

**Invariantes**:
- Sessão sem refresh token válido não sobrevive (destruída no próximo uso).
- Uma sessão por login (novo login = nova linha; linhas órfãs limpas por job/oportunisticamente).

## 2. Cookie `finance_session`

| Atributo | Valor |
|---|---|
| Conteúdo | `<sessionId>.<hmac>` (assinado com `SESSION_SECRET`) |
| `httpOnly` | true |
| `secure` | true em produção |
| `sameSite` | `lax` |
| `path` | `/` |
| `maxAge` | ausente (session cookie) — expiração real é server-side |

## 3. SessionUser (contrato BFF → web, `packages/contracts/src/auth/session.ts`)

```ts
sessionUserSchema = z.object({
  id: z.string(),          // = keycloakUserId nesta fase (ver research R7 nota)
  name: z.string(),        // claim 'name' | preferred_username
  email: z.string().email().optional(),
  roles: z.array(z.string()),
})
```

Derivado exclusivamente dos claims do token verificado. Nunca inclui tokens.

## 4. AuthenticatedUser (existente, `packages/contracts`)

`{ id, keycloakUserId, roles }` — usado nos guards do BFF e API-MS via `@CurrentUser()`. Nesta feature `id = keycloakUserId`.

## 5. Estado de UI (web, Redux `ui-slice` — existente, estender)

| Campo | Tipo | Uso |
|---|---|---|
| `sidebarOpen` | boolean | colapso/expansão (existente) |
| `sidebarMobileOpen` | boolean | overlay mobile (novo) |

Dados do usuário NÃO entram no Redux — vêm de `GET /auth/me` via TanStack Query (`['auth','me']`).

## 6. Itens de navegação (constante no web)

```ts
{ label: 'Visão Geral', href: '/' }
{ label: 'Contas', href: '/contas' }
{ label: 'Transações', href: '/transacoes' }
{ label: 'Cartões', href: '/cartoes' }
{ label: 'Orçamentos', href: '/orcamentos' }
{ label: 'Metas', href: '/metas' }
```

Item ativo: `pathname === href` (ou prefixo para sub-rotas futuras).

## 7. Variáveis de ambiente (packages/config — estender)

| Var | Serviço | Regra |
|---|---|---|
| `KEYCLOAK_URL`, `KEYCLOAK_REALM` | BFF, API | obrigatórias quando serviço sobe auth |
| `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` | BFF | confidential client `finance-web` |
| `SESSION_SECRET` | BFF | ≥ 32 chars; assina cookie e cifra tokens |
| `BFF_PUBLIC_URL` | BFF | base do redirect_uri (`/auth/callback`) |
| `WEB_URL` | BFF | destino pós-login/logout; validação de `returnTo` |
