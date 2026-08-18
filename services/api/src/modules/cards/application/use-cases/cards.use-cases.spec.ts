import { CreditCard } from '../../domain/credit-card';
import type { CreditCardRepository } from '../../domain/credit-card.repository';
import { CreditCardNotFoundError, InvalidCreditCardError } from '../../domain/errors';
import { CreateCardUseCase } from './create-card/create-card.use-case';
import { ListCardsUseCase } from './list-cards/list-cards.use-case';
import { UpdateCardUseCase } from './update-card/update-card.use-case';
import { DeleteCardUseCase } from './delete-card/delete-card.use-case';

/** In-memory repo scoped by userId — cross-user rows are invisible, mirroring the SQL WHERE clause. */
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

describe('Cards use cases', () => {
  let repo: FakeCreditCardRepository;
  let create: CreateCardUseCase;
  let list: ListCardsUseCase;
  let update: UpdateCardUseCase;
  let remove: DeleteCardUseCase;

  beforeEach(() => {
    repo = new FakeCreditCardRepository();
    create = new CreateCardUseCase(repo);
    list = new ListCardsUseCase(repo);
    update = new UpdateCardUseCase(repo);
    remove = new DeleteCardUseCase(repo);
  });

  it('creates a card owned by the caller', async () => {
    const card = await create.execute(USER_A, validInput);
    expect(card.userId).toBe(USER_A);
    expect(card.lastDigits).toBe('1234');
    expect(card.limit).toBe('5000.00');
    expect(await list.execute(USER_A)).toHaveLength(1);
  });

  it('rejects invalid input at the domain boundary', async () => {
    await expect(
      create.execute(USER_A, { ...validInput, lastDigits: '12' }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
    await expect(
      create.execute(USER_A, { ...validInput, dueDay: 40 }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
    await expect(
      create.execute(USER_A, { ...validInput, limit: '-1.00' }),
    ).rejects.toBeInstanceOf(InvalidCreditCardError);
  });

  it('isolates cards by user in listing', async () => {
    await create.execute(USER_A, validInput);
    await create.execute(USER_B, { ...validInput, name: 'Inter' });
    const aCards = await list.execute(USER_A);
    expect(aCards).toHaveLength(1);
    expect(aCards[0]?.name).toBe('Nubank');
  });

  it('updates own card', async () => {
    const card = await create.execute(USER_A, validInput);
    const updated = await update.execute(USER_A, card.id, { limit: '8000.00' });
    expect(updated.limit).toBe('8000.00');
  });

  it("404s when updating another user's card", async () => {
    const card = await create.execute(USER_A, validInput);
    await expect(
      update.execute(USER_B, card.id, { limit: '1.00' }),
    ).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });

  it('deletes own card', async () => {
    const card = await create.execute(USER_A, validInput);
    await remove.execute(USER_A, card.id);
    expect(await list.execute(USER_A)).toHaveLength(0);
  });

  it("404s when deleting another user's card and leaves it intact", async () => {
    const card = await create.execute(USER_A, validInput);
    await expect(remove.execute(USER_B, card.id)).rejects.toBeInstanceOf(
      CreditCardNotFoundError,
    );
    expect(await list.execute(USER_A)).toHaveLength(1);
  });
});
