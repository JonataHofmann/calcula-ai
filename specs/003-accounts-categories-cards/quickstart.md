# Quickstart — Validação: Cadastros (Contas, Categorias, Cartões)

Guia de validação end-to-end da feature. Não contém implementação — apenas como provar que funciona.

## Pré-requisitos

- Dependências instaladas: `pnpm install` (após adicionar `motion`, `react-hook-form`, `@hookform/resolvers` — ver research R5/Dependências).
- Infra local: `docker compose up -d` (PostgreSQL 17 + Keycloak 26.1).
- Migrations aplicadas (inclui seed de categorias padrão).
- Feature 001 (login BFF/sessão) e 002 (design system) operacionais.

## Subir o ambiente

```bash
pnpm install
docker compose up -d
pnpm --filter @finance/api migration:run   # cria tabelas + seed de categorias padrão
pnpm dev                                    # web + bff + api
```

Autenticar via login (feature 001) antes de acessar os cadastros.

## Cenários de validação

### 1. Contas (US1)
1. Acesse `/contas`. Sem contas → estado vazio com CTA "Nova conta".
2. Clique "Nova conta" → **popup** abre com transição animada; campos: nome, seletor de banco, seletor de ícone (grade ampla), seletor de cor.
3. Preencha e salve → popup fecha animado; conta aparece como **card** com ícone/cor/banco escolhidos.
4. Editar → popup pré-preenchido; salvar reflete no card em < 1s.
5. Excluir → card sai da lista com animação.
6. Nome vazio → validação bloqueia o envio.
- **Esperado**: FR-001..006, FR-018..020, FR-022; SC-001, SC-005, SC-006.

### 2. Isolamento entre usuários
1. Usuário A cria contas/categorias/cartões.
2. Faça login como usuário B → não vê nada de A; cria os próprios.
- **Esperado**: FR-021; SC-003. (Chamar `GET /accounts` com sessão de B nunca retorna recursos de A; `:id` de A → 404.)

### 3. Categorias — padrão, ocultar, restaurar, override (US2)
1. Novo usuário acessa `/categorias` → vê categorias **padrão** agrupadas por **despesa/receita**, com ícone/cor.
2. Ocultar uma padrão → some para este usuário. Logar como outro usuário → ela continua lá (isolamento). Restaurar → volta.
3. Editar uma categoria **padrão** (nome/cor) → aplica **override** pessoal; outro usuário não é afetado; ação "reverter ao original" remove o override.
4. Criar categoria **personalizada** via popup (nome, tipo, ícone, cor).
5. Adicionar subcategoria a uma categoria; adicionar **sub-subcategoria** a essa subcategoria → hierarquia **recursiva** exibida.
6. Editar/excluir personalizada → afeta só o próprio conjunto (subárvore removida em cascata).
- **Esperado**: FR-007..013, FR-010a; SC-002, SC-004.

### 4. Cartões de crédito (US3)
1. Acesse `/cartoes`. Sem cartões → estado vazio.
2. "Novo cartão" → popup: nome, últimos 4 dígitos, dia de vencimento, dia de fechamento, limite, bandeira.
3. Tentar `lastDigits` não-numérico / com ≠4 dígitos → bloqueado. Dias fora de 1–31 → bloqueado. Limite negativo → bloqueado.
4. Salvar válido → **card visual** simulando cartão (bandeira, nome, 4 dígitos).
5. Editar limite/datas e excluir.
- **Esperado**: FR-014..017; SC-007.

## Referências
- Contratos: [contracts/](./contracts/) (reference, accounts, categories, cards).
- Modelo de dados: [data-model.md](./data-model.md).
- Decisões: [research.md](./research.md).

## Checagem final (Definition of Done do repo)
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Cobertura mínima esperada: unit de use cases (com fakes de repositório), integração dos repositórios TypeORM, e testes de componentes (`packages/ui`: modal, icon-picker, color-picker, bank-select).
