# Phase 0 Research: Relatório de Previsão de Despesas

## Decision: Como obter os valores futuros de `installment` vs `fixed`

**Decision**: Tratar as duas recorrências de forma assimétrica na projeção:
- `installment`: todas as parcelas já existem como linhas no banco (uma por parcela, mesmo `groupId`, cada uma com seu `dueDate`/`installmentNumber`). Basta consultar por `groupId` (ou por uma janela `dueFrom`/`dueTo` cobrindo todo o horizonte) e mapear cada parcela existente para a coluna do mês correspondente.
- `fixed`: apenas UMA ocorrência pendente existe por vez no banco (a próxima só é materializada quando a atual é efetivada, via `EffectuateTransactionUseCase.materializeNext`). Os meses futuros além da ocorrência já persistida NÃO existem como linhas — devem ser **projetados em memória**, reaproveitando os helpers puros já existentes `addMonthClamped` e `nextOccurrence` (`services/api/src/modules/transactions/domain/recurrence.ts`), a partir da última ocorrência conhecida daquele grupo, respeitando `endDate` quando presente.

**Rationale**: Confirmado lendo `effectuate-transaction.ts` — `materializeNext()` só cria a próxima linha de `fixed` no momento da efetivação da atual. Uma consulta ingênua por intervalo de datas amplo no repositório retornaria corretamente todas as parcelas de `installment`, mas mostraria **apenas 1 mês** de cada despesa fixa (a única linha pendente existente), o que violaria FR-004 (valor projetado por mês) para qualquer horizonte > 1 mês.

**Alternatives considered**:
- Pré-materializar todas as ocorrências futuras de `fixed` no banco ao gerar o relatório: rejeitado — muda comportamento/dados existentes (violaria a restrição "não altere lógica de dados nesta passada" herdada do projeto, e criaria linhas fantasmas que poderiam divergir se o valor for reajustado antes da efetivação real).
- Job assíncrono que materializa N meses à frente de despesas fixas periodicamente: rejeitado — escopo maior que o necessário, introduz estado persistido novo não pedido pela spec (que descreve o horizonte como preferência de exibição, não como necessidade de dado persistido).

## Decision: Como calcular a janela de meses (horizonte) a partir do filtro global

**Decision**: Introduzir uma nova função pura no frontend (ou reaproveitar/estender `period-slice.ts`) que, dado `{ year, month }` do filtro global e um `horizonMonths` (1/3/6/12/24/36), gera a lista ordenada de `{ year, month }` para cada coluna, e no backend uma query que aceita `from` (mês 1, âncora) e `months` (horizonte) e devolve os dados já agrupados por linha × mês.

**Rationale**: `periodWindow()` atual só resolve UM mês/intervalo por vez; não há necessidade de alterar essa função existente (evita risco de regressão em telas que já a usam) — basta uma nova função de apoio específica do relatório.

**Alternatives considered**: Estender `periodWindow` para aceitar um parâmetro de horizonte — rejeitado para não arriscar comportamento de outras telas que dependem da assinatura/retorno atual.

## Decision: Onde implementar a lógica de agregação

**Decision**: Novo use-case dentro do módulo `transactions` já existente (`services/api/src/modules/transactions/application/use-cases/get-forecast/get-forecast.ts`), seguindo exatamente o padrão de `list-transactions.ts` (injeta `TRANSACTION_REPOSITORY`, recebe `userId` + query tipada). Novo endpoint `GET /transactions/forecast` no `TransactionsController` existente. Novo schema de contrato em `packages/contracts/src/transactions/`.

**Rationale**: Não existe nenhum módulo de "relatórios"/"agregação" no backend — `goals`, `budgets`, `dashboard` no frontend são dados mockados sem contraparte em `services/api/src/modules/`. `transactions` é o único módulo real e já possui tudo que a projeção precisa (domínio, repositório, helpers de recorrência). Criar um módulo novo só para este relatório seria complexidade desnecessária (violaria "no premature abstraction").

**Alternatives considered**: Criar módulo `reports` novo — rejeitado, nenhum outro relatório existe hoje para justificar a divisão; pode ser extraído depois se mais relatórios aparecerem.

## Decision: Convenções de teste

**Decision**: Backend usa Jest (`services/api/jest.config.js`, arquivos `*.spec.ts` colocados ao lado do código, ex. `recurrence.spec.ts`, `list-transactions.spec.ts`). Frontend usa Vitest com arquivos `*.spec.tsx` colocados ao lado do componente (confirmado pelos arquivos já existentes em `apps/web/features/transactions/*.spec.tsx`). O novo use-case e o novo componente de relatório devem seguir essas mesmas convenções.

**Rationale**: Consistência com o resto do repositório; nenhuma decisão nova necessária, apenas seguir o padrão observado.
