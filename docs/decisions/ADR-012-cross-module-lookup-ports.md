# ADR-012: Cross-Module Reads via Lookup Ports

## Context

O módulo `transactions` precisa validar, ao criar/editar uma transação, que a
`categoryId`, `accountId` e `creditCardId` informados existem e pertencem ao
usuário dono da transação. Essas entidades vivem em outros módulos
(`categories`, `accounts`, `cards`) do monólito modular, cada um com seu próprio
agregado, repositório e schema.

## Problem

Como `transactions` consulta dados de outros módulos para validação sem acoplar-se
às entidades TypeORM, aos repositórios concretos ou às regras internas desses
módulos — mantendo a Clean Architecture (ADR-009) e o isolamento entre módulos do
monólito modular (ADR-002)?

## Decision

Cada dependência de leitura entre módulos é expressa como uma **porta de lookup**
mínima, declarada no domínio do módulo consumidor
(`transactions/domain/lookups.ts`), resolvida por DI via tokens Symbol
(`CATEGORY_LOOKUP`, `ACCOUNT_LOOKUP`, `CARD_LOOKUP`):

- `CategoryLookup.findType(id, userId): Promise<TransactionType | null>`
- `AccountLookup.exists(id, userId): Promise<boolean>`
- `CardLookup.exists(id, userId): Promise<boolean>`

As portas retornam só o mínimo necessário à validação (existência escopada ao
usuário; para categoria, o `type` que precisa casar com o da transação — `null`
quando não existe ou não pertence ao usuário). O adaptador concreto vive na
infraestrutura e consulta o repositório/ORM do módulo dono, sempre filtrando por
`userId` (recurso de outro usuário → `null`/`false`, alinhado a FR-022). A
validação é centralizada em `application/shared/validate-references.ts`. Nos testes,
fakes em memória (`FakeCategoryLookup`, `FakeAccountLookup`, `FakeCardLookup`)
implementam a mesma porta.

## Alternatives

- **Importar entidades/repositórios do outro módulo direto no use case**: acopla
  `transactions` ao schema interno alheio; quebra o isolamento; rejeitada.
- **JOIN entre tabelas de módulos distintos no repositório de transactions**:
  vaza modelo de dados e impede evolução independente dos módulos; rejeitada.
- **Chamada HTTP/rede entre módulos**: overhead e complexidade injustificados num
  monólito de processo único; rejeitada.

## Consequences

- Use cases de `transactions` dependem só de interfaces estreitas — testáveis com
  fakes, sem banco.
- O acoplamento entre módulos fica explícito e mínimo (uma porta por necessidade),
  não implícito via imports profundos.
- Escopo por usuário centralizado no adaptador de lookup; leitura cruzada nunca
  expõe recursos de outro dono.
- Custo: uma porta + adaptador por dependência de leitura — aceito pelo isolamento
  e pela testabilidade.
