# Quickstart / Validation Guide: Importar Fatura

Guia para validar a feature end-to-end. Não contém implementação; referencia `contracts/` e `data-model.md`.

## Pré-requisitos

```bash
pnpm install
docker compose up -d            # PostgreSQL + Keycloak
pnpm --filter @finance/api migration:run   # inclui a migration que adiciona source 'imported'
```

Env (além do já existente): `AI_ROUTER_URL` + `AI_ROUTER_API_KEY` preenchidos (9Router) para o `ai-ms`; `AI_MS_URL=http://localhost:3033` visível ao `bff`.

Subir os serviços (dev): `api` (:3031), `ai-ms` (:3033), `bff` (:3032), `web` (:3000). Ex.: `pnpm turbo run dev --filter=@finance/api --filter=@finance/ai-ms --filter=@finance/bff --filter=web`.

## Cenário 1 — Extração (US1)

1. Autenticar no web, ir para **Importar Fatura**, selecionar um cartão do usuário.
2. Enviar um PDF de fatura **com texto** e a senha correta.
3. **Esperado**: lista de transações extraídas (data, descrição, valor) aparece na revisão; nada foi gravado no banco.

Checagem direta (opcional), com token de usuário:
```bash
curl -sS -X POST http://localhost:3032/invoice-import/extract \
  -H "Cookie: <sessao>" \
  -F file=@fatura.pdf -F password='<senha>' -F creditCardId='<uuid>' | jq .
# -> InvoiceExtractionResult com referenceMonth e lines[]
```

- Senha incorreta → **400** com mensagem de senha inválida; nada gravado (SC-005).
- PDF sem texto/corrompido → **400** "não foi possível extrair"; nada gravado.

## Cenário 2 — Revisão e categorização (US2)

1. Na revisão, cada linha tem seletor de **categoria**.
2. Linhas cuja descrição já existe em despesa de mês anterior aparecem com a **categoria pré-selecionada** (a da ocorrência mais recente).
3. Alterar uma sugestão e ver o valor escolhido substituir a sugestão.
4. Marcar uma linha incerta como descartada.

Checagem da sugestão (api):
```bash
curl -sS "http://localhost:3031/transactions/category-suggestions?descriptions=Uber&descriptions=Netflix&type=expense" \
  -H "Authorization: Bearer <jwt>" | jq .
# -> [{description:"Uber",categoryId:"..."},{description:"Netflix",categoryId:null}]
```

## Cenário 3 — Substituir vs Mesclar (US3)

Pré: já existir ao menos uma transação no cartão dentro do mês de referência.

**Merge** (`mode=merge`):
```bash
curl -sS -X POST http://localhost:3032/invoice-import/commit \
  -H "Cookie: <sessao>" -H "Content-Type: application/json" \
  -d '{"creditCardId":"<uuid>","referenceMonth":"2026-08","mode":"merge","lines":[...]}' | jq .
# -> {added:N, skipped:M, removed:0}  (duplicadas por data+valor+descrição normalizada não recriadas)
```
- Repetir o mesmo commit → `added:0` (0% duplicadas, SC-004).

**Replace** (`mode=replace`):
```bash
# mesmo endpoint com "mode":"replace"
# -> {added:N, skipped:0, removed:K}  (K = transações do cartão+mês apagadas antes de inserir)
```

Validação no banco (escopo cartão+mês):
```sql
SELECT id, description, amount, due_date, source, status
FROM transactions
WHERE credit_card_id = '<uuid>'
  AND due_date >= '2026-08-01' AND due_date < '2026-09-01'
ORDER BY due_date;
-- source = 'imported', status = 'pending'
```

## Cenário 4 — Parcelas (FR-003b/c)

1. Importar fatura com linha "Parcela 3/10".
2. **Esperado**: linha marcada como parcelada na revisão; ao gravar, cria transação `installment` com `groupId`, `installmentNumber/Count` e ocorrências mensais (lógica existente do módulo Transações).

## Verificações de segurança/qualidade

- **Senha nunca vaza** (SC-006): inspecionar logs de `ai-ms`/`bff`/`api` durante os cenários — a senha não deve aparecer em nenhuma linha, nem no corpo de nenhuma resposta.
- **Isolamento por usuário** (FR-014): tentar importar para um `creditCardId` de outro usuário → tratado como "não encontrada"; nenhuma transação de outro usuário é lida/alterada.
- **Nada antes do commit** (FR-016): após extrair e sair sem confirmar, o banco permanece inalterado.

## Testes automatizados esperados (referência para `/speckit-tasks`)

- `ai-ms`: unit de `pdf-reader` (senha certa/errada, sem texto) com PDFs de fixture; unit de `invoice-import.service` com `AIProvider` fake retornando JSON válido/ inválido (retry).
- `api`: unit/int de commit — dedup (merge), replace atômico, parcelas → installment, billing-cycle dueDate, `category-suggestions` (mais recente), isolamento por usuário. Reusar `__testing__/in-memory-repositories.ts`.
- `bff`: unit do orquestrador (extract → suggestions → merge de suggestedCategoryId; commit proxy).
- `web`: teste de fluxo dos modais (upload → review → commit) com mocks de rede.

## Gate final

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes (ignorar as 2 falhas pré-existentes de banking-ms registradas no baseline do 007).
