# Contract: Frontend Auth & App Shell (`apps/web`)

## Middleware (`middleware.ts`)

| Regra | Comportamento |
|---|---|
| Matcher | todas as rotas exceto `/auth/error`, `_next/*`, assets |
| Sem cookie `finance_session` | redirect 307 → `${NEXT_PUBLIC_BFF_URL}/auth/login?returnTo=<pathname+search>` |
| Com cookie | segue (validade real decidida pelo BFF via /auth/me) |

## Hook `useSession()` (`features/auth/use-session.ts`)

```ts
useSession(): { user: SessionUser | undefined, isLoading: boolean }
```

- TanStack Query key `['auth','me']`, `GET ${BFF}/auth/me` com `credentials: 'include'`.
- `staleTime` 5 min; `refetchOnWindowFocus: true` (mantém sessão viva + detecta logout de outra aba).
- Resposta 401 → `window.location.assign(`${BFF}/auth/login?returnTo=${pathname}`)`.
- Zod parse com `sessionUserSchema` (`@finance/contracts`) — resposta inválida = erro.

## `logout()` (`services/auth-api.ts`)

1. `POST ${BFF}/auth/logout` (`credentials: 'include'`).
2. `logoutUrl` presente → `window.location.assign(logoutUrl)`; nula → `window.location.assign('/')` (middleware reencaminha ao login).

## Componentes

### `Sidebar` (`components/sidebar.tsx`)

| Prop/estado | Contrato |
|---|---|
| Itens | constante de navegação (6 itens — ver data-model §6) |
| Ativo | `usePathname()`; item ativo com `aria-current="page"` |
| Colapso | `ui-slice.sidebarOpen` (Redux); botão com `aria-expanded` e `aria-label` |
| Mobile (<768px) | overlay via `sidebarMobileOpen`; fecha em navegação e em `Escape` |
| A11y | `<nav aria-label="Menu principal">`; navegável por teclado |

### `Header` (`components/header.tsx`)

| Elemento | Contrato |
|---|---|
| Identificação | `user.name` (+ `email` se disponível) de `useSession()`; skeleton enquanto carrega |
| Logout | botão "Sair" → `logout()` |
| Mobile | botão hamburger → `sidebarMobileOpen` |

### Layout `(app)/layout.tsx`

Compõe `Sidebar` + `Header` + `<main>`. Rotas placeholder: `/` (Visão Geral), `/contas`, `/transacoes`, `/cartoes`, `/orcamentos`, `/metas` — título da seção apenas.

### Página `auth/error/page.tsx` (pública)

| Query `reason` | Mensagem |
|---|---|
| `provider_unavailable` | "Serviço de login indisponível. Tente novamente em instantes." + botão Tentar novamente (→ `/auth/login`) |
| `invalid_callback` | "Não foi possível concluir o login." + botão Tentar novamente |
| outro/ausente | mensagem genérica |

Sem redirect automático (quebra loops — FR-013).

## Env (web)

| Var | Uso |
|---|---|
| `NEXT_PUBLIC_BFF_URL` | base das chamadas auth (`http://localhost:3002` dev) |
