import { DataSource } from 'typeorm';
import { CardsService } from './cards.service';
import { CreditCardEntity } from './entities/credit-card.entity';
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
      entities: [CreditCardEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    service = new CardsService(dataSource.getRepository(CreditCardEntity));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(CreditCardEntity).clear();
  });

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
});
