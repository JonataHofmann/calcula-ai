import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { TokenVerifier } from '@finance/auth';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountEntity } from './entities/account.entity';
import { createSyncedAccountInput } from './dto/create-synced-account.schema';

/**
 * "Integration" test per repo convention (no Nest TestingModule/supertest):
 * direct instantiation of the guard, pipe, and controller wired to the real
 * service over an in-memory repository fake.
 */
function makeFakeRepo(): Repository<AccountEntity> {
  const store = new Map<string, AccountEntity>();
  const fake = {
    create: (data: Partial<AccountEntity>) => Object.assign(new AccountEntity(), data),
    insert: async (e: AccountEntity) => void store.set(e.id, { ...e } as AccountEntity),
    save: async (e: AccountEntity) => (store.set(e.id, { ...e } as AccountEntity), e),
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((a) => a.userId === o.where.userId),
    findOne: async (o: { where: { id: string; userId: string } }) => {
      const r = store.get(o.where.id);
      return r && r.userId === o.where.userId ? r : null;
    },
    delete: async (c: { id: string; userId: string }) => {
      const r = store.get(c.id);
      if (r && r.userId === c.userId) store.delete(c.id);
    },
  };
  return fake as unknown as Repository<AccountEntity>;
}

function makeContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function makeController() {
  const repo = makeFakeRepo();
  const service = new AccountsService(repo);
  return { controller: new AccountsController(service), service };
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
    const { controller, service } = makeController();
    const dto = await controller.createSynced(validBody() as never);

    expect(dto).toMatchObject({ name: 'Conta corrente', bankId: 'other', icon: 'landmark', color: 'slate' });
    expect(dto).not.toHaveProperty('userId');

    const listed = await service.list(USER_A);
    expect(listed.find((a) => a.id === dto.id)).toBeDefined();
  });
});
