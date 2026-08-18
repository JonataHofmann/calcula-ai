# Phase 0 — Research: Cadastros (Contas, Categorias, Cartões)

Todas as `NEEDS CLARIFICATION` da spec foram resolvidas na sessão `/speckit-clarify` (2026-08-17). Este documento consolida as decisões técnicas derivadas.

## R1 — Modelagem de categorias recursivas

**Decision**: Uma única tabela `categories` auto-referenciada. Cada linha é um nó com `parentId` nullable (raiz = `null`), `type` (`expense`/`income`) denormalizado em todos os nós, `ownerId` nullable (`null` = categoria padrão do sistema) e `isSystem` boolean. Subcategorias = nós com `parentId` preenchido; recursão de profundidade arbitrária.

**Rationale**: Clarificação definiu subcategorias recursivas. Árvore adjacency-list (`parentId`) é o padrão mais simples suportado nativamente por TypeORM/PostgreSQL; leitura da subárvore por CTE recursiva quando necessário, ou montagem em memória (volume pequeno por usuário). Denormalizar `type` no filho evita join até a raiz e garante invariante "subcategoria herda o tipo da raiz".

**Alternatives considered**:
- Duas tabelas `categories`+`subcategories`: não modela recursão sem terceira auto-referência; regra duplicada.
- Materialized path / nested set: otimizam leitura de subárvore mas adicionam complexidade de manutenção não justificada no volume esperado (regra 8).

## R2 — Ocultação e override de categorias padrão por usuário (copy-on-write)

**Decision**: Duas tabelas de estado por usuário sobre as categorias padrão:
- `user_hidden_categories(userId, categoryId)` — presença = oculta para o usuário. `UNIQUE(userId, categoryId)`. Restaurar = remover a linha (idempotente).
- `user_category_overrides(userId, categoryId, name?, icon?, color?)` — campos sobrescritos por usuário. `UNIQUE(userId, categoryId)`. Reverter ao original = remover a linha.

A "lista efetiva" de categorias de um usuário = (categorias padrão do sistema − ocultas + overrides aplicados) ∪ (categorias personalizadas do próprio usuário). Montagem no use case `list-effective-categories`.

**Rationale**: Mantém uma única fonte da verdade para o conjunto padrão (compartilhado), permite atualizar/estender categorias padrão sem tocar nos dados de usuários, e isola personalizações. Reversão trivial. Idempotência natural (regra 7).

**Alternatives considered**:
- Copiar todo o conjunto padrão para cada usuário no onboarding: infla dados, quebra "novos padrões aparecem", dificulta reverter ao original.
- Flag `hidden`/campos editáveis diretamente nas linhas do sistema: impossível — linhas do sistema são compartilhadas entre usuários.

## R3 — Catálogo de bancos, bandeiras, ícones e cores (estático interno)

**Decision**: Catálogos curados versionados em código em `@finance/contracts/src/reference/` (`BANKS`, `CARD_BRANDS`, `ICONS`, `COLORS`) com seus schemas Zod. O BFF expõe via `GET /reference/*`. As entidades armazenam apenas o **identificador** escolhido (`bankId`, `brandId`, `icon` key, `color` token) — não duplicam nome/logo.

**Rationale**: Clarificação 2026-08-17 escolheu catálogo estático interno, sem integração externa. Contratos compartilhados são o lugar natural para dados de referência tipados consumidos por web e backends. Evita tabela e migração para dados que mudam raramente (regra 8). Ícones reaproveitam `lucide-react` já presente; cores derivam dos tokens do design system (002).

**Alternatives considered**:
- Tabelas `banks`/`brands` no PostgreSQL: overhead de CRUD/seed para dados quase imutáveis.
- Integração Open Finance / API externa: rejeitada na clarificação; adiciona modo de falha de rede a um seletor.

## R4 — Validação compartilhada (Zod em `@finance/contracts`)

**Decision**: Schemas Zod únicos em `@finance/contracts` reutilizados no formulário (React Hook Form + `@hookform/resolvers/zod`), no BFF (validação de entrada/saída) e como base dos DTOs HTTP da API-MS. Regras: `name` obrigatório não-vazio; `lastDigits` = exatamente 4 dígitos (`/^\d{4}$/`); `dueDay`/`closingDay` inteiros 1–31; `limit` = `moneySchema` (string decimal ≥ 0); `type` ∈ {`expense`,`income`}; `icon`/`color`/`bankId`/`brandId` pertencem aos catálogos.

**Rationale**: Regra frontend nº 4 e DRY: uma definição de validação evita divergência entre camadas e alinha mensagens de erro. `moneySchema` já existe (regra 1).

**Alternatives considered**: validação duplicada por camada — divergência e retrabalho.

## R5 — Animações (react motion) e popup

**Decision**: Adicionar o pacote `motion` (react motion, sucessor do Framer Motion; import `motion/react`) a `apps/web` e `packages/ui`. Um componente `Modal` genérico em `packages/ui` provê overlay + trap de foco + fechar no `Esc`/backdrop, com entrada/saída animada via `AnimatePresence`. Listas de cards usam `AnimatePresence`/`layout` para inserção/remoção suave. Respeitar `prefers-reduced-motion`.

**Rationale**: FR-018 (todo form em popup) e FR-019 (transições animadas). O design system atual não tem modal; criar o primitivo garante coerência com os tokens (002) e reuso entre os três cadastros. `motion` é a biblioteca pedida e a padrão do ecossistema React 19.

**Alternatives considered**:
- CSS transitions puras: suficientes para fade simples, mas animação de layout/lista (reordenação/remoção) fica frágil sem uma lib.
- Radix Dialog + animação: dependência adicional; preferimos primitivo próprio no design system.

## R6 — Fluxo de dados web → BFF → API-MS e escopo por usuário

**Decision**: Web chama apenas o BFF (`credentials: 'include'`, cookie de sessão httpOnly da feature 001). O BFF resolve o `userId` da sessão, encaminha ao API-MS via `Authorization: Bearer <access_token>` (guard `AuthenticatedUser`, regra 2) e molda o contrato de saída expondo só o necessário (FR-023). Escritas propagam `Idempotency-Key` (regra 7). A web nunca envia `userId` (regra 2).

**Rationale**: Consistente com a arquitetura estabelecida (ADR-010, plan 001). Mantém regra financeira na API-MS e o BFF como agregador/contrato.

**Alternatives considered**: web chamando API-MS direto — quebra o papel do BFF e a postura de token server-side.

## R7 — Deleção e integridade referencial

**Decision**: Nesta feature (só cadastro) não há transações referenciando contas/categorias/cartões. Deleção é remoção efetiva (hard delete) escopada ao usuário. Ao deletar uma categoria (personalizada) com filhos, a subárvore é removida em cascata dentro de uma transação. Ocultar categoria padrão não remove nada (apenas marca). Quando features futuras (transações/faturas) referenciarem essas entidades, a estratégia de deleção (soft delete/restrição) será revista então.

**Rationale**: Evita complexidade prematura (regra 8); mantém consistência via transação (regra 7 — atomicidade).

**Alternatives considered**: soft delete universal agora — sem consumidor que o justifique nesta fase.

## Dependências a adicionar

| Pacote | Onde | Motivo |
|---|---|---|
| `motion` | `apps/web`, `packages/ui` | Animações e `AnimatePresence` (FR-019, R5) |
| `react-hook-form` | `apps/web` | Formulários (regra frontend nº 4) |
| `@hookform/resolvers` | `apps/web` | Ponte Zod ↔ RHF |

`zod`, `lucide-react`, `@tanstack/react-query`, `@reduxjs/toolkit` já presentes.

**Output**: Nenhuma `NEEDS CLARIFICATION` remanescente. Pronto para Phase 1.
