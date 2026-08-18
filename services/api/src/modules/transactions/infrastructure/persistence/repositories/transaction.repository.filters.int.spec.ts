import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Transaction } from '../../../domain/transaction';
import { TransactionEntity } from '../entities/transaction.entity';
import { TypeOrmTransactionRepository } from './transaction.repository';

/**
 * Filter/sort integration test — the ILIKE searches and `amount::text` casts only exercise
 * against the real Postgres driver. Gated behind TEST_DATABASE_URL.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const CAT = '22222222-2222-2222-2222-222222222222';
const ACC = '33333333-3333-3333-3333-333333333333';

const DUE_FROM = new Date(Date.UTC(2026, 0, 1));
const DUE_TO = new Date(Date.UTC(2026, 0, 31, 23, 59, 59));

function tx(over: {
  description: string;
  amount: string;
  day: number;
  recurrence?: 'single' | 'fixed' | 'installment';
  type?: 'expense' | 'income';
  notes?: string;
}): Transaction {
  return Transaction.create({
    id: randomUUID(),
    userId: USER_A,
    description: over.description,
    dueDate: new Date(Date.UTC(2026, 0, over.day)),
    amount: over.amount,
    recurrence: over.recurrence ?? 'single',
    type: over.type ?? 'expense',
    categoryId: CAT,
    accountId: ACC,
    notes: over.notes,
    now: DUE_FROM,
  });
}

maybe('TypeOrmTransactionRepository filters (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmTransactionRepository;

  const base = { dueFrom: DUE_FROM, dueTo: DUE_TO, sort: 'dueDate' as const, order: 'asc' as const };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [TransactionEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    const ormRepo: Repository<TransactionEntity> = dataSource.getRepository(TransactionEntity);
    repo = new TypeOrmTransactionRepository(ormRepo);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TransactionEntity).clear();
    await repo.create(tx({ description: 'Aluguel', amount: '1200.00', day: 5, notes: 'casa' }));
    await repo.create(tx({ description: 'Curso', amount: '100.00', day: 10, recurrence: 'fixed' }));
    await repo.create(tx({ description: 'Salário', amount: '5000.00', day: 1, type: 'income' }));
  });

  it('search matches description, notes and amount text', async () => {
    expect((await repo.find(USER_A, { ...base, search: 'alug' })).map((t) => t.description)).toEqual(
      ['Aluguel'],
    );
    expect((await repo.find(USER_A, { ...base, search: 'casa' })).map((t) => t.description)).toEqual(
      ['Aluguel'],
    );
    expect((await repo.find(USER_A, { ...base, search: '5000' })).map((t) => t.description)).toEqual(
      ['Salário'],
    );
  });

  it('amount does a partial (contains) match', async () => {
    expect((await repo.find(USER_A, { ...base, amount: '120' })).map((t) => t.description)).toEqual([
      'Aluguel',
    ]);
  });

  it('filters by recurrence and type', async () => {
    expect(
      (await repo.find(USER_A, { ...base, recurrence: 'fixed' })).map((t) => t.description),
    ).toEqual(['Curso']);
    expect((await repo.find(USER_A, { ...base, type: 'income' })).map((t) => t.description)).toEqual(
      ['Salário'],
    );
  });

  it('sorts by amount ascending and descending', async () => {
    expect(
      (await repo.find(USER_A, { ...base, sort: 'amount', order: 'asc' })).map((t) => t.amount),
    ).toEqual(['100.00', '1200.00', '5000.00']);
    expect(
      (await repo.find(USER_A, { ...base, sort: 'amount', order: 'desc' })).map((t) => t.amount),
    ).toEqual(['5000.00', '1200.00', '100.00']);
  });

  it('scopes to the month window', async () => {
    await repo.create(tx({ description: 'Fora', amount: '9.00', day: 5 }));
    const feb = await repo.find(USER_A, {
      ...base,
      dueFrom: new Date(Date.UTC(2026, 1, 1)),
      dueTo: new Date(Date.UTC(2026, 1, 28)),
    });
    expect(feb).toHaveLength(0);
  });
});
