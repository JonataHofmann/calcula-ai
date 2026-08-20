import { DataSource } from 'typeorm';
import { BankConnection } from '../../domain/bank-connection';
import { SyncConnectionUseCase } from '../../application/use-cases/sync-connection/sync-connection';
import { FakePluggyClient, FakeTransactionsImporter } from '../../application/use-cases/test-fakes';
import { BankConnectionEntity } from '../persistence/entities/bank-connection.entity';
import { LinkedAccountEntity } from '../persistence/entities/linked-account.entity';
import { LinkedCreditCardEntity } from '../persistence/entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from '../persistence/entities/synced-transaction.entity';
import { TypeOrmBankConnectionRepository } from '../persistence/repositories/bank-connection.repository';
import { DailySyncJob } from './daily-sync.job';

/**
 * Integration test against a real Postgres — the stale-connection query only matters
 * against the real driver. Gated behind TEST_DATABASE_URL so `pnpm test` stays green
 * without a database; set it (e.g. the dev compose DB) to run.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';

function makeConnection(overrides: {
  id: string;
  pluggyItemId: string;
  status?: 'active' | 'needs_attention' | 'disconnected';
}) {
  const connection = BankConnection.create({
    id: overrides.id,
    userId: USER_A,
    pluggyItemId: overrides.pluggyItemId,
    institutionId: 'inst-1',
    institutionName: 'Banco Teste',
  });
  if (overrides.status === 'needs_attention') connection.markNeedsAttention();
  if (overrides.status === 'disconnected') connection.disconnect();
  return connection;
}

maybe('DailySyncJob (integration)', () => {
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
    await dataSource.getRepository(BankConnectionEntity).clear();
  });

  async function withLastSyncedAt(connection: BankConnection, lastSyncedAt: Date | null) {
    await repo.create(connection);
    if (lastSyncedAt !== null) {
      await dataSource
        .getRepository(BankConnectionEntity)
        .update({ id: connection.id }, { lastSyncedAt });
    }
  }

  it('only force-refreshes active connections never synced or stale beyond 20h', async () => {
    const neverSynced = makeConnection({ id: crypto.randomUUID(), pluggyItemId: 'item-never' });
    const staleSynced = makeConnection({ id: crypto.randomUUID(), pluggyItemId: 'item-stale' });
    const freshSynced = makeConnection({ id: crypto.randomUUID(), pluggyItemId: 'item-fresh' });
    const needsAttention = makeConnection({
      id: crypto.randomUUID(),
      pluggyItemId: 'item-attention',
      status: 'needs_attention',
    });

    const now = Date.now();
    await withLastSyncedAt(neverSynced, null);
    await withLastSyncedAt(staleSynced, new Date(now - 21 * 60 * 60 * 1000));
    await withLastSyncedAt(freshSynced, new Date(now - 1 * 60 * 60 * 1000));
    await withLastSyncedAt(needsAttention, null);

    const pluggy = new FakePluggyClient();
    for (const item of ['item-never', 'item-stale', 'item-fresh', 'item-attention']) {
      pluggy.addItem(item, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Teste' });
    }
    const syncConnection = new SyncConnectionUseCase(repo, pluggy, new FakeTransactionsImporter());
    const job = new DailySyncJob(repo, pluggy, syncConnection);

    await job.run();

    expect(pluggy.forceRefreshCalls.sort()).toEqual(['item-never', 'item-stale']);
  });
});
