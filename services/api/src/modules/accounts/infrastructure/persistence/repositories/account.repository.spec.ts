import { DataSource, Repository } from 'typeorm';
import { Account } from '../../../domain/account';
import { AccountEntity } from '../entities/account.entity';
import { TypeOrmAccountRepository } from './account.repository';

/**
 * Integration test against a real Postgres — the varchar/uuid mappings only
 * matter against the real driver. Gated behind TEST_DATABASE_URL so `pnpm test`
 * stays green without a database; set it (e.g. the dev compose DB) to run.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function makeAccount(userId: string, overrides: Partial<{ name: string }> = {}) {
  return Account.create({
    id: crypto.randomUUID(),
    userId,
    name: overrides.name ?? 'Conta Corrente',
    bankId: 'nubank',
    icon: 'utensils',
    color: 'primary',
  });
}

maybe('TypeOrmAccountRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmAccountRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [AccountEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    const ormRepo: Repository<AccountEntity> = dataSource.getRepository(AccountEntity);
    repo = new TypeOrmAccountRepository(ormRepo);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AccountEntity).clear();
  });

  it('round-trips an account preserving catalog references', async () => {
    const account = makeAccount(USER_A);
    await repo.create(account);
    const found = await repo.findById(account.id, USER_A);
    expect(found?.name).toBe('Conta Corrente');
    expect(found?.bankId).toBe('nubank');
    expect(found?.icon).toBe('utensils');
    expect(found?.color).toBe('primary');
  });

  it("hides another user's account (findById returns null → 404 upstream)", async () => {
    const account = makeAccount(USER_A);
    await repo.create(account);
    expect(await repo.findById(account.id, USER_B)).toBeNull();
  });

  it('scopes findAllByUser to the owner', async () => {
    await repo.create(makeAccount(USER_A, { name: 'A' }));
    await repo.create(makeAccount(USER_B, { name: 'B' }));
    const aAccounts = await repo.findAllByUser(USER_A);
    expect(aAccounts).toHaveLength(1);
    expect(aAccounts[0]?.name).toBe('A');
  });

  it('deletes only within the owner scope', async () => {
    const account = makeAccount(USER_A);
    await repo.create(account);
    await repo.delete(account.id, USER_B);
    expect(await repo.findById(account.id, USER_A)).not.toBeNull();
    await repo.delete(account.id, USER_A);
    expect(await repo.findById(account.id, USER_A)).toBeNull();
  });
});
