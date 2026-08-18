# Phase 1 — Data Model: Cadastros

Convenções: `id` = UUID v4; timestamps `created_at`/`updated_at` (timestamptz); `userId` sempre do JWT verificado (regra 2); dinheiro = `numeric(18,2)` no banco / string decimal no contrato (regra 1). Entidades TypeORM vivem em `infrastructure/persistence/entities` e nunca são expostas como contrato HTTP (regra 9). Todas as alterações via migration.

---

## 1. Account (módulo `accounts`)

Tabela `accounts`.

| Campo | Tipo (DB) | Regras |
|---|---|---|
| id | uuid PK | gerado |
| user_id | uuid, NOT NULL, index | dono; do JWT |
| name | varchar(80), NOT NULL | não-vazio (trim) |
| bank_id | varchar(40), NOT NULL | ∈ catálogo `BANKS` |
| icon | varchar(40), NOT NULL | ∈ catálogo `ICONS` (iconKey) |
| color | varchar(24), NOT NULL | ∈ catálogo `COLORS` (colorToken) |
| created_at / updated_at | timestamptz | |

- Índice: `(user_id)`. Sem unicidade de nome (nomes duplicados permitidos — Assumptions).
- Escopo: toda operação filtra por `user_id`.
- Relações: nenhuma nesta feature (cartão NÃO se vincula à conta — clarificação).

**Contrato de saída (BFF → web)** — `accountSchema`: `{ id, name, bank: { id, name, logo/color }, icon, color, createdAt }`. O BFF hidrata `bank` a partir do catálogo; expõe só o necessário (FR-023) — não retorna `userId`.

---

## 2. Category (módulo `categories`) — árvore auto-referenciada

Tabela `categories` (unifica categoria e subcategoria; ver R1).

| Campo | Tipo (DB) | Regras |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid NULL, index | `NULL` = categoria padrão do sistema; caso contrário, dona |
| parent_id | uuid NULL, FK→categories.id | `NULL` = raiz; preenchido = subcategoria (recursivo) |
| name | varchar(80), NOT NULL | não-vazio |
| icon | varchar(40), NOT NULL | ∈ `ICONS` |
| color | varchar(24), NOT NULL | ∈ `COLORS` |
| type | varchar(8), NOT NULL | `expense` \| `income` — igual ao da raiz (invariante herdado) |
| is_system | boolean, NOT NULL default false | `true` nas linhas padrão (owner_id NULL) |
| created_at / updated_at | timestamptz | |

- FK `parent_id` ON DELETE CASCADE (deletar nó personalizado remove a subárvore — R7).
- Invariantes de domínio:
  - `type` do filho == `type` da raiz (validado no use case ao criar subcategoria).
  - Categoria personalizada: `owner_id = userId`, `is_system = false`. Só o dono lê/edita/deleta.
  - Categoria padrão: `owner_id = NULL`, `is_system = true`. Imutável diretamente; personalização por override (tabela 4).
  - Um usuário não pode pendurar subcategoria própria sob categoria de OUTRO usuário; sob categoria padrão é permitido (a subcategoria criada é personalizada, `owner_id = userId`).
- Índices: `(owner_id)`, `(parent_id)`, `(type)`.

### Estados / ciclo de vida de uma categoria padrão para um usuário
`visível(padrão)` → (hide) → `oculta` → (restore) → `visível(padrão)`
`visível(padrão)` → (override) → `visível(personalizada por override)` → (revert) → `visível(padrão)`
Hide e override são independentes e por usuário.

**Seed (migration)**: conjunto inicial de categorias padrão (despesa e receita) com `owner_id NULL`, `is_system true`, cada uma com subcategorias padrão. Lista curada definida na migration de seed.

---

## 3. UserHiddenCategory (módulo `categories`)

Tabela `user_hidden_categories`.

| Campo | Tipo (DB) | Regras |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| category_id | uuid NOT NULL, FK→categories.id | deve ser categoria padrão (`is_system=true`) |
| created_at | timestamptz | |

- `UNIQUE(user_id, category_id)` → idempotência de hide (R2, regra 7).
- Restaurar = DELETE da linha.

---

## 4. UserCategoryOverride (módulo `categories`)

Tabela `user_category_overrides` (copy-on-write; R2).

| Campo | Tipo (DB) | Regras |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| category_id | uuid NOT NULL, FK→categories.id | categoria padrão (`is_system=true`) |
| name | varchar(80) NULL | override opcional |
| icon | varchar(40) NULL | override opcional ∈ `ICONS` |
| color | varchar(24) NULL | override opcional ∈ `COLORS` |
| updated_at | timestamptz | |

- `UNIQUE(user_id, category_id)`.
- Aplicação: na lista efetiva, para cada categoria padrão não-oculta, campos não-nulos do override substituem os originais. `type` nunca é sobrescrito.
- Reverter ao original = DELETE da linha.

### Lista efetiva de categorias (use case `list-effective-categories`)
```
efetivas(user) =
   [ padrão p | p.owner_id IS NULL, p.parent_id IS NULL, p.id ∉ hidden(user) ] com override(user,p) aplicado
 ∪ [ custom c | c.owner_id = user, c.parent_id IS NULL ]
   (cada raiz acompanha sua subárvore recursiva; nós padrão filhos também respeitam hidden/override)
```
Agrupada por `type` (expense/income) na apresentação.

---

## 5. CreditCard (módulo `cards`)

Tabela `credit_cards`.

| Campo | Tipo (DB) | Regras |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL, index | dono; do JWT |
| name | varchar(80), NOT NULL | não-vazio |
| last_digits | char(4), NOT NULL | `/^\d{4}$/` (4 dígitos) |
| due_day | smallint, NOT NULL | 1–31 |
| closing_day | smallint, NOT NULL | 1–31 |
| limit | numeric(18,2), NOT NULL | ≥ 0 (string decimal no contrato — regra 1) |
| brand_id | varchar(40), NOT NULL | ∈ catálogo `CARD_BRANDS` |
| created_at / updated_at | timestamptz | |

- Índice `(user_id)`. Sem unicidade de nome/dígitos.
- Escopo por `user_id`. Nenhum vínculo com conta (clarificação).
- Observação de segurança: `last_digits` são apenas os 4 finais (não é PAN completo) — não há dado sensível de cartão armazenado (regra 10).

**Contrato de saída (BFF → web)** — `creditCardSchema`: `{ id, name, lastDigits, dueDay, closingDay, limit, brand: { id, name, logo/color } }`. Sem `userId`.

---

## 6. Catálogos de referência (estáticos, sem tabela — `@finance/contracts/src/reference`)

- **Bank**: `{ id, name, logo?, color }` — lista `BANKS`.
- **Brand**: `{ id, name, logo?, color }` — lista `CARD_BRANDS` (Visa, Mastercard, Elo, Amex, Hipercard...).
- **IconKey**: enum de chaves `lucide-react` curadas — lista `ICONS`.
- **ColorToken**: paleta curada derivada dos tokens do design system (002) — lista `COLORS`.

Somente leitura; servidos pelo BFF (`/reference/*`). Entidades acima referenciam apenas os ids/keys.

---

## Resumo de migrations (API-MS)

1. `create_accounts_table`
2. `create_categories_table` (self-ref FK, índices)
3. `seed_default_categories` (categorias + subcategorias padrão)
4. `create_user_hidden_categories_table`
5. `create_user_category_overrides_table`
6. `create_credit_cards_table`
