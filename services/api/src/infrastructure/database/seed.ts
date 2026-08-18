import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from './data-source';

/**
 * Test-data seed. Populates one user's accounts, cards, a custom category and a
 * spread of transactions across the previous / current / next month so the global
 * period selector has something to show.
 *
 * The user id matches the fixed Keycloak `sub` in docker/keycloak/realm.json
 * (test@finance.local), so logging in as that user surfaces exactly this data.
 *
 * Idempotent: every run wipes this user's rows first, then re-inserts.
 *
 * Run:  DATABASE_URL=postgres://finance:finance@localhost:5432/finance \
 *         pnpm --filter @finance/api seed
 */

/** Keycloak `sub` of test@finance.local — see docker/keycloak/realm.json. */
const USER_ID = '11111111-1111-4111-8111-111111111111';

/** System default category id from its 4-char suffix (seed-default-categories migration). */
function cat(suffix: string): string {
  return `00000000-0000-4000-a000-00000000${suffix}`;
}

const CAT = {
  salario: cat('0006'),
  investimentos: cat('0007'),
  outrosIncome: cat('0008'),
  mercado: cat('0102'),
  restaurante: cat('0101'),
  aluguel: cat('0201'),
  contas: cat('0202'),
  combustivel: cat('0301'),
  streaming: cat('0401'),
  farmacia: cat('0501'),
};

// Fixed ids so re-seeding keeps stable references.
const ACCOUNT_NUBANK = '22222222-2222-4222-8222-000000000001';
const ACCOUNT_INTER = '22222222-2222-4222-8222-000000000002';
const CARD_NUBANK = '33333333-3333-4333-8333-000000000001';
const CARD_ITAU = '33333333-3333-4333-8333-000000000002';
const CAT_PETS = '44444444-4444-4444-8444-000000000001';

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();
const todayMidnight = new Date(Y, M, now.getDate()).getTime();

/** Local noon on (current month + offset, day) → avoids tz day-flips. */
function day(offset: number, d: number): Date {
  return new Date(Y, M + offset, d, 12, 0, 0);
}

type TxType = 'expense' | 'income';
type Recurrence = 'single' | 'fixed' | 'installment';

interface TxSpec {
  description: string;
  dueDate: Date;
  amount: string;
  type: TxType;
  recurrence: Recurrence;
  categoryId: string;
  accountId?: string;
  creditCardId?: string;
  groupId?: string;
  installmentCount?: number;
  installmentNumber?: number;
  endDate?: Date;
}

const groupAluguel = randomUUID();
const groupStreaming = randomUUID();
const groupNotebook = randomUUID();

const specs: TxSpec[] = [];

// Salary — income into the Nubank account, on day 5 of each month.
for (const off of [-1, 0, 1]) {
  specs.push({
    description: 'Salário',
    dueDate: day(off, 5),
    amount: '8500.00',
    type: 'income',
    recurrence: 'fixed',
    categoryId: CAT.salario,
    accountId: ACCOUNT_NUBANK,
    groupId: randomUUID(),
  });
}

// Rent — fixed monthly expense from the Nubank account, day 10, shared group.
for (const off of [-1, 0, 1]) {
  specs.push({
    description: 'Aluguel',
    dueDate: day(off, 10),
    amount: '2200.00',
    type: 'expense',
    recurrence: 'fixed',
    categoryId: CAT.aluguel,
    accountId: ACCOUNT_NUBANK,
    groupId: groupAluguel,
  });
}

// Streaming — fixed monthly expense on the Nubank card, day 12.
for (const off of [-1, 0, 1]) {
  specs.push({
    description: 'Netflix',
    dueDate: day(off, 12),
    amount: '55.90',
    type: 'expense',
    recurrence: 'fixed',
    categoryId: CAT.streaming,
    creditCardId: CARD_NUBANK,
    groupId: groupStreaming,
  });
}

// Notebook — 3x installment on the Itaú card, one occurrence per month.
for (let i = 0; i < 3; i++) {
  specs.push({
    description: 'Notebook Dell (3x)',
    dueDate: day(i - 1, 18),
    amount: '1200.00',
    type: 'expense',
    recurrence: 'installment',
    categoryId: CAT.outrosIncome, // placeholder; overwritten below
    creditCardId: CARD_ITAU,
    groupId: groupNotebook,
    installmentCount: 3,
    installmentNumber: i + 1,
  });
}
// Fix notebook category to an expense one.
for (const s of specs) {
  if (s.groupId === groupNotebook) s.categoryId = CAT.contas;
}

// Assorted single transactions across the current month.
specs.push(
  {
    description: 'Mercado do mês',
    dueDate: day(0, 3),
    amount: '640.35',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT.mercado,
    creditCardId: CARD_NUBANK,
  },
  {
    description: 'Jantar restaurante',
    dueDate: day(0, 8),
    amount: '180.00',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT.restaurante,
    creditCardId: CARD_ITAU,
  },
  {
    description: 'Gasolina',
    dueDate: day(0, 15),
    amount: '250.00',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT.combustivel,
    accountId: ACCOUNT_INTER,
  },
  {
    description: 'Farmácia',
    dueDate: day(0, 20),
    amount: '92.40',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT.farmacia,
    accountId: ACCOUNT_INTER,
  },
  {
    description: 'Ração e petshop',
    dueDate: day(0, 22),
    amount: '135.00',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT_PETS,
    accountId: ACCOUNT_INTER,
  },
  {
    description: 'Dividendos',
    dueDate: day(0, 25),
    amount: '320.00',
    type: 'income',
    recurrence: 'single',
    categoryId: CAT.investimentos,
    accountId: ACCOUNT_INTER,
  },
  // Previous-month leftover that stays pending → exercises the "overdue" panel.
  {
    description: 'Conta de luz (atrasada)',
    dueDate: day(-1, 28),
    amount: '210.00',
    type: 'expense',
    recurrence: 'single',
    categoryId: CAT.contas,
    accountId: ACCOUNT_NUBANK,
  },
);

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed');
  }
  const ds = await AppDataSource.initialize();
  try {
    await ds.transaction(async (m) => {
      // Wipe this user's data first (idempotent).
      await m.query(`DELETE FROM "transactions" WHERE "user_id" = $1`, [USER_ID]);
      await m.query(`DELETE FROM "accounts" WHERE "user_id" = $1`, [USER_ID]);
      await m.query(`DELETE FROM "credit_cards" WHERE "user_id" = $1`, [USER_ID]);
      await m.query(`DELETE FROM "user_hidden_categories" WHERE "user_id" = $1`, [USER_ID]);
      await m.query(`DELETE FROM "user_category_overrides" WHERE "user_id" = $1`, [USER_ID]);
      await m.query(`DELETE FROM "categories" WHERE "owner_id" = $1`, [USER_ID]);

      // Accounts.
      const accounts: [string, string, string, string, string][] = [
        [ACCOUNT_NUBANK, 'Conta Nubank', 'nubank', 'landmark', 'primary'],
        [ACCOUNT_INTER, 'Conta Inter', 'inter', 'wallet', 'orange'],
      ];
      for (const [id, name, bankId, icon, color] of accounts) {
        await m.query(
          `INSERT INTO "accounts" ("id","user_id","name","bank_id","icon","color")
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, USER_ID, name, bankId, icon, color],
        );
      }

      // Credit cards.
      const cards: [string, string, string, number, number, string, string][] = [
        [CARD_NUBANK, 'Nubank', '1234', 10, 3, '5000.00', 'visa'],
        [CARD_ITAU, 'Itaú Platinum', '5678', 15, 8, '12000.00', 'mastercard'],
      ];
      for (const [id, name, last, due, close, limit, brand] of cards) {
        await m.query(
          `INSERT INTO "credit_cards"
             ("id","user_id","name","last_digits","due_day","closing_day","limit","brand_id")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, USER_ID, name, last, due, close, limit, brand],
        );
      }

      // Custom (user-owned) category.
      await m.query(
        `INSERT INTO "categories"
           ("id","owner_id","parent_id","name","type","icon","color","is_system")
         VALUES ($1,$2,NULL,$3,$4,$5,$6,false)`,
        [CAT_PETS, USER_ID, 'Pets', 'expense', 'dog', 'teal'],
      );

      // Transactions.
      for (const s of specs) {
        const paid = s.dueDate.getTime() < todayMidnight;
        await m.query(
          `INSERT INTO "transactions"
             ("id","user_id","description","due_date","amount","effective_amount","recurrence",
              "effective_date","type","notes","status","end_date","installment_count",
              "installment_number","group_id","category_id","account_id","credit_card_id")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            randomUUID(),
            USER_ID,
            s.description,
            s.dueDate.toISOString(),
            s.amount,
            paid ? s.amount : null,
            s.recurrence,
            paid ? s.dueDate.toISOString() : null,
            s.type,
            null,
            paid ? 'paid' : 'pending',
            s.endDate ? s.endDate.toISOString() : null,
            s.installmentCount ?? null,
            s.installmentNumber ?? null,
            s.groupId ?? null,
            s.categoryId,
            s.accountId ?? null,
            s.creditCardId ?? null,
          ],
        );
      }
    });

    console.log(
      `Seed OK — user ${USER_ID}: 2 contas, 2 cartões, 1 categoria custom, ${specs.length} transações.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
