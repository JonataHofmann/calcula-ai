import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { TokenVerifier } from '@finance/auth';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CreditCardEntity } from './entities/credit-card.entity';
import { createSyncedCardInput } from './dto/create-synced-card.schema';

/**
 * "Integration" test per repo convention (no Nest TestingModule/supertest):
 * direct instantiation of the guard, pipe, and controller wired to the real
 * service over an in-memory repository fake.
 */
function makeFakeRepo(): Repository<CreditCardEntity> {
  const store = new Map<string, CreditCardEntity>();
  const fake = {
    create: (data: Partial<CreditCardEntity>) => Object.assign(new CreditCardEntity(), data),
    insert: async (e: CreditCardEntity) => void store.set(e.id, { ...e } as CreditCardEntity),
    save: async (e: CreditCardEntity) => (store.set(e.id, { ...e } as CreditCardEntity), e),
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((c) => c.userId === o.where.userId),
    findOne: async (o: { where: { id: string; userId: string } }) => {
      const r = store.get(o.where.id);
      return r && r.userId === o.where.userId ? r : null;
    },
    delete: async (c: { id: string; userId: string }) => {
      const r = store.get(c.id);
      if (r && r.userId === c.userId) store.delete(c.id);
    },
  };
  return fake as unknown as Repository<CreditCardEntity>;
}

function makeContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function makeController() {
  const service = new CardsService(makeFakeRepo());
  return { controller: new CardsController(service), service };
}

const USER_A = randomUUID();

function validBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    userId: USER_A,
    name: 'Cartão de crédito',
    lastDigits: '5678',
    dueDay: 10,
    closingDay: 1,
    limit: '1000.00',
    brandId: 'visa',
    ...over,
  };
}

describe('POST /cards/synced-create', () => {
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
    const pipe = new ZodValidationPipe(createSyncedCardInput);
    expect(() => pipe.transform(validBody({ lastDigits: '12' }))).toThrow();
    expect(() => pipe.transform(validBody({ brandId: 'not-a-real-brand' }))).toThrow();
    expect(() => pipe.transform(validBody({ userId: 'not-a-uuid' }))).toThrow();
  });

  it('creates the card for the given userId and returns it without a userId field', async () => {
    const { controller, service } = makeController();
    const dto = await controller.createSynced(validBody() as never);

    expect(dto).toMatchObject({
      name: 'Cartão de crédito',
      lastDigits: '5678',
      dueDay: 10,
      closingDay: 1,
      limit: '1000.00',
      brandId: 'visa',
    });
    expect(dto).not.toHaveProperty('userId');

    const listed = await service.list(USER_A);
    expect(listed.find((c) => c.id === dto.id)).toBeDefined();
  });
});
