import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AccountsService } from './accounts.service';
import { AccountEntity } from './entities/account.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { AccountNotFoundError } from './accounts.types';

/**
 * Integration test against a real Postgres — the varchar/uuid mappings only
 * matter against the real driver. Gated behind TEST_DATABASE_URL so `pnpm test`
 * stays green without a database; set it (e.g. the dev compose DB) to run.
 * Exercises AccountsService directly (the custom repository was removed, FR-009a).
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const validInput = { name: 'Conta Corrente', bankId: 'nubank', icon: 'utensils', color: 'primary' };

maybe('AccountsService (integration)', () => {
  let dataSource: DataSource;
  let service: AccountsService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [AccountEntity, TransactionEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    service = new AccountsService(
      dataSource.getRepository(AccountEntity),
      dataSource.getRepository(TransactionEntity),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TransactionEntity).clear();
    await dataSource.getRepository(AccountEntity).clear();
  });

  const CATEGORY = '33333333-3333-3333-3333-333333333333';

  /** Minimal account-line transaction row for cascade tests. */
  async function seedTx(userId: string, accountId: string): Promise<void> {
    const repo = dataSource.getRepository(TransactionEntity);
    const now = new Date();
    await repo.insert(
      repo.create({
        id: randomUUID(),
        description: 'lançamento',
        dueDate: now,
        purchaseDate: null,
        amount: '10.00',
        recurrence: 'single',
        type: 'expense',
        status: 'pending',
        categoryId: CATEGORY,
        accountId,
        creditCardId: null,
        userId,
      }),
    );
  }

  it('round-trips an account preserving catalog references', async () => {
    const created = await service.create(USER_A, validInput);
    const listed = await service.list(USER_A);
    const found = listed.find((a) => a.id === created.id);
    expect(found).toMatchObject({ name: 'Conta Corrente', bankId: 'nubank', icon: 'utensils', color: 'primary' });
  });

  it("hides another user's account (update/delete → 404)", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.update(USER_B, created.id, { name: 'Hack' })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('scopes listing to the owner', async () => {
    await service.create(USER_A, { ...validInput, name: 'A' });
    await service.create(USER_B, { ...validInput, name: 'B' });
    const aAccounts = await service.list(USER_A);
    expect(aAccounts).toHaveLength(1);
    expect(aAccounts[0]?.name).toBe('A');
  });

  it('deletes only within the owner scope', async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    expect((await service.list(USER_A)).length).toBe(1);
    await service.delete(USER_A, created.id);
    expect((await service.list(USER_A)).length).toBe(0);
  });

  it('counts linked transactions scoped to the owner', async () => {
    const acc = await service.create(USER_A, validInput);
    await seedTx(USER_A, acc.id);
    await seedTx(USER_A, acc.id);
    await seedTx(USER_B, acc.id);
    expect(await service.countTransactions(USER_A, acc.id)).toBe(2);
  });

  it('keeps transactions by default and cascades them when requested', async () => {
    const txRepo = dataSource.getRepository(TransactionEntity);

    const keep = await service.create(USER_A, validInput);
    await seedTx(USER_A, keep.id);
    await service.delete(USER_A, keep.id);
    expect(await txRepo.count({ where: { accountId: keep.id } })).toBe(1);

    const cascade = await service.create(USER_A, validInput);
    await seedTx(USER_A, cascade.id);
    await seedTx(USER_A, cascade.id);
    await service.delete(USER_A, cascade.id, true);
    expect(await txRepo.count({ where: { accountId: cascade.id } })).toBe(0);
  });
});
