# Quickstart: App Shell & Keycloak Login

Contratos: [contracts/bff-auth-api.md](./contracts/bff-auth-api.md), [contracts/frontend-auth.md](./contracts/frontend-auth.md). Modelo: [data-model.md](./data-model.md).

## Pré-requisitos

```bash
pnpm install
docker compose up -d          # PostgreSQL + Keycloak (realm finance importado)
```

`.env` (dev):

```bash
# services/bff
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=finance
KEYCLOAK_CLIENT_ID=finance-web
KEYCLOAK_CLIENT_SECRET=dev-secret
SESSION_SECRET=<32+ chars aleatórios>   # nunca commitar valor real
BFF_PUBLIC_URL=http://localhost:3002
WEB_URL=http://localhost:3000
DATABASE_URL=postgres://finance:finance@localhost:5432/finance

# services/api
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=finance

# apps/web
NEXT_PUBLIC_BFF_URL=http://localhost:3002
```

Subir serviços:

```bash
pnpm --filter @finance/bff dev     # :3002
pnpm --filter @finance/api dev     # :3001
pnpm --filter @finance/web dev     # :3000
```

Usuário de teste (realm import): `test@finance.local` / `test1234`.

## Validação por user story

### US1 — Login com redirecionamento (P1)

1. Aba anônima → `http://localhost:3000/transacoes` → deve redirecionar ao Keycloak.
2. Credenciais inválidas → permanece no Keycloak com erro.
3. Credenciais válidas → volta para `http://localhost:3000/transacoes` (deep-link preservado — SC-001/FR-002).
4. Navegar entre rotas protegidas → sem novo login.

### US2 — Menu lateral e header (P2)

1. Logado, verificar sidebar (6 itens, ativo destacado com `aria-current`) e header com nome do usuário.
2. Colapsar sidebar → navegar → estado persiste na sessão.
3. DevTools 375px → sidebar vira overlay; abre/fecha via hamburger e `Escape`.

### US3 — Logout (P2)

1. Clicar "Sair" → retorna ao fluxo de login (Keycloak encerrado — abrir `http://localhost:8080/realms/finance/account` deve pedir login).
2. Voltar a `http://localhost:3000/` → exige login (SC-005).
3. Duas abas logadas → logout na aba A → focar aba B → redireciona ao login.

### US4 — Validação backend (P1)

```bash
# Sem credencial → 401
curl -i http://localhost:3002/auth/me
curl -i http://localhost:3001/<qualquer-rota-protegida>

# Token adulterado → 401
curl -i http://localhost:3001/<rota> -H "Authorization: Bearer abc.def.ghi"

# Cookie válido → 200 com identidade
# (copiar cookie finance_session do browser logado)
curl -i http://localhost:3002/auth/me -H "Cookie: finance_session=<valor>"
```

Esperado: 401 `UNAUTHENTICATED`/`SESSION_EXPIRED` nos inválidos; 200 `SessionUser` no válido (SC-003).

### Edge cases

1. `http://localhost:3002/auth/callback` direto → redirect a `/auth/error?reason=invalid_callback`, sem loop.
2. `docker compose stop keycloak` → acessar app deslogado → página de erro amigável (`provider_unavailable`), sem loop (SC-006).
3. Inatividade: reduzir janela p/ 1 min via env de teste → esperar → próxima ação exige login (SC-009 da spec 001 = FR-016).
4. Tokens no browser: DevTools → Application → sem tokens em localStorage/sessionStorage; só cookie `finance_session` httpOnly (SC-008).

## Testes e regressão

```bash
pnpm turbo run test --filter=@finance/bff      # guard, auth.service (fakes p/ OIDC/store), validação returnTo
pnpm turbo run test --filter=@finance/api      # JwtAuthGuard (fake TokenVerifier)
pnpm turbo run test --filter=@finance/web      # middleware, useSession, Sidebar/Header
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Esperado: tudo verde. Migração da tabela `sessions` incluída e aplicada (`docs/agents/database.md`).
