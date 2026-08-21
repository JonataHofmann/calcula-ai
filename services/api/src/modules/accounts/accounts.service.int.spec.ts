import { DataSource } from 'typeorm';
import { AccountsService } from './accounts.service';
import { AccountEntity } from './entities/account.entity';
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
      entities: [AccountEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    service = new AccountsService(dataSource.getRepository(AccountEntity));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AccountEntity).clear();
  });

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
});
