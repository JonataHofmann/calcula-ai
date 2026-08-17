# Agent Guide: Database

## Basics

- PostgreSQL 17, TypeORM. Data source: `services/api/src/infrastructure/database/data-source.ts`.
- `synchronize: false` always. Schema changes ONLY via migrations in
  `modules/<domain>/infrastructure/persistence/migrations/`.
- Run: `pnpm --filter @finance/api migration:run` / `migration:revert`.

## Money columns

```ts
@Column({ type: 'numeric', precision: 14, scale: 2 })
amount!: string; // TypeORM returns numeric as string — keep it as string
```

Never `float`/`double precision` for money. Never parseFloat for arithmetic —
domain layer handles amounts as decimal strings / integer cents.

## Conventions

- Table names: snake_case plural (`transactions`, `credit_cards`).
- Every user-owned table has `user_id uuid NOT NULL` + index.
- Timestamps: `created_at`/`updated_at` as `timestamptz`.
- Dates without time (due dates, transaction dates): `date` column; store the
  user's timezone on the user profile, convert at the edges.
- Idempotency: `idempotency_keys` table (key, user_id, response hash) checked
  inside the same transaction as the write.
- Transfers: two transaction rows sharing `transfer_id`, written in one DB
  transaction.

## TypeORM entities

- Live in `infrastructure/persistence/entities/*.entity.ts` only.
- Never exported as HTTP contracts; map to domain entities in repositories.
