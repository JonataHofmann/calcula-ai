# Contract — Categories (BFF)

Escopo por usuário. Retorna a **lista efetiva** (padrão − ocultas + overrides ∪ personalizadas), agrupada por tipo, com subcategorias recursivas. Escritas com `Idempotency-Key`.

`CategoryNode` (saída, recursivo):
```json
{
  "id": "uuid",
  "name": "Alimentação",
  "icon": "utensils",
  "color": "danger",
  "type": "expense",
  "source": "default | default-overridden | custom",
  "children": [ { "id": "uuid", "name": "Mercado", "icon": "shopping-cart", "color": "danger", "type": "expense", "source": "custom", "children": [] } ]
}
```
`source` informa a UI (badge/ação de restaurar aparece só em `default`/`default-overridden`). Sem `userId`/`ownerId` na saída (FR-023).

## GET /categories
Lista efetiva.

**200**
```json
{ "expense": CategoryNode[], "income": CategoryNode[] }
```

## POST /categories
Cria categoria personalizada (raiz).

**Body** (`createCategoryInput`): `{ "name", "type": "expense|income", "icon", "color" }`
**201** `CategoryNode` · **400** · **401**

## POST /categories/:parentId/subcategories
Cria subcategoria sob uma categoria/subcategoria (`:parentId` pode ser padrão ou personalizada; a filha criada é personalizada do usuário). `type` herdado da raiz — não aceito no body.

**Body**: `{ "name", "icon", "color" }`
**201** `CategoryNode` · **400** (parent inválido/tipo) · **401** · **404** (parent não acessível)

## PATCH /categories/:id
- Categoria **personalizada** (`source=custom`): edita `name|icon|color` diretamente.
- Categoria **padrão** (`source=default`): cria/atualiza um **override** por usuário (copy-on-write) com os campos enviados; não altera a linha do sistema. `type` nunca editável.

**Body** (`updateCategoryInput`): subconjunto de `name|icon|color`.
**200** `CategoryNode` (com `source` atualizado) · **400** · **401** · **404**

## DELETE /categories/:id
- Personalizada: hard delete da categoria e subárvore (cascata, transação).
- Padrão: **oculta** para o usuário (cria `user_hidden_categories`; idempotente).

**204** · **401** · **404**

## POST /categories/:id/restore
Restaura categoria padrão previamente oculta (remove ocultação). Idempotente.

**204** · **401** · **404** (não é categoria padrão)

## DELETE /categories/:id/override
Reverte uma categoria padrão ao original (remove override). Idempotente.

**204** · **401** · **404**

**Regras**: `type` ∈ {expense,income}; `icon`∈ICONS; `color`∈COLORS; subcategoria herda `type` da raiz; usuário só acessa categorias padrão ou próprias (FR-021).
