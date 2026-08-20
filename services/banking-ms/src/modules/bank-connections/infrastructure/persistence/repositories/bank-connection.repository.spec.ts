import { DataSource } from 'typeorm';
import { BankConnection } from '../../../domain/bank-connection';
import { LinkedAccount } from '../../../domain/linked-account';
import { LinkedCreditCard } from '../../../domain/linked-credit-card';
import { SyncedTransaction } from '../../../domain/synced-transaction';
import { BankConnectionEntity } from '../entities/bank-connection.entity';
import { LinkedAccountEntity } from '../entities/linked-account.entity';
import { LinkedCreditCardEntity } from '../entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from '../entities/synced-transaction.entity';
import { TypeOrmBankConnectionRepository } from './bank-connection.repository';

const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = 'user-a';

function erroredTransaction(overrides: {
  id: string;
  pluggyTransactionId: string;
  linkedAccountId: string | null;
  linkedCreditCardId: string | null;
  syncStatus: 'success' | 'error' | 'pending';
}) {
  return SyncedTransaction.restore({
    id: overrides.id,
    linkedAccountId: overrides.linkedAccountId,
    linkedCreditCardId: overrides.linkedCreditCardId,
    userId: USER_A,
    pluggyTransactionId: overrides.pluggyTransactionId,
    description: 'Compra teste',
    amount: '50.00',
    date: new Date('2026-08-01'),
    direction: 'debit',
    pluggyStatus: 'posted',
    installmentNumber: null,
    installmentTotal: null,
    syncStatus: overrides.syncStatus,
    transactionsMsId: overrides.syncStatus === 'success' ? 'tx-ms-1' : null,
    retryCount: overrides.syncStatus === 'error' ? 1 : 0,
    lastError: overrides.syncStatus === 'error' ? 'boom' : null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  });
}

maybe('TypeOrmBankConnectionRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmBankConnectionRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [BankConnectionEntity, LinkedAccountEntity, LinkedCreditCardEntity, SyncedTransactionEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    repo = new TypeOrmBankConnectionRepository(
      dataSource.getRepository(BankConnectionEntity),
      dataSource.getRepository(LinkedAccountEntity),
      dataSource.getRepository(LinkedCreditCardEntity),
      dataSource.getRepository(SyncedTransactionEntity),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(SyncedTransactionEntity).clear();
    await dataSource.getRepository(LinkedCreditCardEntity).clear();
    await dataSource.getRepository(LinkedAccountEntity).clear();
    await dataSource.getRepository(BankConnectionEntity).clear();
  });

  it('counts synced transactions across both linked accounts and credit cards, filtering errored', async () => {
    const connection = BankConnection.create({
      id: 'conn-1',
      userId: USER_A,
      pluggyItemId: 'item-1',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await repo.create(connection);

    const account = LinkedAccount.create({
      id: 'acc-1',
      bankConnectionId: 'conn-1',
      userId: USER_A,
      pluggyAccountId: 'pluggy-acc-1',
      type: 'CHECKING_ACCOUNT',
      displayName: 'Conta corrente',
      balance: '100.00',
    });
    await repo.upsertLinkedAccount(account);

    const card = LinkedCreditCard.create({
      id: 'card-1',
      bankConnectionId: 'conn-1',
      userId: USER_A,
      pluggyAccountId: 'pluggy-card-1',
      currentBalance: '-200.00',
    });
    await repo.upsertLinkedCreditCard(card);

    await repo.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        syncStatus: 'success',
      }),
    );
    await repo.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-2',
        pluggyTransactionId: 'tx-2',
        linkedAccountId: null,
        linkedCreditCardId: 'card-1',
        syncStatus: 'error',
      }),
    );
    await repo.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-3',
        pluggyTransactionId: 'tx-3',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );

    const counts = await repo.countSyncedTransactions('conn-1');

    expect(counts).toEqual({ total: 3, errored: 2 });
  });

  it('excludes transactions belonging to a different connection', async () => {
    const connectionA = BankConnection.create({
      id: 'conn-a',
      userId: USER_A,
      pluggyItemId: 'item-a',
      institutionId: 'inst-a',
      institutionName: 'Banco A',
    });
    const connectionB = BankConnection.create({
      id: 'conn-b',
      userId: USER_A,
      pluggyItemId: 'item-b',
      institutionId: 'inst-b',
      institutionName: 'Banco B',
    });
    await repo.create(connectionA);
    await repo.create(connectionB);

    const accountA = LinkedAccount.create({
      id: 'acc-a',
      bankConnectionId: 'conn-a',
      userId: USER_A,
      pluggyAccountId: 'pluggy-acc-a',
      type: 'CHECKING_ACCOUNT',
      displayName: 'Conta A',
      balance: '100.00',
    });
    const accountB = LinkedAccount.create({
      id: 'acc-b',
      bankConnectionId: 'conn-b',
      userId: USER_A,
      pluggyAccountId: 'pluggy-acc-b',
      type: 'CHECKING_ACCOUNT',
      displayName: 'Conta B',
      balance: '100.00',
    });
    await repo.upsertLinkedAccount(accountA);
    await repo.upsertLinkedAccount(accountB);

    await repo.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-a',
        pluggyTransactionId: 'tx-a',
        linkedAccountId: 'acc-a',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );
    await repo.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-b',
        pluggyTransactionId: 'tx-b',
        linkedAccountId: 'acc-b',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );

    const counts = await repo.countSyncedTransactions('conn-a');

    expect(counts).toEqual({ total: 1, errored: 1 });
  });

  it('returns zero counts for a connection with no synced transactions', async () => {
    const connection = BankConnection.create({
      id: 'conn-empty',
      userId: USER_A,
      pluggyItemId: 'item-empty',
      institutionId: 'inst-empty',
      institutionName: 'Banco Vazio',
    });
    await repo.create(connection);

    const counts = await repo.countSyncedTransactions('conn-empty');

    expect(counts).toEqual({ total: 0, errored: 0 });
  });
});
