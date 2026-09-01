import type { Repository } from 'typeorm';
import { CardsService } from './cards.service';
import { CreditCardEntity } from './entities/credit-card.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardNotFoundError, InvalidCreditCardError } from './cards.types';

/**
 * In-memory fake of the subset of TypeORM's Repository the service uses, scoped
 * by userId to mirror the SQL WHERE clause. Direct instantiation of the service
 * (no Nest TestingModule) per repo convention.
 */
function makeFakeRepo(): Repository<CreditCardEntity> {
  const store = new Map<string, CreditCardEntity>();
  const fake = {
    create(data: Partial<CreditCardEntity>): CreditCardEntity {
      return Object.assign(new CreditCardEntity(), data);
    },
    async insert(entity: CreditCardEntity): Promise<void> {
      store.set(entity.id, { ...entity } as CreditCardEntity);
    },
    async save(entity: CreditCardEntity): Promise<CreditCardEntity> {
      store.set(entity.id, { ...entity } as CreditCardEntity);
      return entity;
    },
    async find(opts: { where: { userId: string } }): Promise<CreditCardEntity[]> {
      return [...store.values()]
        .filter((c) => c.userId === opts.where.userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async findOne(opts: { where: { id: string; userId: string } }): Promise<CreditCardEntity | null> {
      const row = store.get(opts.where.id);
      return row && row.userId === opts.where.userId ? row : null;
    },
    async delete(criteria: { id: string; userId: string }): Promise<void> {
      const row = store.get(criteria.id);
      if (row && row.userId === criteria.userId) store.delete(criteria.id);
    },
  };
  return fake as unknown as Repository<CreditCardEntity>;
}

/** In-memory fake of the transaction repo subset the service uses (count/delete by card + user). */
function makeFakeTxRepo(seed: TransactionEntity[] = []): Repository<TransactionEntity> {
  let store = [...seed];
  const fake = {
    async count(opts: { where: { creditCardId: string; userId: string } }): Promise<number> {
      return store.filter(
        (t) => t.creditCardId === opts.where.creditCardId && t.userId === opts.where.userId,
      ).length;
    },
    async delete(criteria: { creditCardId: string; userId: string }): Promise<{ affected: number }> {
      const before = store.length;
      store = store.filter(
        (t) => !(t.creditCardId === criteria.creditCardId && t.userId === criteria.userId),
      );
      return { affected: before - store.length };
    },
    __store: () => store,
  };
  return fake as unknown as Repository<TransactionEntity>;
}

const USER_A = 'user-a';
const USER_B = 'user-b';

const validInput = {
  name: 'Nubank',
  lastDigits: '1234',
  dueDay: 10,
  closingDay: 3,
  limit: '5000.00',
  brandId: 'mastercard',
};

describe('CardsService', () => {
  let service: CardsService;

  beforeEach(() => {
    service = new CardsService(makeFakeRepo(), makeFakeTxRepo());
  });

  it('creates a card owned by the caller and returns a DTO without userId', async () => {
    const dto = await service.create(USER_A, validInput);
    expect(dto).toMatchObject({ name: 'Nubank', lastDigits: '1234', limit: '5000.00' });
    expect(dto).not.toHaveProperty('userId');
    expect(await service.list(USER_A)).toHaveLength(1);
  });

  it('rejects invalid input at the domain boundary', async () => {
    await expect(
      service.create(USER_A, { ...validInput, lastDigits: '12' }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
    await expect(
      service.create(USER_A, { ...validInput, dueDay: 40 }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
    await expect(
      service.create(USER_A, { ...validInput, limit: '-1.00' }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
  });

  it('isolates cards by user in listing', async () => {
    await service.create(USER_A, validInput);
    await service.create(USER_B, { ...validInput, name: 'Inter' });
    const aCards = await service.list(USER_A);
    expect(aCards).toHaveLength(1);
    expect(aCards[0]?.name).toBe('Nubank');
  });

  it('updates own card', async () => {
    const created = await service.create(USER_A, validInput);
    const updated = await service.update(USER_A, created.id, { limit: '8000.00' });
    expect(updated.limit).toBe('8000.00');
  });

  it("404s when updating another user's card", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(
      service.update(USER_B, created.id, { limit: '1.00' }),
    ).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });

  it('deletes own card', async () => {
    const created = await service.create(USER_A, validInput);
    await service.delete(USER_A, created.id);
    expect(await service.list(USER_A)).toHaveLength(0);
  });

  it("404s when deleting another user's card and leaves it intact", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(
      CreditCardNotFoundError,
    );
    expect(await service.list(USER_A)).toHaveLength(1);
  });

  it('counts only the card transactions of the calling user', async () => {
    const cardRepo = makeFakeRepo();
    const svc0 = new CardsService(cardRepo, makeFakeTxRepo());
    const card = await svc0.create(USER_A, validInput);
    const mine = { creditCardId: card.id, userId: USER_A } as TransactionEntity;
    const other = { creditCardId: card.id, userId: USER_B } as TransactionEntity;
    const svc = new CardsService(cardRepo, makeFakeTxRepo([mine, mine, other]));
    expect(await svc.countTransactions(USER_A, card.id)).toBe(2);
  });

  it('keeps the card transactions by default but cascades when the flag is set', async () => {
    const cardRepo = makeFakeRepo();
    const svc0 = new CardsService(cardRepo, makeFakeTxRepo());
    const card = await svc0.create(USER_A, validInput);
    const tx = { creditCardId: card.id, userId: USER_A } as TransactionEntity;

    const keptTx = makeFakeTxRepo([tx, tx]);
    await new CardsService(cardRepo, keptTx).delete(USER_A, card.id);
    expect(store(keptTx)).toHaveLength(2);

    const card2 = await svc0.create(USER_A, validInput);
    const tx2 = { creditCardId: card2.id, userId: USER_A } as TransactionEntity;
    const goneTx = makeFakeTxRepo([tx2, tx2]);
    await new CardsService(cardRepo, goneTx).delete(USER_A, card2.id, true);
    expect(store(goneTx)).toHaveLength(0);
  });
});

function store(txRepo: Repository<TransactionEntity>): TransactionEntity[] {
  return (txRepo as unknown as { __store: () => TransactionEntity[] }).__store();
}
