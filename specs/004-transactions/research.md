# Phase 0 Research: Transações

**Feature**: `004-transactions` | **Date**: 2026-08-17

Decisões técnicas que resolvem os pontos abertos do Technical Context. Cada item: Decisão / Racional / Alternativas rejeitadas.

## R1 — Materialização da recorrência (installment eager, fixed lazy)

- **Decisão**: `installment` gera **todas as N linhas na criação** (uma escrita atômica, mesmo `groupId`, `installmentNumber` 1..N, `dueDate` + 1 mês por parcela). `fixed` **não pré-gera**: cada ocorrência nasce na efetivação da anterior (materialização lazy), mantendo no máximo uma pendente por vez. `single` gera 1 linha sem `groupId`.
- **Racional**: Alinha FR-011 (parcelas materializadas na criação) e FR-013 (fixa materializada na efetivação, Assumption "uma pendente por vez"). Parcelas materializadas permitem soma/listagem por mês sem cálculo dinâmico; fixa lazy evita arbitrar um horizonte infinito.
- **Alternativas rejeitadas**: parcelas lazy (quebra FR-011 e a agregação mensal); fixa pré-gerada por X meses (arbitra horizonte, infla dados, diverge do pedido); job de materialização (complexidade operacional sem ganho).

## R2 — Split de parcelas com ajuste de centavos

- **Decisão**: `splitInstallments` opera em **centavos inteiros**. Dado `total` (centavos) e `count`: `base = Math.floor(total / count)`; todas as parcelas recebem `base`, e a **última** recebe `total - base * (count - 1)` (absorve o resto). Se o usuário informa `amount` por parcela em vez de total, `total = amountCents * count` e todas as parcelas ficam iguais. Conversão string↔centavos isolada em helper (`toCents`/`fromCents`), nunca `float`.
- **Racional**: SC-002 exige soma das parcelas = total sem diferença de centavos. Inteiro evita erro de ponto flutuante (regra 1). Última parcela absorvendo o resto é o padrão previsível e testável.
- **Alternativas rejeitadas**: distribuir resto na primeira parcela (menos intuitivo no extrato); arredondamento bancário por linha (soma pode não fechar); manipular decimais como `number` (viola regra 1).

## R3 — Escopo de grupo inclui ocorrências pagas

- **Decisão**: `update`/`delete` de uma ocorrência de grupo aceitam `scope ∈ {one, future, all}`. `one` = só a linha alvo. `future` = alvo + posteriores no grupo (`installment`: `installmentNumber >= alvo`; `fixed`: `dueDate >= alvo.dueDate`). `all` = todas as linhas do `groupId`. **O intervalo NÃO pula linhas `paid`** — edita/exclui também as efetivadas (clarificação). Em `update` com escopo, os campos financeiros de efetivação (`status`, `effectiveDate`, `effectiveAmount`) das linhas já pagas são **preservados**; apenas os campos editáveis do formulário mudam.
- **Racional**: Clarificação da sessão 2026-08-17 (Q1/Q2) — escopo alcança pagas; edição de paga preserva os dados da efetivação.
- **Alternativas rejeitadas**: escopo pular pagas (diverge da clarificação); recriar linhas em vez de editar (perde histórico de efetivação e ids estáveis).

## R4 — Datas em UTC; fronteiras de mês calculadas no frontend

- **Decisão**: `dueDate`, `effectiveDate`, `endDate` persistidos como `timestamptz` (instante UTC). A API é **tz-agnóstica**: a listagem filtra por intervalo `dueFrom`/`dueTo` (instantes ISO) que o **frontend** calcula para o mês selecionado no fuso do usuário; "hoje" (default da efetivação) e "antes do mês corrente" (grid de atrasados via `before`) também vêm do cliente.
- **Racional**: Clarificação (Q4) — armazenar em UTC e computar fronteiras no fuso do usuário. Mantém o backend sem lógica de fuso e a listagem correta para qualquer região.
- **Alternativas rejeitadas**: guardar `date` sem fuso (ambiguidade na virada do mês entre fusos); backend assumir um fuso fixo (quebra usuários em outros fusos); calcular mês no servidor a partir do `Accept`/perfil (acopla e complica).

## R5 — Filtro/ordenação/escopo mensal server-side

- **Decisão**: `GET /transactions` recebe query `dueFrom`, `dueTo` (mês), `search` (ILIKE em `description`/`notes` e cast de `amount` para texto), `amount` (ILIKE parcial sobre `amount::text`), `recurrence`, `type`, `categoryId`, `accountId`, `creditCardId`, `sort` (coluna), `order` (asc|desc). Tudo aplicado **no repositório**, escopado por `userId`. Atrasados são um endpoint separado `GET /transactions/overdue?before=<instant>` (`status=pending` e `dueDate < before`). Sem paginação (escopo mensal já limita o volume — clarificação Q3).
- **Racional**: FR-019/FR-020/FR-021 e a clarificação de escopo mensal. Server-side garante correção do filtro/ordem independentemente do que o cliente cacheia; separar atrasados evita misturar dois escopos temporais numa query.
- **Alternativas rejeitadas**: filtrar/ordenar no cliente (correto só se todo o mês estiver carregado; frágil); paginação (descartada pela clarificação — mês por vez); um único endpoint com flag de atrasados (mistura escopos e complica cache do TanStack Query).

## R6 — Valor efetivo como coluna dedicada

- **Decisão**: adicionar `effective_amount numeric(18,2)` (nullable) e `effective_date timestamptz` (nullable). Na efetivação preenche ambos; `amount` (valor previsto) é **preservado**. `effectiveAmount` default = `amount` no popup.
- **Racional**: FR-016 e Assumption "valor efetivo" — guardar o valor pago (que pode diferir do previsto) sem perder o previsto.
- **Alternativas rejeitadas**: sobrescrever `amount` na efetivação (perde o previsto, quebra FR-016); tabela separada de pagamentos (over-engineering para 1:1).

## R7 — Origem exclusiva por tipo (invariante de domínio)

- **Decisão**: invariante no agregado `Transaction`: `type=expense` ⇒ **exatamente um** de `accountId`/`creditCardId` (XOR); `type=income` ⇒ `accountId` obrigatório e `creditCardId` nulo. Reforçado no contrato via `superRefine` do Zod e por `CHECK` na migration como defesa em profundidade. `categoria` deve existir, ser do mesmo `userId` e ter `type` coerente (FR-008).
- **Racional**: FR-006/FR-007/FR-008/FR-023. Invariante no domínio mantém a regra testável sem Nest/PG; contrato dá feedback imediato; CHECK protege contra escrita direta.
- **Alternativas rejeitadas**: validar só no controller (vaza regra da camada errada, não testável isolado); só no banco (mensagem de erro ruim, tarde demais).

## R8 — Incremento mensal com clamp de fim de mês

- **Decisão**: `addMonthClamped(date, n)` soma `n` meses preservando o dia; se o dia não existe no mês destino (ex.: 31 → fevereiro), usa o **último dia** do mês destino. Base para `dueDate` das parcelas e da próxima ocorrência fixa.
- **Racional**: Assumption "vencimento mensal; dia inexistente → último dia do mês". Determinístico e testável.
- **Alternativas rejeitadas**: `Date.setMonth` cru (rola para o mês seguinte, ex.: 31/jan → 03/mar); usar sempre dia 1 (perde a semântica do vencimento).

## R9 — Lookups cross-módulo por porta

- **Decisão**: o módulo `transactions` define portas `CategoryLookup`/`AccountLookup`/`CardLookup` (`exists+type+owner` escopado por `userId`), implementadas na infraestrutura consultando as tabelas `categories`/`accounts`/`credit_cards` (read-only). Ref de outro usuário ou inexistente → tratada como 404 (FR-022). Registrar **ADR-012** (cross-module read) na implementação.
- **Racional**: Regra 8 (sem BaseRepository, sem microserviço) + regra 4 (domínio testável). Portas mantêm a fronteira explícita e permitem fake nos testes.
- **Alternativas rejeitadas**: FK físicas cross-módulo (acopla schemas, vaza persistência ao domínio); injetar os repositórios concretos dos outros módulos (acopla a implementação, não a contrato); duplicar dados de categoria/conta/cartão (inconsistência).

## R10 — Efetivação da fixa gera a próxima ocorrência

- **Decisão**: `effectuate` numa `fixed` pendente: marca `paid` (com `effectiveDate`/`effectiveAmount`) e, na **mesma transação atômica**, cria a próxima ocorrência `pending` com `dueDate = addMonthClamped(dueDate, 1)`, mesmo `groupId`, **exceto** se essa data ultrapassar `endDate` (FR-014). `installment` e `single` não geram nada ao efetivar.
- **Racional**: FR-013/FR-014. Atomicidade evita "pagou mas não criou a próxima".
- **Alternativas rejeitadas**: gerar a próxima só na próxima abertura da listagem (regra financeira migraria para leitura/BFF, viola regra 6); cron (complexidade operacional).

## R11 — `groupId` e idempotência

- **Decisão**: `groupId` (uuid) gerado no use case de criação para `installment` e `fixed`; `single` ⇒ `groupId` nulo. Todas as escritas (`create`/`effectuate`/`update`/`delete`) aceitam `Idempotency-Key` repassado do BFF; a criação das N parcelas é uma unidade atômica. Exclusão de grupo é idempotente (excluir "todas" de grupo já parcialmente excluído não erra).
- **Racional**: FR-011/FR-018 e regra 7. `groupId` no servidor evita colisão e mantém o cliente simples.
- **Alternativas rejeitadas**: `groupId` vindo do cliente (risco de colisão/spoof); sem idempotência (duplica parcelas em retry de rede).

## Resumo das decisões

| # | Tema | Decisão |
|---|---|---|
| R1 | Materialização | installment eager (N linhas); fixed lazy (na efetivação); single 1 linha |
| R2 | Split de parcela | centavos inteiros; última parcela absorve o resto |
| R3 | Escopo de grupo | one/future/all; inclui pagas; preserva dados de efetivação |
| R4 | Datas | UTC no banco; fronteiras de mês/hoje no frontend (fuso do usuário) |
| R5 | Listagem | filtro/ordem/mês server-side; atrasados em endpoint próprio; sem paginação |
| R6 | Valor efetivo | colunas `effective_amount`/`effective_date`; preserva `amount` |
| R7 | Origem/tipo | XOR conta/cartão (despesa), conta (receita); categoria coerente; invariante + CHECK |
| R8 | Data +1 mês | `addMonthClamped` com clamp de último dia |
| R9 | Cross-módulo | portas de lookup (category/account/card) escopadas; ADR-012 |
| R10 | Efetivar fixa | gera próxima ocorrência atômica, respeita `endDate` |
| R11 | Grupo/idempotência | `groupId` no servidor; `Idempotency-Key`; criação atômica; delete idempotente |
