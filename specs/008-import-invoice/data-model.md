# Phase 1 Data Model: Importar Fatura

Escopo: esta feature **reusa** o domínio `Transaction` e as entidades `Category`/`CreditCard` existentes. Não cria tabela nova; apenas amplia um valor de enum e introduz DTOs/estruturas de transporte (não persistidas) para o fluxo extrair → revisar → gravar.

## 1. Entidades persistidas (existentes — reuso)

### Transaction (`services/api` — tabela `transactions`)

Campos relevantes ao commit (ver `transaction.model.ts`/`transaction.entity.ts`):

| Campo | Tipo | Uso na importação |
|------|------|-------------------|
| `id` | uuid | gerado |
| `userId` | uuid | do JWT (nunca do corpo) |
| `description` | string(1..120) | descrição extraída (revisável) |
| `dueDate` | timestamptz | dia de vencimento do cartão no mês de referência (helper billing-cycle) |
| `amount` | numeric(18,2) → **string** | valor extraído (revisável) |
| `effectiveAmount` | string \| null | null (só no efetivar) |
| `recurrence` | `single`\|`fixed`\|`installment` | `installment` se "X/Y"; senão `single` |
| `effectiveDate` | Date \| null | null |
| `type` | `expense`\|`income` | `expense` (fatura = despesa) |
| `status` | `pending`\|`paid` | **`pending`** (Q3) |
| `installmentCount`/`installmentNumber` | int \| null | preenchidos em parcelas |
| `groupId` | uuid \| null | gerado pela lógica de installment existente |
| `categoryId` | uuid | escolhido/confirmado na revisão (obrigatório ao gravar) |
| `accountId` | uuid \| null | null (origem é cartão) |
| `creditCardId` | uuid \| null | cartão selecionado |
| `source` | `manual`\|`synced`\|**`imported`** | **`imported`** (novo valor) |
| `externalId` | uuid \| null | opcional; pode carregar hash de dedup determinístico (futuro) |

**Invariantes reusadas** (do modelo): origem XOR por tipo (despesa exige exatamente um de account/card → aqui sempre card); regras de `installment` (count≥1, number∈1..count, groupId, sem endDate). O commit deve satisfazê-las via os use-cases existentes.

**Mudança de schema (migration)**: ampliar o CHECK da coluna `source` em `transactions` para aceitar `'imported'` (hoje `manual|synced`). Arquivo em `services/api/src/database/migrations/<timestamp>-add-imported-source-to-transactions.ts`, padrão raw-SQL `up`/`down` (DROP/ADD CONSTRAINT). Sem alteração de colunas.

### Category / CreditCard (existentes — leitura)

- `Category`: usada para o seletor por linha (via árvore `GET /categories`) e como alvo da sugestão por histórico. Nenhuma mudança.
- `CreditCard`: `dueDay`/`closingDay` usados pelo helper de ciclo de fatura para calcular `dueDate`. Nenhuma mudança de schema.

## 2. Estruturas de transporte (não persistidas — contratos)

Definidas em `packages/contracts/src/transactions/import-invoice.ts` (Zod + tipos). Detalhe dos schemas em `contracts/invoice-import.contracts.md`.

### ExtractedInvoiceLine (saída do ai-ms → revisão)

| Campo | Tipo | Regras |
|------|------|-------|
| `lineId` | string(uuid) | id efêmero da linha (para edição na UI) |
| `date` | string (ISO date) | data da compra extraída |
| `description` | string | descrição bruta extraída |
| `amount` | money string `/^-?\d+\.\d{2}$/` | valor; negativo = estorno/crédito |
| `installmentNumber` | int \| null | de "X/Y" |
| `installmentCount` | int \| null | de "X/Y" |
| `uncertain` | boolean | data/valor não confiáveis → sinalizar na revisão |
| `suggestedCategoryId` | uuid \| null | preenchido pelo BFF via histórico |

### InvoiceExtractionResult (ai-ms → bff)

| Campo | Tipo | Regras |
|------|------|-------|
| `referenceMonth` | string `YYYY-MM` | mês de referência extraído do PDF (ajustável) |
| `dueDate` | string ISO \| null | vencimento detectado (informativo) |
| `lines` | `ExtractedInvoiceLine[]` | sem `suggestedCategoryId` nesta etapa (BFF preenche) |

### InvoiceReviewLine (entrada do commit)

`ExtractedInvoiceLine` + `categoryId` (uuid, obrigatório) + `discarded` (boolean). Linhas `discarded=true` não são gravadas (FR-015).

### CommitInvoiceInput (bff → api, corpo do commit)

| Campo | Tipo | Regras |
|------|------|-------|
| `creditCardId` | uuid | do usuário |
| `referenceMonth` | string `YYYY-MM` | define a janela de escopo |
| `mode` | `replace`\|`merge` | decisão do usuário (Q1) |
| `lines` | `InvoiceReviewLine[]` (não descartadas) | ≥1 |

> `userId` **não** entra no corpo — vem do JWT no `api` (`@CurrentUser`).

### CommitInvoiceResult (api → bff → web)

| Campo | Tipo | Significado |
|------|------|-------------|
| `added` | int | transações criadas |
| `skipped` | int | ignoradas por duplicidade (merge) |
| `removed` | int | apagadas (replace) |

### CategorySuggestionQuery / Result (api leitura)

- Query: `descriptions: string[]` (normalizadas no server) + `type: 'expense'`.
- Result: `Array<{ description: string; categoryId: string | null }>` — categoria da despesa mais recente com a mesma descrição normalizada.

## 3. Regras de derivação e validação

- **Normalização de descrição** (dedup e sugestão): `trim` + `toLowerCase` + colapsar espaços internos. Mesma função usada nos dois lados (dedup no commit e match de sugestão) para consistência.
- **Janela do mês de referência**: `[primeiro instante do mês, último instante do mês]` em UTC, a partir de `referenceMonth` (YYYY-MM); "mês/hoje" segue o fuso do usuário no frontend, persistência em UTC (consistente com módulo Transações).
- **dueDate**: `billing-cycle.ts` mapeia (`referenceMonth`, `card.dueDay`) → data de vencimento (clamp de dia para meses curtos, reusando `addMonthClamped`/lógica análoga).
- **Dedup (merge)**: chave = (`date` dia, `amount`, `descrição normalizada`) dentro do escopo cartão+mês. Igual em todos → duplicada (ignora). Difere em qualquer → grava.
- **Replace**: apagar todas as transações do escopo (cartão + `dueDate` no mês de referência) e inserir as revisadas — em uma única transação de banco (atomicidade; rollback em falha).
- **Parcelas**: linha com `installmentNumber`/`installmentCount` → `recurrence='installment'`, delegando a geração de grupo/ocorrências ao use-case de criação existente. Linha sem → `single`.

## 4. Máquina de estados do fluxo (sessão de importação — efêmera)

```
UPLOAD ──(ai-ms extrai OK)──▶ REVIEW ──(usuário confirma + mode)──▶ COMMITTED
   │                              │
   │(senha errada/PDF ilegível)   │(usuário cancela/sai)
   ▼                              ▼
 ERROR (nada gravado)          CANCELED (nada gravado)
```

- A "sessão de importação" não é persistida nesta versão (fluxo stateless entre extract e commit; a UI mantém o estado de revisão). Nada é gravado antes de `COMMITTED` (FR-016).

## 5. Notas de borda (refletem spec + R8)

- Estorno/crédito: linhas com `amount` negativo aparecem na revisão; usuário decide manter/descartar.
- Parcela sem total legível ("X/?"): `uncertain=true`; usuário completa o total ou trata como avulsa antes de gravar.
- Reimportação + replace de parcelas: dedup pela parcela corrente evita recriar grupo; ocorrências futuras de grupos anteriores não são recriadas quando a parcela corrente é reconhecida como duplicada (limitação conhecida; refino futuro por chave determinística de grupo).
- Isolamento por usuário: todas as leituras/escritas escopadas por `userId` do JWT; cartão precisa ser do usuário.
