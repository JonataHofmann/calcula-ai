import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Transaction } from '../../../domain/transaction';
import { TransactionEntity } from '../entities/transaction.entity';
import { TypeOrmTransactionRepository } from './transaction.repository';

/**
 * Integration test against a real Postgres — numeric(18,2)/timestamptz mappings and
 * the atomic createMany/deleteGroup transactions only matter against the real driver.
 * Gated behind TEST_DATABASE_URL so `pnpm test` stays green without a database.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';

function installmentGroup(groupId: string, count: number): Transaction[] {
  const due = new Date('2026-01-10T00:00:00.000Z');
  return Array.from({ length: count }, (_unused, i) =>
    Transaction.create({
      id: randomUUID(),
      userId: USER_A,
      description: 'Curso',
      dueDate: new Date(Date.UTC(2026, i, 10)),
      amount: '100.00',
      recurrence: 'installment',
      type: 'expense',
      categoryId: randomUUID(),
      accountId: randomUUID(),
      installmentCount: count,
      installmentNumber: i + 1,
      groupId,
      now: due,
    }),
  );
}

maybe('TypeOrmTransactionRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmTransactionRepository;

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
  });

  it('createMany persists the whole installment group atomically', async () => {
    const groupId = randomUUID();
    await repo.createMany(installmentGroup(groupId, 4));
    const group = await repo.findGroup(groupId, USER_A);
    expect(group).toHaveLength(4);
    expect(group.map((t) => t.installmentNumber)).toEqual([1, 2, 3, 4]);
    expect(group.every((t) => t.amount === '100.00')).toBe(true);
  });

  it('deleteGroup removes every row and is idempotent', async () => {
    const groupId = randomUUID();
    await repo.createMany(installmentGroup(groupId, 3));
    await repo.deleteGroup(groupId, USER_A);
    expect(await repo.findGroup(groupId, USER_A)).toHaveLength(0);
    // second call must not throw
    await repo.deleteGroup(groupId, USER_A);
    expect(await repo.findGroup(groupId, USER_A)).toHaveLength(0);
  });
});
