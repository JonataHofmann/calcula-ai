# ADR-011: Categories as a Single Self-Referencing Tree with Per-User Hide/Override

## Context

Categorias têm tipo (`expense`/`income`) e subcategorias recursivas. Existem
categorias **padrão do sistema** (visíveis a todos os usuários) e categorias
**personalizadas** (de um usuário). Cada usuário pode: ocultar uma padrão só
para si, personalizar (editar) uma padrão só para si, e criar as suas próprias
— sem afetar os demais usuários nem mutar a linha padrão compartilhada.

## Problem

Como modelar categoria + subcategoria recursiva e, ao mesmo tempo, permitir que
cada usuário oculte e edite categorias padrão compartilhadas sem duplicar toda a
árvore por usuário nem corromper os dados globais?

## Decision

Uma **única tabela `categories`** auto-referenciada (`parent_id` FK → `categories.id`,
`ON DELETE CASCADE`) unifica categoria e subcategoria em qualquer profundidade.
Distinção de origem por `owner_id`/`is_system`:

- Padrão do sistema: `owner_id NULL`, `is_system true` (semeadas por migration). Imutáveis diretamente.
- Personalizada: `owner_id = userId`, `is_system false`. Só o dono lê/edita/deleta.

Personalização de padrões é **copy-on-write por usuário** em duas tabelas laterais,
ambas com `UNIQUE(user_id, category_id)` (idempotência — regra 7):

- `user_hidden_categories`: presença = oculta para aquele usuário; restaurar = DELETE.
- `user_category_overrides`: campos não-nulos (`name`/`icon`/`color`) substituem os da
  padrão na lista efetiva; `type` nunca é sobrescrito; reverter = DELETE.

A **lista efetiva** (`list-effective-categories`) = padrões não-ocultas (com override
aplicado) ∪ personalizadas do usuário, montada como árvore recursiva e agrupada por `type`.

Invariante de tipo: subcategoria herda o `type` da raiz (validado no use case). Criar
subcategoria sob uma padrão gera uma personalizada do usuário (`owner_id = userId`).

## Alternatives

- **Tabelas separadas categoria/subcategoria**: quebra a recursão além de 2 níveis; rejeitada.
- **Clonar a árvore padrão por usuário no primeiro acesso**: explosão de linhas e drift
  quando o seed muda; rejeitada.
- **JSON/árvore materializada**: dificulta escopo por usuário e integridade referencial; rejeitada.

## Consequences

- Uma tabela + duas laterais cobrem hide e override de forma isolada por usuário e idempotente.
- `type` global consistente; overrides não podem cruzar tipos.
- Montagem da lista efetiva concentra a complexidade num único use case (bem testável com fakes).
- Deleção de nó personalizado remove a subárvore via cascade em transação (regra 7).
- Custo: leitura da lista efetiva combina três fontes — aceito pelo isolamento e ausência de duplicação.
