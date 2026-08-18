# Quickstart: Transações

**Feature**: `004-transactions` | **Date**: 2026-08-17

Guia de validação end-to-end. Detalhes de campos em [data-model.md](./data-model.md) e [contracts/transactions-api.md](./contracts/transactions-api.md).

## Pré-requisitos

- `docker compose up` (PostgreSQL 17 + Keycloak 26.1).
- Migration `create-transactions-table` aplicada (`pnpm --filter @finance/api migration:run`).
- API-MS, BFF e web rodando (`pnpm dev`), usuário autenticado (sessão via BFF).
- Ao menos uma categoria de despesa, uma de receita, uma conta e um cartão do usuário (feature 003).

## Cenário 1 — Registrar despesa avulsa (US1, SC-001)

1. Tela **Transações** → botão "Nova" abre o popup.
2. Preencher despesa `single` com **conta**, categoria de despesa, valor `89.90`, vencimento no mês corrente → Confirmar.
3. **Esperado**: linha aparece na tabela do mês com `status = pending`, origem = conta. Selecionar **cartão** em vez de conta também é aceito.
4. **Negativo**: sem conta e sem cartão (ou ambos) → erro de validação no popup; receita vinculada a cartão → recusada.

## Cenário 2 — Efetivar pendente (US2, SC-003)

1. Na linha pendente, clicar **Efetivar** → popup com `data = hoje` e `valor = previsto`.
2. Confirmar sem alterar → linha vira `paid`, `effectiveDate = hoje`, `effectiveAmount = amount` (previsto preservado).
3. Alterar o valor e confirmar → `paid` com `effectiveAmount` informado; `amount` original intacto.
4. **Negativo**: tentar efetivar uma já `paid` → ação bloqueada/indisponível (409).

## Cenário 3 — Parcelada 3x (US3, SC-002)

1. Nova transação `installment`, `installmentCount = 3`, `totalAmount = 100.00`.
2. **Esperado**: 3 linhas, mesmo `groupId`, `installmentNumber` 1/2/3, vencimentos mensais consecutivos, valores `33.33`/`33.33`/`33.34` (soma = `100.00`, ajuste na última — R2).
3. Alternativa: informar `amount = 100.00` por parcela → total exibido `300.00`, 3 linhas de `100.00`.

## Cenário 4 — Fixa e materialização na efetivação (US3)

1. Nova transação `fixed` sem `endDate`, vencimento no mês corrente → 1 linha `pending`.
2. Efetivar a ocorrência → vira `paid` e **surge** a próxima `pending` (mês seguinte, mesmo `groupId`).
3. Com `endDate` definido: quando a próxima ultrapassaria `endDate`, **nenhuma** nova ocorrência é gerada (FR-014).

## Cenário 5 — Escopo de grupo (US3, inclui pagas)

1. Numa ocorrência de grupo, editar/excluir → modal pergunta escopo (só esta / esta e futuras / todas).
2. **Esperado**: a operação atinge exatamente o intervalo escolhido, **incluindo linhas já `paid`**; ao editar, os campos das pagas mudam mas `status`/`effectiveDate`/`effectiveAmount` são preservados (R3).

## Cenário 6 — Filtros, ordenação e mês (US4, SC-005)

1. Navegar entre meses (anterior/próximo) → tabela mostra só as transações com `dueDate` no mês selecionado.
2. Aplicar filtros isolados e combinados (busca, intervalo de vencimento, valor "contém", recorrência, tipo, categoria, conta, cartão) → conjunto exibido bate com os critérios.
3. Clicar no cabeçalho de uma coluna → ordenação alterna asc/desc.

## Cenário 7 — Pendentes de meses anteriores (US5, SC-006)

1. Ter uma pendente vencida em mês anterior; ativar "mostrar despesas pendentes dos meses anteriores".
2. **Esperado**: grid acima da tabela lista as atrasadas; ao efetivar uma, ela some do grid; sem atrasados → estado vazio.

## Cenário 8 — Isolamento por usuário (SC-004)

1. Tentar acessar/editar/excluir/efetivar transação de outro usuário, ou referenciar categoria/conta/cartão de outro usuário → **404** (FR-022). Nenhum vazamento entre usuários.

## Testes automatizados (mapa)

- **api (Jest, unit)**: `recurrence.ts` (split de centavos R2, `addMonthClamped` R8); `Transaction` (invariantes R7, `effectuate` R6/R10); use cases com fakes de repositório + lookups (escopo de grupo R3, criação eager R1, atrasados R5).
- **api (Jest, integração env-gated)**: repositório `find` (filtros/ordenação/intervalo), `findOverdue`, `createMany` atômico, `deleteGroup` idempotente.
- **bff (Jest)**: proxy repassa query/`scope`/`Idempotency-Key` e escopa por sessão; sem regra financeira.
- **web (Vitest + Testing Library)**: popup form (origem por tipo, modos de parcela), tabela (ordenação por cabeçalho), navegação de mês, grid de atrasados, popup de efetivação (defaults hoje/previsto).
