import { DataSource, Repository } from 'typeorm';
import { CreditCard } from '../../../domain/credit-card';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { TypeOrmCreditCardRepository } from './credit-card.repository';

/**
 * Integration test against a real Postgres — the string/char/numeric mappings only
 * matter against the real driver. Gated behind TEST_DATABASE_URL so `pnpm test`
 * stays green without a database; set it (e.g. the dev compose DB) to run.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function makeCard(userId: string, overrides: Partial<{ name: string; limit: string }> = {}) {
  return CreditCard.create({
    id: crypto.randomUUID(),
    userId,
    name: overrides.name ?? 'Nubank',
    lastDigits: '1234',
    dueDay: 10,
    closingDay: 3,
    limit: overrides.limit ?? '5000.00',
    brandId: 'mastercard',
  });
}

maybe('TypeOrmCreditCardRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmCreditCardRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [CreditCardEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    const ormRepo: Repository<CreditCardEntity> =
      dataSource.getRepository(CreditCardEntity);
    repo = new TypeOrmCreditCardRepository(ormRepo);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(CreditCardEntity).clear();
  });

  it('round-trips a card preserving the decimal limit as a string', async () => {
    const card = makeCard(USER_A);
    await repo.create(card);
    const found = await repo.findById(card.id, USER_A);
    expect(found?.limit).toBe('5000.00');
    expect(found?.lastDigits).toBe('1234');
  });

  it("hides another user's card (findById returns null → 404 upstream)", async () => {
    const card = makeCard(USER_A);
    await repo.create(card);
    expect(await repo.findById(card.id, USER_B)).toBeNull();
  });

  it('scopes findAllByUser to the owner', async () => {
    await repo.create(makeCard(USER_A, { name: 'A' }));
    await repo.create(makeCard(USER_B, { name: 'B' }));
    const aCards = await repo.findAllByUser(USER_A);
    expect(aCards).toHaveLength(1);
    expect(aCards[0]?.name).toBe('A');
  });

  it('deletes only within the owner scope', async () => {
    const card = makeCard(USER_A);
    await repo.create(card);
    await repo.delete(card.id, USER_B);
    expect(await repo.findById(card.id, USER_A)).not.toBeNull();
    await repo.delete(card.id, USER_A);
    expect(await repo.findById(card.id, USER_A)).toBeNull();
  });
});
