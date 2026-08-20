import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { TokenVerifier } from '@finance/auth';
import { ServiceAccountGuard } from '../../../common/auth/service-account.guard';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { CreditCard } from '../domain/credit-card';
import type { CreditCardRepository } from '../domain/credit-card.repository';
import { CreateCardUseCase } from '../application/use-cases/create-card/create-card.use-case';
import { createSyncedCardInput } from '../application/use-cases/create-card/create-synced-card.schemas';
import { ListCardsUseCase } from '../application/use-cases/list-cards/list-cards.use-case';
import { UpdateCardUseCase } from '../application/use-cases/update-card/update-card.use-case';
import { DeleteCardUseCase } from '../application/use-cases/delete-card/delete-card.use-case';
import { CardsController } from './cards.controller';

/**
 * "Integration" test per repo convention (no Nest TestingModule/supertest —
 * see synced-import.controller.spec.ts): direct instantiation of the guard,
 * pipe, and controller wired to real use cases + an in-memory fake.
 */

class FakeCreditCardRepository implements CreditCardRepository {
  private readonly store = new Map<string, CreditCard>();
  async create(card: CreditCard): Promise<void> {
    this.store.set(card.id, card);
  }
  async save(card: CreditCard): Promise<void> {
    this.store.set(card.id, card);
  }
  async findById(id: string, userId: string): Promise<CreditCard | null> {
    const card = this.store.get(id);
    return card && card.userId === userId ? card : null;
  }
  async findAllByUser(userId: string): Promise<CreditCard[]> {
    return [...this.store.values()].filter((c) => c.userId === userId);
  }
  async delete(id: string, userId: string): Promise<void> {
    const card = this.store.get(id);
    if (card && card.userId === userId) this.store.delete(id);
  }
}

function makeContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function makeController() {
  const repo = new FakeCreditCardRepository();
  const createCard = new CreateCardUseCase(repo);
  const controller = new CardsController(
    createCard,
    new ListCardsUseCase(repo),
    new UpdateCardUseCase(repo),
    new DeleteCardUseCase(repo),
  );
  return { controller, repo };
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
    const { controller, repo } = makeController();
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

    const stored = await repo.findById(dto.id, USER_A);
    expect(stored).not.toBeNull();
  });
});
