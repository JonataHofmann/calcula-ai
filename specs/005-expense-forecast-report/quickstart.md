# Quickstart: Relatório de Previsão de Despesas

## Pré-requisitos

- Backend (`services/api`) e frontend (`apps/web`) rodando localmente (`pnpm dev` na raiz, ou `pnpm --filter api dev` + `pnpm --filter web dev`).
- Usuário autenticado com pelo menos:
  - 1 transação `installment` em aberto (ex.: 36x) — cobre US1/cenário 1.
  - 1 transação `fixed` sem `endDate` (ex.: aluguel) — cobre US1/cenário 3.
  - 1 transação `fixed` com `endDate` dentro do horizonte a ser testado — cobre US1/cenário 4.

## Validar US1 — tabela mês-a-mês

1. Abrir o relatório de previsão de despesas.
2. Conferir que a coluna "mes 1" corresponde ao mês atualmente selecionado no filtro global de período.
3. Conferir que a linha do parcelamento mostra descrição + contagem (ex. "carro (36x)") e valores nas colunas dentro do intervalo de parcelas restantes, "-" fora dele (contrato: ver `contracts/forecast.md`, `cells[].amount`).
4. Conferir que a linha de despesa fixa sem `endDate` mostra o mesmo valor em todas as colunas exibidas.
5. Conferir que a despesa fixa com `endDate` mostra "-" nas colunas após o término.
6. Conferir a linha de total ao final, somando cada coluna (validar manualmente contra os valores das linhas — SC-003).
7. Logar com um segundo usuário e confirmar que ele não vê os compromissos do primeiro (FR-009).

## Validar US2 — horizonte de meses

1. Abrir o filtro de horizonte e confirmar que existem exatamente as opções 1, 3, 6, 12, 24, 36 (FR-006).
2. Selecionar "3" e confirmar que a tabela passa a ter exatamente 3 colunas, mês 1 inalterado (FR-007).
3. Trocar de tela e voltar ao relatório — confirmar que o horizonte escolhido permanece (dentro da mesma sessão, ver Assumptions do spec).
4. Mudar o mês no filtro global de período — confirmar que o mês 1 do relatório muda de acordo, preservando o horizonte já selecionado (FR-008).

## Validar estado vazio

1. Com um usuário sem nenhum `installment`/`fixed` cadastrado, abrir o relatório e confirmar uma mensagem de estado vazio clara (FR-011, SC-004) — nunca uma tabela em branco ambígua.

## Verificação automatizada (referência, não exaustiva)

- Backend: `pnpm --filter api test -- get-forecast` (novo use-case, Jest) — cobrir especialmente a projeção de `fixed` além da última ocorrência persistida (o caso que uma query ingênua de intervalo de datas erraria, ver `research.md`).
- Frontend: `pnpm --filter web test -- forecast` (Vitest) — cobrir renderização de células nulas ("-"), soma da linha de total, e troca de horizonte sem reload (SC-002).
