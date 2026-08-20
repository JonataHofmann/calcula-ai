import { CreateConnectTokenUseCase } from './create-connect-token';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { BankConnection } from '../../../domain/bank-connection';
import {
  FakeBankConnectionRepository,
  FakePluggyClient,
  USER_A,
} from '../test-fakes';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const pluggy = new FakePluggyClient();
  const useCase = new CreateConnectTokenUseCase(connections, pluggy);
  return { useCase, connections, pluggy };
}

describe('CreateConnectTokenUseCase', () => {
  it('creates a connect token with no itemId for mode "create"', async () => {
    const { useCase, pluggy } = setup();
    const result = await useCase.execute({ userId: USER_A, mode: 'create' });
    expect(result.connectToken).toBe('fake-connect-token');
    expect(pluggy.connectTokenCalls).toEqual([{ itemId: undefined }]);
  });

  it('creates a connect token scoped to the existing itemId for mode "reauth"', async () => {
    const { useCase, connections, pluggy } = setup();
    const connection = BankConnection.create({
      id: 'conn-1',
      userId: USER_A,
      pluggyItemId: 'item-1',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await connections.create(connection);

    const result = await useCase.execute({
      userId: USER_A,
      mode: 'reauth',
      bankConnectionId: 'conn-1',
    });

    expect(result.connectToken).toBe('fake-connect-token');
    expect(pluggy.connectTokenCalls).toEqual([{ itemId: 'item-1' }]);
  });

  it('throws ConnectionNotFoundError for reauth on an unknown connection', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ userId: USER_A, mode: 'reauth', bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });

  it('throws ConnectionNotFoundError for reauth on another user\'s connection', async () => {
    const { useCase, connections } = setup();
    const connection = BankConnection.create({
      id: 'conn-1',
      userId: 'user-b',
      pluggyItemId: 'item-1',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await connections.create(connection);

    await expect(
      useCase.execute({ userId: USER_A, mode: 'reauth', bankConnectionId: 'conn-1' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});
