import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CardsService } from './cards.service';
import { CreditCardEntity } from './entities/credit-card.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardNotFoundError } from './cards.types';

/**
 * Integration test against a real Postgres — the string/char/numeric mappings only
 * matter against the real driver. Gated behind TEST_DATABASE_URL so `pnpm test`
 * stays green without a database; set it (e.g. the dev compose DB) to run.
 * Exercises CardsService directly (the custom repository was removed, FR-009a).
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const validInput = {
  name: 'Nubank',
  lastDigits: '1234',
  dueDay: 10,
  closingDay: 3,
  limit: '5000.00',
  brandId: 'mastercard',
};

maybe('CardsService (integration)', () => {
  let dataSource: DataSource;
  let service: CardsService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [CreditCardEntity, TransactionEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    service = new CardsService(
      dataSource.getRepository(CreditCardEntity),
      dataSource.getRepository(TransactionEntity),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TransactionEntity).clear();
    await dataSource.getRepository(CreditCardEntity).clear();
  });

  const CATEGORY = '33333333-3333-3333-3333-333333333333';

  /** Minimal card-line transaction row for cascade tests. */
  async function seedTx(userId: string, creditCardId: string): Promise<void> {
    const repo = dataSource.getRepository(TransactionEntity);
    const now = new Date();
    await repo.insert(
      repo.create({
        id: randomUUID(),
        description: 'compra',
        dueDate: now,
        purchaseDate: now,
        amount: '10.00',
        recurrence: 'single',
        type: 'expense',
        status: 'pending',
        categoryId: CATEGORY,
        accountId: null,
        creditCardId,
        userId,
      }),
    );
  }

  it('round-trips a card preserving the decimal limit as a string', async () => {
    const created = await service.create(USER_A, validInput);
    const listed = await service.list(USER_A);
    const found = listed.find((c) => c.id === created.id);
    expect(found?.limit).toBe('5000.00');
    expect(found?.lastDigits).toBe('1234');
  });

  it("hides another user's card (update/delete → 404)", async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.update(USER_B, created.id, { limit: '1.00' })).rejects.toBeInstanceOf(
      CreditCardNotFoundError,
    );
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });

  it('scopes listing to the owner', async () => {
    await service.create(USER_A, { ...validInput, name: 'A' });
    await service.create(USER_B, { ...validInput, name: 'B' });
    const aCards = await service.list(USER_A);
    expect(aCards).toHaveLength(1);
    expect(aCards[0]?.name).toBe('A');
  });

  it('deletes only within the owner scope', async () => {
    const created = await service.create(USER_A, validInput);
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    expect((await service.list(USER_A)).length).toBe(1);
    await service.delete(USER_A, created.id);
    expect((await service.list(USER_A)).length).toBe(0);
  });

  it('counts linked transactions scoped to the owner', async () => {
    const card = await service.create(USER_A, validInput);
    await seedTx(USER_A, card.id);
    await seedTx(USER_A, card.id);
    await seedTx(USER_B, card.id);
    expect(await service.countTransactions(USER_A, card.id)).toBe(2);
  });

  it('keeps transactions by default and cascades them when requested', async () => {
    const txRepo = dataSource.getRepository(TransactionEntity);

    const keep = await service.create(USER_A, validInput);
    await seedTx(USER_A, keep.id);
    await service.delete(USER_A, keep.id);
    expect(await txRepo.count({ where: { creditCardId: keep.id } })).toBe(1);

    const cascade = await service.create(USER_A, validInput);
    await seedTx(USER_A, cascade.id);
    await seedTx(USER_A, cascade.id);
    await service.delete(USER_A, cascade.id, true);
    expect(await txRepo.count({ where: { creditCardId: cascade.id } })).toBe(0);
  });
});
