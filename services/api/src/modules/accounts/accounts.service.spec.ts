import type { Repository } from 'typeorm';
import { AccountsService } from './accounts.service';
import { AccountEntity } from './entities/account.entity';
import { AccountNotFoundError, InvalidAccountError } from './accounts.types';

/**
 * In-memory fake of the subset of TypeORM's Repository the service uses, scoped
 * by userId to mirror the SQL WHERE clause. Direct instantiation of the service
 * (no Nest TestingModule) per repo convention.
 */
function makeFakeRepo(): Repository<AccountEntity> {
  const store = new Map<string, AccountEntity>();
  const fake = {
    create(data: Partial<AccountEntity>): AccountEntity {
      return Object.assign(new AccountEntity(), data);
    },
    async insert(entity: AccountEntity): Promise<void> {
      store.set(entity.id, { ...entity } as AccountEntity);
    },
    async save(entity: AccountEntity): Promise<AccountEntity> {
      store.set(entity.id, { ...entity } as AccountEntity);
      return entity;
    },
    async find(opts: { where: { userId: string } }): Promise<AccountEntity[]> {
      return [...store.values()]
        .filter((a) => a.userId === opts.where.userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async findOne(opts: { where: { id: string; userId: string } }): Promise<AccountEntity | null> {
      const row = store.get(opts.where.id);
      return row && row.userId === opts.where.userId ? row : null;
    },
    async delete(criteria: { id: string; userId: string }): Promise<void> {
      const row = store.get(criteria.id);
      if (row && row.userId === criteria.userId) store.delete(criteria.id);
    },
  };
  return fake as unknown as Repository<AccountEntity>;
}

const USER_A = 'user-a';
const USER_B = 'user-b';

const validInput = {
  name: 'Conta Corrente',
  bankId: 'nubank',
  icon: 'utensils',
  color: 'primary',
};

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(() => {
    service = new AccountsService(makeFakeRepo());
  });

  it('creates an account owned by the caller and returns a DTO without userId', async () => {
    const dto = await service.create(USER_A, validInput);
    expect(dto).toMatchObject({ name: 'Conta Corrente', bankId: 'nubank' });
    expect(dto).not.toHaveProperty('userId');
    expect(await service.list(USER_A)).toHaveLength(1);
  });

  it('rejects invalid input at the domain boundary', async () => {
    await expect(service.create(USER_A, { ...validInput, name: '  ' })).rejects.toBeInstanceOf(
      InvalidAccountError,
    );
    await expect(service.create(USER_A, { ...validInput, bankId: 'nope' })).rejects.toBeInstanceOf(
      InvalidAccountError,
    );
    await expect(service.create(USER_A, { ...validInput, icon: 'nope' })).rejects.toBeInstanceOf(
      InvalidAccountError,
    );
    await expect(service.create(USER_A, { ...validInput, color: 'nope' })).rejects.toBeInstanceOf(
      InvalidAccountError,
    );
  });

  it('isolates accounts by user in listing', async () => {
    await service.create(USER_A, validInput);
    await service.create(USER_B, { ...validInput, name: 'Poupança' });
    const aAccounts = await service.list(USER_A);
    expect(aAccounts).toHaveLength(1);
    expect(aAccounts[0]?.name).toBe('Conta Corrente');
  });

  it('updates own account', async () => {
    const created = await service.create(USER_A, validInput);
    const updated = await service.update(USER_A, created.id, { name: 'Nova' });
    expect(updated.name).toBe('Nova');
  });

  it("404s when updating another user's account", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.update(USER_B, created.id, { name: 'Hack' })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });

  it('deletes own account', async () => {
    const created = await service.create(USER_A, validInput);
    await service.delete(USER_A, created.id);
    expect(await service.list(USER_A)).toHaveLength(0);
  });

  it("404s when deleting another user's account and leaves it intact", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(await service.list(USER_A)).toHaveLength(1);
  });
});
