# Contract: BFF Auth API (`services/bff`)

Base: `http://localhost:3002` (dev). Todas as respostas JSON exceto redirects. CORS: `WEB_URL` com `credentials: true`.

## GET /auth/login

Inicia fluxo OIDC.

| Query | Tipo | Validação |
|---|---|---|
| `returnTo` | string? | path relativo iniciando com `/`, sem `//` nem esquema; inválido → ignorado (usa `/`) |

**Respostas**:
- `302` → Keycloak authorization endpoint (com `state`, `nonce`, PKCE S256). `state` guarda `returnTo` server-side (registro efêmero, TTL 10 min).
- `302` → `${WEB_URL}/auth/error?reason=provider_unavailable` se discovery/Keycloak fora.

## GET /auth/callback

Retorno do Keycloak.

| Query | Validação |
|---|---|
| `code`, `state` | `state` deve existir e não estar consumido; `code` trocado por tokens com PKCE verifier; ID token verificado (assinatura/issuer/audience/nonce) |
| `error` | presença → fluxo abortado |

**Efeitos (sucesso)**: cria linha em `sessions`, seta cookie `finance_session`, consome `state`.

**Respostas**:
- `302` → `${WEB_URL}${returnTo}` (sucesso)
- `302` → `${WEB_URL}/auth/error?reason=invalid_callback` (state desconhecido/consumido, nonce inválido, error do Keycloak, acesso direto)
- `302` → `${WEB_URL}/auth/error?reason=provider_unavailable` (token endpoint fora)

## GET /auth/me

Sessão atual. Protegido por `SessionAuthGuard`.

**Respostas**:
- `200` `SessionUser` (`sessionUserSchema` de `@finance/contracts`):
  ```json
  { "id": "kc-uuid", "name": "Maria Silva", "email": "maria@ex.com", "roles": ["user"] }
  ```
- `401` `{ "code": "UNAUTHENTICATED" }` — sem cookie / sessão inexistente
- `401` `{ "code": "SESSION_EXPIRED" }` — inatividade > 30 min ou refresh falhou (cookie limpo na resposta)

**Efeitos colaterais**: atualiza `lastActivityAt`; refresh do access token se expira < 60s.

## POST /auth/logout

Protegido por `SessionAuthGuard` (sessão inválida → ainda responde 200 com `logoutUrl` nula e limpa cookie).

**Respostas**:
- `200` `{ "logoutUrl": "https://<keycloak>/realms/finance/protocol/openid-connect/logout?id_token_hint=...&post_logout_redirect_uri=<WEB_URL>" }`

**Efeitos**: remove linha de `sessions`, limpa cookie. Frontend navega para `logoutUrl`.

## Regras transversais

- `SessionAuthGuard`: aplica-se a toda rota do BFF exceto `@Public()` (health, /auth/login, /auth/callback).
- Proxy a API-MS (futuro): BFF injeta `Authorization: Bearer <accessToken da sessão>`.
- Nunca logar: tokens, cookie, `code`, `state`.
- Erros seguem envelope `{ code: string, message?: string }`; mensagens sem dados sensíveis.
