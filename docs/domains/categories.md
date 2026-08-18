# Domain: Categories

Categorias por tipo (`expense`/`income`) com subcategorias recursivas. Há
categorias **padrão do sistema** (compartilhadas) e **personalizadas** (do
usuário). Cada usuário pode ocultar e personalizar padrões só para si, além de
criar as suas. Módulo `categories` na API-MS, agregado pelo BFF, consumido pelo web.

Decisão de modelagem: ver [ADR-011](../decisions/ADR-011-categories-tree.md).

## Purpose

Fornecer a taxonomia de categorização (base para orçamentos/relatórios futuros),
isolada por usuário, com padrões prontos que cada um pode adaptar sem afetar os demais.

## Entities / Value Objects

- **`Category`** (nó recursivo) — `services/api/src/modules/categories/domain/category.ts`
  - Props: `id`, `ownerId?` (NULL = padrão), `parentId?` (NULL = raiz), `name`, `icon`, `color`, `type`, `isSystem`, timestamps.
  - Distinção system (`ownerId NULL`, `isSystem true`) vs custom (`ownerId = userId`).
- **UserHiddenCategory** — ocultação de uma padrão por usuário (`user_hidden_categories`).
- **UserCategoryOverride** — copy-on-write de `name`/`icon`/`color` de uma padrão por usuário (`user_category_overrides`).
- `icon ∈ ICONS`, `color ∈ COLORS`; `type ∈ {expense, income}`.

## Invariants

- `type` do filho == `type` da raiz (herdado ao criar subcategoria).
- Padrão do sistema é imutável diretamente; personalização só via override/hide (por usuário).
- Subcategoria criada sob uma padrão é **custom** do usuário; não se pode pendurar nó próprio sob categoria de OUTRO usuário.
- Hide e override são **idempotentes** e independentes: `UNIQUE(user_id, category_id)` em ambas as tabelas.
- `type` nunca é sobrescrito por override.
- Deleção de nó custom remove a subárvore (`ON DELETE CASCADE`) em transação; deleção de padrão = ocultação idempotente.
- `userId` do JWT; toda leitura/escrita escopada por usuário; recurso de outro → `404`.

## Use Cases (`application/use-cases`)

| Use case | Regra |
|---|---|
| `list-effective-categories` | padrões não-ocultas (com override aplicado) ∪ custom do usuário; monta árvore recursiva; agrupa por `type` |
| `create-custom-category` | cria raiz custom (`ownerId = userId`, `isSystem false`) |
| `add-subcategory` | herda `type` da raiz; filha é custom do usuário |
| `update-category` | custom → edita direto; padrão → cria/atualiza override |
| `delete-category` | custom → hard delete + subárvore (transação); padrão → oculta idempotente |
| `restore-default-category` | remove ocultação; idempotente |
| `revert-category-override` | remove override; idempotente |

Portas de domínio: `category.repository.ts`, `hidden-category.repository.ts`, `category-override.repository.ts` (todas escopadas por usuário onde aplicável).

## Lista efetiva

```
efetivas(user) =
   [ padrão p | p.ownerId IS NULL, p.parentId IS NULL, p.id ∉ hidden(user) ] com override(user,p) aplicado
 ∪ [ custom c | c.ownerId = user, c.parentId IS NULL ]
   (cada raiz acompanha sua subárvore recursiva)
```

## Events

Nenhum evento de domínio nesta feature.

## API Surface

- **API-MS** (`presentation/categories.controller.ts`): CRUD + `:parentId/subcategories`, `:id/restore`, `:id/override`; guard `AuthenticatedUser`; idempotência. Entidades TypeORM (`categories` self-ref, `user_hidden_categories`, `user_category_overrides`) nunca expostas como contrato.
- **BFF** (`services/bff/src/categories`): serve a lista efetiva agrupada por tipo, com `source` (default/custom/overridden) e sem `ownerId`.
- **Contrato** (`@finance/contracts/src/categories/category.ts`): `categoryNodeSchema` (recursivo), `categoryTreeSchema`, `createCategoryInput`/`updateCategoryInput`, `categoryType`, campo `source`.
- **Web** (`apps/web/features/categories`): `use-categories` (TanStack Query + mutations create/subcategory/update/delete-hide/restore/revert), `category-tree.tsx` (árvore recursiva + badge de origem + ações), `category-form-modal.tsx` (popup RHF+Zod, `IconPicker`/`ColorPicker`, seletor de tipo), `categories-view.tsx` (seções Despesa/Receita). Rota `app/(app)/categorias`.

## Persistence

Tabelas `categories` (self-ref FK + índices), `user_hidden_categories`, `user_category_overrides` — ver `data-model.md §2–4` e migrations `create_categories_table`, `seed_default_categories`, `create_user_hidden_categories_table`, `create_user_category_overrides_table`.
