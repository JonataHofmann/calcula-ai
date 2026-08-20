import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { TokenVerifier } from '@finance/auth';
import { ServiceAccountGuard } from '../../../common/auth/service-account.guard';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account.repository';
import { CreateAccountUseCase } from '../application/use-cases/create-account/create-account.use-case';
import { createSyncedAccountInput } from '../application/use-cases/create-account/create-synced-account.schemas';
import { ListAccountsUseCase } from '../application/use-cases/list-accounts/list-accounts.use-case';
import { UpdateAccountUseCase } from '../application/use-cases/update-account/update-account.use-case';
import { DeleteAccountUseCase } from '../application/use-cases/delete-account/delete-account.use-case';
import { AccountsController } from './accounts.controller';

/**
 * "Integration" test per repo convention (no Nest TestingModule/supertest —
 * see synced-import.controller.spec.ts): direct instantiation of the guard,
 * pipe, and controller wired to real use cases + an in-memory fake.
 */

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

function makeContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function makeController() {
  const repo = new FakeAccountRepository();
  const createAccount = new CreateAccountUseCase(repo);
  const controller = new AccountsController(
    createAccount,
    new ListAccountsUseCase(repo),
    new UpdateAccountUseCase(repo),
    new DeleteAccountUseCase(repo),
  );
  return { controller, repo };
}

const USER_A = randomUUID();

function validBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    userId: USER_A,
    name: 'Conta corrente',
    bankId: 'other',
    icon: 'landmark',
    color: 'slate',
    ...over,
  };
}

describe('POST /accounts/synced-create', () => {
  it('rejects with 401 when the caller lacks the svc-transactions-import role', () => {
    const verifier: TokenVerifier = {
      verify: async () => ({
        sub: 'svc-account',
        payload: { realm_access: { roles: ['some-other-role'] } },
      }),
    };
    const guard = new ServiceAccountGuard(verifier);
    const context = makeContext({ authorization: 'Bearer token' });
    return expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects with 400 for an invalid body', () => {
    const pipe = new ZodValidationPipe(createSyncedAccountInput);
    expect(() => pipe.transform(validBody({ bankId: 'not-a-real-bank' }))).toThrow();
    expect(() => pipe.transform(validBody({ userId: 'not-a-uuid' }))).toThrow();
  });

  it('creates the account for the given userId and returns it without a userId field', async () => {
    const { controller, repo } = makeController();
    const dto = await controller.createSynced(validBody() as never);

    expect(dto).toMatchObject({ name: 'Conta corrente', bankId: 'other', icon: 'landmark', color: 'slate' });
    expect(dto).not.toHaveProperty('userId');

    const stored = await repo.findById(dto.id, USER_A);
    expect(stored).not.toBeNull();
  });
});
