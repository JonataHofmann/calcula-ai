import { Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account.repository';
import { AccountNotFoundError, InvalidAccountError } from '../../domain/errors';
import { CreateAccountUseCase } from './create-account/create-account.use-case';
import { ListAccountsUseCase } from './list-accounts/list-accounts.use-case';
import { UpdateAccountUseCase } from './update-account/update-account.use-case';
import { DeleteAccountUseCase } from './delete-account/delete-account.use-case';

/** In-memory repo scoped by userId — cross-user rows are invisible, mirroring the SQL WHERE clause. */
class FakeAccountRepository implements AccountRepository {
  private readonly store = new Map<string, Account>();

  async create(account: Account): Promise<void> {
    this.store.set(account.id, account);
  }
  async save(account: Account): Promise<void> {
    this.store.set(account.id, account);
  }
  async findById(id: string, userId: string): Promise<Account | null> {
    const account = this.store.get(id);
    return account && account.userId === userId ? account : null;
  }
  async findAllByUser(userId: string): Promise<Account[]> {
    return [...this.store.values()].filter((a) => a.userId === userId);
  }
  async delete(id: string, userId: string): Promise<void> {
    const account = this.store.get(id);
    if (account && account.userId === userId) this.store.delete(id);
  }
}

const USER_A = 'user-a';
const USER_B = 'user-b';

const validInput = {
  name: 'Conta Corrente',
  bankId: 'nubank',
  icon: 'utensils',
  color: 'primary',
};

describe('Accounts use cases', () => {
  let repo: FakeAccountRepository;
  let create: CreateAccountUseCase;
  let list: ListAccountsUseCase;
  let update: UpdateAccountUseCase;
  let remove: DeleteAccountUseCase;

  beforeEach(() => {
    repo = new FakeAccountRepository();
    create = new CreateAccountUseCase(repo);
    list = new ListAccountsUseCase(repo);
    update = new UpdateAccountUseCase(repo);
    remove = new DeleteAccountUseCase(repo);
  });

  it('creates an account owned by the caller', async () => {
    const account = await create.execute(USER_A, validInput);
    expect(account.userId).toBe(USER_A);
    expect(account.name).toBe('Conta Corrente');
    expect(account.bankId).toBe('nubank');
    expect(await list.execute(USER_A)).toHaveLength(1);
  });

  it('rejects invalid input at the domain boundary', async () => {
    await expect(
      create.execute(USER_A, { ...validInput, name: '  ' }),
    ).rejects.toBeInstanceOf(InvalidAccountError);
    await expect(
      create.execute(USER_A, { ...validInput, bankId: 'nope' }),
    ).rejects.toBeInstanceOf(InvalidAccountError);
    await expect(
      create.execute(USER_A, { ...validInput, icon: 'nope' }),
    ).rejects.toBeInstanceOf(InvalidAccountError);
    await expect(
      create.execute(USER_A, { ...validInput, color: 'nope' }),
    ).rejects.toBeInstanceOf(InvalidAccountError);
  });

  it('isolates accounts by user in listing', async () => {
    await create.execute(USER_A, validInput);
    await create.execute(USER_B, { ...validInput, name: 'Poupança' });
    const aAccounts = await list.execute(USER_A);
    expect(aAccounts).toHaveLength(1);
    expect(aAccounts[0]?.name).toBe('Conta Corrente');
  });

  it('updates own account', async () => {
    const account = await create.execute(USER_A, validInput);
    const updated = await update.execute(USER_A, account.id, { name: 'Nova' });
    expect(updated.name).toBe('Nova');
  });

  it("404s when updating another user's account", async () => {
    const account = await create.execute(USER_A, validInput);
    await expect(
      update.execute(USER_B, account.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('deletes own account', async () => {
    const account = await create.execute(USER_A, validInput);
    await remove.execute(USER_A, account.id);
    expect(await list.execute(USER_A)).toHaveLength(0);
  });

  it("404s when deleting another user's account and leaves it intact", async () => {
    const account = await create.execute(USER_A, validInput);
    await expect(remove.execute(USER_B, account.id)).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    expect(await list.execute(USER_A)).toHaveLength(1);
  });
});
