import { BankConnection } from '../../../domain/bank-connection';
import { LinkedAccount } from '../../../domain/linked-account';
import { LinkedCreditCard } from '../../../domain/linked-credit-card';
import { FakeBankConnectionRepository, USER_A } from '../test-fakes';
import { ListConnectionsUseCase } from './list-connections';

const USER_B = 'user-b';

describe('ListConnectionsUseCase', () => {
  function setup() {
    const repository = new FakeBankConnectionRepository();
    const useCase = new ListConnectionsUseCase(repository);
    return { repository, useCase };
  }

  it('returns connections for the given user with nested accounts and credit cards', async () => {
    const { repository, useCase } = setup();
    await repository.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'active',
        lastSyncedAt: new Date('2026-08-01T00:00:00Z'),
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
      }),
    );
    await repository.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pacc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta Corrente',
        balance: '150.50',
      }),
    );
    await repository.upsertLinkedCreditCard(
      LinkedCreditCard.create({
        id: 'card-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pacc-2',
        brand: null,
        lastDigits: null,
        creditLimit: null,
        currentBalance: '320.00',
      }),
    );

    const result = await useCase.execute({ userId: USER_A });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'conn-1',
      institutionName: 'Banco Fake',
      status: 'active',
    });
    expect(result[0].accounts).toHaveLength(1);
    expect(result[0].accounts[0]).toMatchObject({ id: 'acc-1', balance: '150.50' });
    expect(result[0].creditCards).toHaveLength(1);
    expect(result[0].creditCards[0]).toMatchObject({ id: 'card-1', brand: null, lastDigits: null, creditLimit: null });
  });

  it('does not leak connections belonging to other users', async () => {
    const { repository, useCase } = setup();
    await repository.create(
      BankConnection.restore({
        id: 'conn-2',
        userId: USER_B,
        pluggyItemId: 'item-2',
        institutionId: 'inst-2',
        institutionName: 'Outro Banco',
        status: 'active',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await useCase.execute({ userId: USER_A });

    expect(result).toEqual([]);
  });

  it('returns an empty array when the user has no connections', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ userId: USER_A });
    expect(result).toEqual([]);
  });
});
