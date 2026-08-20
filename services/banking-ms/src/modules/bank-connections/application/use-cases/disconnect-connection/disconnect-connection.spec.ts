import { BankConnection } from '../../../domain/bank-connection';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { FakeBankConnectionRepository, USER_A } from '../test-fakes';
import { DisconnectConnectionUseCase } from './disconnect-connection';

const USER_B = 'user-b';

describe('DisconnectConnectionUseCase', () => {
  function setup() {
    const repository = new FakeBankConnectionRepository();
    const useCase = new DisconnectConnectionUseCase(repository);
    return { repository, useCase };
  }

  it('marks an active connection as disconnected', async () => {
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

    await useCase.execute({ id: 'conn-1', userId: USER_A });

    const stored = await repository.findById('conn-1', USER_A);
    expect(stored?.toProps().status).toBe('disconnected');
  });

  it('is idempotent when the connection is already disconnected', async () => {
    const { repository, useCase } = setup();
    await repository.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'disconnected',
        lastSyncedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
    );

    await expect(useCase.execute({ id: 'conn-1', userId: USER_A })).resolves.toBeUndefined();
    const stored = await repository.findById('conn-1', USER_A);
    expect(stored?.toProps().status).toBe('disconnected');
  });

  it('throws ConnectionNotFoundError when the connection does not belong to the user', async () => {
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

    await expect(useCase.execute({ id: 'conn-2', userId: USER_A })).rejects.toThrow(
      ConnectionNotFoundError,
    );
  });

  it('throws ConnectionNotFoundError when the connection does not exist', async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ id: 'missing', userId: USER_A })).rejects.toThrow(
      ConnectionNotFoundError,
    );
  });
});
