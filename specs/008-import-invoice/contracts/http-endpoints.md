# Contract: HTTP Endpoints — Importar Fatura

Convenções: web→bff por cookie de sessão (`credentials: 'include'`); bff→ai-ms e bff→api por Bearer (token de sessão do usuário). `userId` sempre do JWT, nunca do corpo. Erros propagam status upstream (padrão `proxyRequest`). Money = string decimal.

## ai-ms (`:3033`) — extração (sem DB)

### POST `/invoice-extract`
- **Auth**: JWT do usuário (novo `AuthModule` no ai-ms; `@CurrentUser`).
- **Content-Type**: `multipart/form-data`.
- **Campos**: `file` (PDF), `password` (string, opcional se PDF não protegido), `creditCardId` (uuid — usado só para contexto/log, não para acesso a dados).
- **200**: `InvoiceExtractionResult` (sem `suggestedCategoryId`).
- **400**: senha incorreta (`InvalidPdfPasswordError`) → mensagem específica; PDF ilegível/sem texto (`UnreadablePdfError`).
- **Regra**: nada é persistido; senha usada e descartada; nunca logada.

## api (`:3031`) — persistência e leitura (dono do domínio)

### GET `/transactions/category-suggestions`
- **Auth**: JWT (`@CurrentUser`).
- **Query**: `descriptions` (lista; ex.: repetido `?descriptions=a&descriptions=b` ou separado por `|`), `type=expense`.
- **200**: `CategorySuggestionResult` — para cada descrição, `categoryId` da despesa **mais recente** do usuário com a mesma descrição normalizada, ou `null`.
- Escopo: `userId` do JWT.

### POST `/transactions/invoice-import`
- **Auth**: JWT (`@CurrentUser`). Rota **de usuário** (não service-account).
- **Header**: `Idempotency-Key` (reusa convenção de escrita financeira).
- **Body**: `CommitInvoiceInput` (`creditCardId`, `referenceMonth`, `mode`, `lines[]`). Validação por `ZodValidationPipe` com `commitInvoiceInputSchema` (server-side em `invoice-import.schemas.ts`).
- **200**: `CommitInvoiceResult` (`added`, `skipped`, `removed`).
- **Regras**:
  - Verifica cartão pertence ao usuário (senão 404/erro "não encontrada").
  - `mode=replace`: apaga transações do escopo (cartão + `dueDate` no mês de referência) e insere as revisadas — em transação de banco.
  - `mode=merge`: insere só linhas cujo trio (data,valor,descrição normalizada) não exista no escopo; conta `skipped`.
  - Linhas com parcela → `installment` (grupo/ocorrências pela lógica existente); senão `single`. Todas `expense`, `status=pending`, `dueDate` do ciclo do cartão, `source='imported'`, `creditCardId` setado, `accountId=null`.
  - `409` em conflito de idempotência/estado (padrão existente), sem gravação parcial.

## bff (`:3032`) — orquestração/proxy (sem regra financeira)

### POST `/invoice-import/extract`
- **Auth**: sessão (global `SessionAuthGuard`; não `@Public`).
- **Content-Type**: `multipart/form-data` (via `FileInterceptor`).
- **Campos**: `file` (PDF), `password`, `creditCardId`.
- **Fluxo**: repassa multipart ao ai-ms (`AiApiClient`, Bearer do usuário) → recebe `InvoiceExtractionResult` → chama `GET /transactions/category-suggestions` no api com as descrições das linhas → preenche `suggestedCategoryId` em cada linha.
- **200**: `InvoiceExtractionResult` com `suggestedCategoryId` preenchido.
- **Erros**: propaga 400 do ai-ms (senha/arquivo).

### POST `/invoice-import/commit`
- **Auth**: sessão.
- **Body**: `CommitInvoiceInput` (JSON).
- **Fluxo**: proxy para `POST /transactions/invoice-import` no api (Bearer do usuário, `Idempotency-Key`).
- **200**: `CommitInvoiceResult`.

## web — camada de serviço

- `apps/web/services/api-client.ts`: variante `apiUpload(path, formData)` que **não** força `Content-Type` (browser define boundary), mantém `credentials: 'include'`.
- `features/invoice-import/invoice-import-api.ts`:
  - `extractInvoice({ file, password, creditCardId }) → InvoiceExtractionResult` (multipart → `POST /invoice-import/extract`).
  - `commitInvoice(CommitInvoiceInput) → CommitInvoiceResult` (`POST /invoice-import/commit`, com `Idempotency-Key`).

## Mapa de conformidade requisito → endpoint

| Requisito | Onde |
|-----------|------|
| FR-001 upload cartão+PDF+senha | web upload modal → bff `/invoice-import/extract` |
| FR-002 senha incorreta | ai-ms `/invoice-extract` (400) |
| FR-003 extração IA (data/desc/valor) | ai-ms `/invoice-extract` |
| FR-003a mês de referência | ai-ms retorna `referenceMonth`; ajustável na revisão |
| FR-003b/c parcelas → installment | ai-ms detecta "X/Y"; api commit gera grupo |
| FR-004 IA só no ai-ms | ai-ms módulo; api/bff não fazem IA/PDF |
| FR-005 revisão antes de gravar | web review modal; nada persiste até commit |
| FR-006 categoria por linha | web EntitySelect + `useCategories` |
| FR-007/008 sugestão por histórico | api `/transactions/category-suggestions` (mais recente) |
| FR-009/010/011 replace/merge/dedup | api `/transactions/invoice-import` |
| FR-012 resumo do resultado | `CommitInvoiceResult` |
| FR-013 despesa pending + cartão + vencimento | api commit + billing-cycle |
| FR-014 isolamento por usuário | JWT em todas as camadas |
| FR-015 descartar linhas incertas | `discarded` no commit |
| FR-016 não persistir antes de confirmar | commit único ponto de escrita |
| FR-017/SC-006 senha sensível | ai-ms usa e descarta; nunca loga/retorna |
