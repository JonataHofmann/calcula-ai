import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BANKS,
  isCardBrandId,
  type BankConnectionStatus,
  type LinkedAccountType,
  type SyncStatus,
} from '@finance/contracts';
import { BankConnection, type BankConnectionProps } from './bank-connection';
import {
  ConnectionNotActiveError,
  ConnectionNotFoundError,
  DuplicateConnectionError,
  ImportRetriesExhaustedError,
} from './errors';
import { LinkedAccount, type LinkedAccountProps } from './linked-account';
import { LinkedCreditCard, type LinkedCreditCardProps } from './linked-credit-card';
import { fromCents } from './money';
import { SyncedTransaction, type PluggySourceSnapshot } from './synced-transaction';
import {
  PLUGGY_CLIENT,
  type PluggyAccount,
  type PluggyClient,
  type PluggyTransaction,
} from './pluggy-client.port';
import { TRANSACTIONS_IMPORTER, type TransactionsImporter } from './transactions-importer.port';
import { BankConnectionEntity } from './entities/bank-connection.entity';
import { LinkedAccountEntity } from './entities/linked-account.entity';
import { LinkedCreditCardEntity } from './entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from './entities/synced-transaction.entity';

/** Retry budget for a single `synced_transaction` row before it's treated as permanently failed (FR-012). */
export const RETRY_LIMIT = 5;
/** Base delay for the exponential backoff: `BASE_BACKOFF_MINUTES * 2 ** (retryCount - 1)`. */
export const BASE_BACKOFF_MINUTES = 10;
/** A connection not synced within this many hours is picked up by the daily sync job. */
export const STALE_SYNC_THRESHOLD_HOURS = 20;

const SYNC_LOOKBACK_DAYS = 90;

/** Events that warrant a full re-sync of the connection (accounts, cards, and transaction reconciliation). */
const SYNCABLE_EVENTS = new Set([
  'item/created',
  'item/updated',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
]);

export interface CreateConnectTokenInput {
  userId: string;
  mode: 'create' | 'reauth';
  bankConnectionId?: string;
}

export interface ListSyncedTransactionsInput {
  userId: string;
  syncStatus?: SyncStatus;
}

export interface CreateConnectTokenResult {
  connectToken: string;
  expiresAt: Date;
}

export interface CompleteConnectionInput {
  userId: string;
  pluggyItemId: string;
}

export type CompleteConnectionResult = BankConnectionProps;

export interface ListConnectionsInput {
  userId: string;
}

export type ListConnectionsResult = BankConnectionProps & {
  accounts: LinkedAccountProps[];
  creditCards: LinkedCreditCardProps[];
  transactionsTotal: number;
  transactionsErrored: number;
};

export interface DisconnectConnectionInput {
  id: string;
  userId: string;
}

export interface TriggerManualRefreshInput {
  userId: string;
  bankConnectionId: string;
  forceFullSync?: boolean;
}

export interface SyncConnectionInput {
  userId: string;
  bankConnectionId: string;
  /** Ignores `lastSyncedAt` and re-pulls the full SYNC_LOOKBACK_DAYS window. */
  forceFullSync?: boolean;
}

export interface SyncConnectionResult {
  accountsSynced: number;
  creditCardsSynced: number;
  transactionsImported: number;
  transactionsFailed: number;
}

export interface RetryFailedImportsInput {
  synced: SyncedTransaction;
  now?: Date;
  /** Bypasses the exponential backoff gate for manual/on-demand retries. */
  force?: boolean;
}

export interface RetryConnectionImportsInput {
  userId: string;
  bankConnectionId: string;
}

export interface RetryConnectionImportsResult {
  retried: number;
  succeeded: number;
  stillFailing: number;
}

export interface PluggyWebhookPayload {
  event: string;
  itemId?: string;
}

/**
 * Owns every persistence and business operation for a bank connection aggregate
 * (bank_connection + linked accounts/cards + synced transactions), plus the Pluggy
 * sync, retry, and webhook flows. Repositories are injected directly; there is no
 * separate repository class (FR — flat NestJS convention).
 */
@Injectable()
export class BankConnectionsService {
  private readonly logger = new Logger(BankConnectionsService.name);

  constructor(
    @InjectRepository(BankConnectionEntity)
    private readonly connectionRepo: Repository<BankConnectionEntity>,
    @InjectRepository(LinkedAccountEntity)
    private readonly accountRepo: Repository<LinkedAccountEntity>,
    @InjectRepository(LinkedCreditCardEntity)
    private readonly cardRepo: Repository<LinkedCreditCardEntity>,
    @InjectRepository(SyncedTransactionEntity)
    private readonly transactionRepo: Repository<SyncedTransactionEntity>,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
    @Inject(TRANSACTIONS_IMPORTER) private readonly importer: TransactionsImporter,
  ) {}

  // ---------------------------------------------------------------------------
  // Persistence (bank_connection + linked accounts/cards + synced transactions)
  // ---------------------------------------------------------------------------

  async create(connection: BankConnection): Promise<void> {
    await this.connectionRepo.insert(toConnectionEntity(connection));
  }

  async save(connection: BankConnection): Promise<void> {
    await this.connectionRepo.save(toConnectionEntity(connection));
  }

  async findById(id: string, userId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { id, userId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findByUserAndItem(userId: string, pluggyItemId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { userId, pluggyItemId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findByItemId(pluggyItemId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { pluggyItemId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findAllByUser(userId: string): Promise<BankConnection[]> {
    const rows = await this.connectionRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toConnectionDomain);
  }

  async findStaleActiveConnections(threshold: Date): Promise<BankConnection[]> {
    const rows = await this.connectionRepo.find({ where: { status: 'active' } });
    return rows
      .filter((row) => !row.lastSyncedAt || row.lastSyncedAt.getTime() < threshold.getTime())
      .map(toConnectionDomain);
  }

  async countSyncedTransactions(
    bankConnectionId: string,
  ): Promise<{ total: number; errored: number }> {
    const [accounts, cards] = await Promise.all([
      this.accountRepo.find({ where: { bankConnectionId } }),
      this.cardRepo.find({ where: { bankConnectionId } }),
    ]);
    const perOrigin = await Promise.all([
      ...accounts.map((a) => this.transactionRepo.find({ where: { linkedAccountId: a.id } })),
      ...cards.map((c) => this.transactionRepo.find({ where: { linkedCreditCardId: c.id } })),
    ]);
    const rows = perOrigin.flat();
    return { total: rows.length, errored: rows.filter((t) => t.syncStatus === 'error').length };
  }

  async upsertLinkedAccount(account: LinkedAccount): Promise<void> {
    await this.accountRepo.upsert(toAccountEntity(account), ['bankConnectionId', 'pluggyAccountId']);
  }

  async upsertLinkedCreditCard(card: LinkedCreditCard): Promise<void> {
    await this.cardRepo.upsert(toCardEntity(card), ['bankConnectionId', 'pluggyAccountId']);
  }

  async findLinkedAccountsByConnection(bankConnectionId: string): Promise<LinkedAccount[]> {
    const rows = await this.accountRepo.find({ where: { bankConnectionId } });
    return rows.map(toAccountDomain);
  }

  async findLinkedCreditCardsByConnection(bankConnectionId: string): Promise<LinkedCreditCard[]> {
    const rows = await this.cardRepo.find({ where: { bankConnectionId } });
    return rows.map(toCardDomain);
  }

  async findBankConnectionIdForOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<string | null> {
    if (linkedAccountId) {
      const row = await this.accountRepo.findOne({ where: { id: linkedAccountId } });
      return row?.bankConnectionId ?? null;
    }
    if (linkedCreditCardId) {
      const row = await this.cardRepo.findOne({ where: { id: linkedCreditCardId } });
      return row?.bankConnectionId ?? null;
    }
    return null;
  }

  async upsertSyncedTransaction(transaction: SyncedTransaction): Promise<void> {
    await this.transactionRepo.upsert(toTransactionEntity(transaction), ['userId', 'pluggyTransactionId']);
  }

  async findSyncedTransactionByPluggyId(
    userId: string,
    pluggyTransactionId: string,
  ): Promise<SyncedTransaction | null> {
    const row = await this.transactionRepo.findOne({ where: { userId, pluggyTransactionId } });
    return row ? toTransactionDomain(row) : null;
  }

  async findErroredSyncedTransactions(retryLimit: number): Promise<SyncedTransaction[]> {
    const rows = await this.transactionRepo.find({ where: { syncStatus: 'error' } });
    return rows.filter((row) => row.retryCount < retryLimit).map(toTransactionDomain);
  }

  async deleteSyncedTransaction(id: string): Promise<void> {
    await this.transactionRepo.delete({ id });
  }

  async findSyncedTransactionsByOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<SyncedTransaction[]> {
    const where = linkedAccountId !== null ? { linkedAccountId } : { linkedCreditCardId: linkedCreditCardId! };
    const rows = await this.transactionRepo.find({ where });
    return rows
      .filter(
        (row) => row.linkedAccountId === linkedAccountId && row.linkedCreditCardId === linkedCreditCardId,
      )
      .map(toTransactionDomain);
  }

  /**
   * Lists a user's synced (imported) transactions newest-first, optionally narrowed to one
   * sync status (R8). Scoped by `userId` so a caller only ever sees their own import rows.
   */
  async listSyncedTransactions(input: ListSyncedTransactionsInput): Promise<SyncedTransaction[]> {
    const where = input.syncStatus
      ? { userId: input.userId, syncStatus: input.syncStatus }
      : { userId: input.userId };
    const rows = await this.transactionRepo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map(toTransactionDomain);
  }

  // ---------------------------------------------------------------------------
  // Business operations
  // ---------------------------------------------------------------------------

  async createConnectToken(input: CreateConnectTokenInput): Promise<CreateConnectTokenResult> {
    this.logger.log(`Creating connect token (mode=${input.mode}) for user ${input.userId}`);
    const itemId = await this.resolveConnectTokenItemId(input);
    const token = await this.pluggy.createConnectToken({ itemId });
    return { connectToken: token.connectToken, expiresAt: token.expiresAt };
  }

  private async resolveConnectTokenItemId(
    input: CreateConnectTokenInput,
  ): Promise<string | undefined> {
    if (input.mode === 'create') return undefined;

    const connection = await this.findById(input.bankConnectionId!, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId!);
    return connection.pluggyItemId;
  }

  async completeConnection(input: CompleteConnectionInput): Promise<CompleteConnectionResult> {
    const existing = await this.findByUserAndItem(input.userId, input.pluggyItemId);
    if (existing) throw new DuplicateConnectionError(input.pluggyItemId);

    const item = await this.pluggy.getItem(input.pluggyItemId);
    const connection = BankConnection.create({
      id: randomUUID(),
      userId: input.userId,
      pluggyItemId: input.pluggyItemId,
      institutionId: item.institutionId,
      institutionName: item.institutionName,
    });
    await this.create(connection);
    this.logger.log(`Created bank connection ${connection.id} for user ${input.userId}`);

    // Fire-and-forget: the caller doesn't wait on the full account/transaction sync (AGENTS.md rule 8).
    void this.syncConnection({ userId: input.userId, bankConnectionId: connection.id }).catch(
      (error: Error) => {
        this.logger.error(`Initial sync failed for connection ${connection.id}: ${error.message}`);
      },
    );

    return connection.toProps();
  }

  async listConnections(input: ListConnectionsInput): Promise<ListConnectionsResult[]> {
    const connections = await this.findAllByUser(input.userId);
    return Promise.all(
      connections.map(async (connection) => {
        const props = connection.toProps();
        const [accounts, creditCards, counts] = await Promise.all([
          this.findLinkedAccountsByConnection(props.id),
          this.findLinkedCreditCardsByConnection(props.id),
          this.countSyncedTransactions(props.id),
        ]);
        return {
          ...props,
          accounts: accounts.map((a) => a.toProps()),
          creditCards: creditCards.map((c) => c.toProps()),
          transactionsTotal: counts.total,
          transactionsErrored: counts.errored,
        };
      }),
    );
  }

  async disconnectConnection(input: DisconnectConnectionInput): Promise<void> {
    const connection = await this.findById(input.id, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.id);
    connection.disconnect();
    await this.save(connection);
    this.logger.log(`Disconnected bank connection ${input.id}`);
  }

  async triggerManualRefresh(input: TriggerManualRefreshInput): Promise<void> {
    const connection = await this.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);
    if (connection.status !== 'active') throw new ConnectionNotActiveError(input.bankConnectionId);

    await this.pluggy.forceRefreshItem(connection.pluggyItemId);

    // Fire-and-forget: the caller doesn't wait on the full account/transaction sync (AGENTS.md rule 8).
    void this.syncConnection({
      userId: input.userId,
      bankConnectionId: connection.id,
      forceFullSync: input.forceFullSync,
    }).catch(() => undefined);
  }

  async syncConnection(input: SyncConnectionInput): Promise<SyncConnectionResult> {
    const connection = await this.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);

    const item = await this.pluggy.getItem(connection.pluggyItemId);
    if (item.status === 'LOGIN_ERROR' || item.status === 'ERROR' || item.status === 'WAITING_USER_INPUT') {
      connection.markNeedsAttention();
    } else if (item.status === 'UPDATED') {
      connection.markActive();
    }

    const [existingAccounts, existingCards] = await Promise.all([
      this.findLinkedAccountsByConnection(connection.id),
      this.findLinkedCreditCardsByConnection(connection.id),
    ]);
    const accountsByPluggyId = new Map(existingAccounts.map((a) => [a.pluggyAccountId, a]));
    const cardsByPluggyId = new Map(existingCards.map((c) => [c.pluggyAccountId, c]));

    const pluggyAccounts = await this.pluggy.listAccounts(connection.pluggyItemId);
    const from = input.forceFullSync ? daysAgo(SYNC_LOOKBACK_DAYS) : (connection.lastSyncedAt ?? daysAgo(SYNC_LOOKBACK_DAYS));

    let accountsSynced = 0;
    let creditCardsSynced = 0;
    let transactionsImported = 0;
    let transactionsFailed = 0;

    for (const pa of pluggyAccounts) {
      try {
        if (pa.type === 'BANK') {
          const account = this.syncLinkedAccount(connection.id, connection.userId, pa, accountsByPluggyId.get(pa.id));
          await this.upsertLinkedAccount(account);
          await this.ensureApiAccount(account, pa, connection.institutionName);
          accountsSynced += 1;

          const result = await this.syncTransactions(
            connection.userId,
            pa,
            from,
            account.id,
            null,
            account.apiAccountId,
            null,
          );
          transactionsImported += result.imported;
          transactionsFailed += result.failed;
        } else {
          const card = this.syncLinkedCreditCard(connection.id, connection.userId, pa, cardsByPluggyId.get(pa.id));
          await this.upsertLinkedCreditCard(card);
          await this.ensureApiCreditCard(card, pa);
          creditCardsSynced += 1;

          const result = await this.syncTransactions(
            connection.userId,
            pa,
            from,
            null,
            card.id,
            null,
            card.apiCreditCardId,
          );
          transactionsImported += result.imported;
          transactionsFailed += result.failed;
        }
      } catch (error) {
        this.logger.error(
          `Failed to sync ${pa.type === 'BANK' ? 'account' : 'credit card'} ${pa.id} on connection ${connection.id}: ${(error as Error).message}`,
        );
      }
    }

    connection.recordSync();
    await this.save(connection);

    return { accountsSynced, creditCardsSynced, transactionsImported, transactionsFailed };
  }

  private syncLinkedAccount(
    bankConnectionId: string,
    userId: string,
    pa: PluggyAccount,
    existing: LinkedAccount | undefined,
  ): LinkedAccount {
    const balance = fromCents(Math.round(pa.balance * 100));
    if (existing) {
      existing.updateSnapshot({ displayName: pa.name, balance });
      return existing;
    }
    return LinkedAccount.create({
      id: randomUUID(),
      bankConnectionId,
      userId,
      pluggyAccountId: pa.id,
      type: 'CHECKING_ACCOUNT',
      displayName: pa.name,
      balance,
    });
  }

  private syncLinkedCreditCard(
    bankConnectionId: string,
    userId: string,
    pa: PluggyAccount,
    existing: LinkedCreditCard | undefined,
  ): LinkedCreditCard {
    const currentBalance = fromCents(Math.round(pa.balance * 100));
    const creditData = pa.creditData;
    const creditLimit = creditData?.creditLimit != null ? fromCents(Math.round(creditData.creditLimit * 100)) : null;
    const availableLimit =
      creditData?.availableCreditLimit != null
        ? fromCents(Math.round(creditData.availableCreditLimit * 100))
        : null;
    const closingDate = creditData?.balanceCloseDate ? new Date(creditData.balanceCloseDate) : null;
    const dueDate = creditData?.balanceDueDate ? new Date(creditData.balanceDueDate) : null;

    if (existing) {
      existing.updateSnapshot({ currentBalance, creditLimit, availableLimit, closingDate, dueDate });
      return existing;
    }
    return LinkedCreditCard.create({
      id: randomUUID(),
      bankConnectionId,
      userId,
      pluggyAccountId: pa.id,
      brand: creditData?.brand ?? null,
      lastDigits: lastFourDigits(pa.number),
      creditLimit,
      availableLimit,
      currentBalance,
      closingDate,
      dueDate,
    });
  }

  /** Materializes the real services/api `Account` for a Pluggy bank account, once per account (idempotent). */
  private async ensureApiAccount(account: LinkedAccount, pa: PluggyAccount, institutionName: string): Promise<void> {
    if (account.apiAccountId) return;
    const { id } = await this.importer.createSyncedAccount({
      userId: account.userId,
      pluggyAccountId: pa.id,
      name: pa.name,
      bankId: matchBankId(institutionName),
      icon: 'landmark',
      color: 'slate',
    });
    account.linkApiAccount(id);
    await this.upsertLinkedAccount(account);
  }

  /** Materializes the real services/api `CreditCard` for a Pluggy credit card, once per card (idempotent). */
  private async ensureApiCreditCard(card: LinkedCreditCard, pa: PluggyAccount): Promise<void> {
    if (card.apiCreditCardId) return;
    const { id } = await this.importer.createSyncedCard({
      userId: card.userId,
      pluggyAccountId: pa.id,
      name: pa.name,
      lastDigits: card.lastDigits ?? '0000',
      dueDay: dayOfMonth(card.dueDate),
      closingDay: dayOfMonth(card.closingDate),
      limit: card.creditLimit ?? '0',
      brandId: matchCardBrand(card.brand),
    });
    card.linkApiCreditCard(id);
    await this.upsertLinkedCreditCard(card);
  }

  /**
   * Reconciles every Pluggy transaction in the lookback window against stored copies (FR-011):
   * new ids are imported, changed ids are patched in place (never duplicated), and ids that
   * disappeared from the source are removed here and in Transactions MS.
   */
  private async syncTransactions(
    userId: string,
    pa: PluggyAccount,
    from: Date,
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
    apiAccountId: string | null,
    apiCreditCardId: string | null,
  ): Promise<{ imported: number; failed: number }> {
    const transactions = await this.pluggy.listTransactions(pa.id, from);
    let imported = 0;
    let failed = 0;
    const seenPluggyIds = new Set<string>();

    for (const tx of transactions) {
      seenPluggyIds.add(tx.id);
      const existing = await this.findSyncedTransactionByPluggyId(userId, tx.id);

      if (existing?.syncStatus === 'success') {
        const patch = existing.reconcileWithSource(this.toSourceSnapshot(tx));
        if (!patch) continue;

        const transactionsMsId = existing.transactionsMsId as string;
        existing.retry();
        existing.startProcessing();
        try {
          await this.importer.updateTransaction({ userId, pluggyTransactionId: tx.id, ...patch });
          existing.markSuccess(transactionsMsId);
        } catch (err) {
          existing.markError(err instanceof Error ? err.message : String(err));
          failed += 1;
        }
        await this.upsertSyncedTransaction(existing);
        continue;
      }

      const synced = this.buildSyncedTransaction(userId, tx, linkedAccountId, linkedCreditCardId, existing);
      synced.startProcessing();
      try {
        const installments = normalizeInstallmentPair(tx.creditCardMetadata);
        const { transactionsMsId } = await this.importer.importTransaction({
          userId,
          pluggyTransactionId: tx.id,
          description: tx.description,
          amount: fromCents(Math.abs(Math.round(tx.amount * 100))),
          dueDate: new Date(tx.date),
          type: tx.type === 'DEBIT' ? 'expense' : 'income',
          accountId: apiAccountId,
          creditCardId: apiCreditCardId,
          installmentNumber: installments.installmentNumber,
          installmentCount: installments.installmentCount,
          pluggyStatus: tx.status === 'POSTED' ? 'posted' : 'pending',
        });
        synced.markSuccess(transactionsMsId);
        imported += 1;
      } catch (err) {
        synced.markError(err instanceof Error ? err.message : String(err));
        failed += 1;
      }
      await this.upsertSyncedTransaction(synced);
    }

    const allSynced = await this.findSyncedTransactionsByOrigin(linkedAccountId, linkedCreditCardId);
    for (const row of allSynced) {
      if (row.syncStatus === 'success' && !seenPluggyIds.has(row.pluggyTransactionId)) {
        await this.importer.deleteTransaction(userId, row.pluggyTransactionId);
        await this.deleteSyncedTransaction(row.id);
      }
    }

    return { imported, failed };
  }

  private toSourceSnapshot(tx: PluggyTransaction): PluggySourceSnapshot {
    const installments = normalizeInstallmentPair(tx.creditCardMetadata);
    return {
      description: tx.description,
      amount: fromCents(Math.abs(Math.round(tx.amount * 100))),
      date: new Date(tx.date),
      pluggyStatus: tx.status === 'POSTED' ? 'posted' : 'pending',
      installmentNumber: installments.installmentNumber,
      installmentTotal: installments.installmentCount,
    };
  }

  private buildSyncedTransaction(
    userId: string,
    tx: PluggyTransaction,
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
    existing: SyncedTransaction | null,
  ): SyncedTransaction {
    if (existing) return existing;
    const installments = normalizeInstallmentPair(tx.creditCardMetadata);
    return SyncedTransaction.create({
      id: randomUUID(),
      linkedAccountId,
      linkedCreditCardId,
      userId,
      pluggyTransactionId: tx.id,
      description: tx.description,
      amount: fromCents(Math.abs(Math.round(tx.amount * 100))),
      date: new Date(tx.date),
      direction: tx.type === 'CREDIT' ? 'credit' : 'debit',
      pluggyStatus: tx.status === 'POSTED' ? 'posted' : 'pending',
      installmentNumber: installments.installmentNumber,
      installmentTotal: installments.installmentCount,
    });
  }

  /**
   * Retries one errored `synced_transaction` row in place (never creates a duplicate, R6).
   * Skips rows not yet due per the exponential backoff. On exhausting the retry budget, flags
   * the owning bank_connection as `needs_attention` (FR-012) and raises ImportRetriesExhaustedError
   * so the caller (the retry job) can log it — the row itself stays `error` for manual follow-up.
   */
  async retryFailedImports(input: RetryFailedImportsInput): Promise<void> {
    const { synced } = input;
    const now = input.now ?? new Date();
    if (!input.force && !isDueForRetry(synced, now)) return;

    const { apiAccountId, apiCreditCardId } = await this.resolveApiLinkage(synced);

    synced.retry(now);
    synced.startProcessing(now);
    try {
      const { transactionsMsId } = await this.importer.importTransaction({
        userId: synced.userId,
        pluggyTransactionId: synced.pluggyTransactionId,
        description: synced.description,
        amount: synced.amount,
        dueDate: synced.date,
        type: synced.direction === 'credit' ? 'income' : 'expense',
        accountId: apiAccountId,
        creditCardId: apiCreditCardId,
        installmentNumber: synced.installmentNumber,
        installmentCount: synced.installmentTotal,
        pluggyStatus: synced.pluggyStatus,
      });
      synced.markSuccess(transactionsMsId, now);
      await this.upsertSyncedTransaction(synced);
      return;
    } catch (err) {
      synced.markError(err instanceof Error ? err.message : String(err), now);
      await this.upsertSyncedTransaction(synced);
    }

    if (synced.hasReachedRetryLimit(RETRY_LIMIT)) {
      await this.flagConnectionNeedsAttention(synced);
      throw new ImportRetriesExhaustedError(synced.pluggyTransactionId);
    }
  }

  private async resolveApiLinkage(
    synced: SyncedTransaction,
  ): Promise<{ apiAccountId: string | null; apiCreditCardId: string | null }> {
    const bankConnectionId = await this.findBankConnectionIdForOrigin(
      synced.linkedAccountId,
      synced.linkedCreditCardId,
    );
    if (!bankConnectionId) return { apiAccountId: null, apiCreditCardId: null };

    if (synced.linkedAccountId) {
      const accounts = await this.findLinkedAccountsByConnection(bankConnectionId);
      const apiAccountId = accounts.find((a) => a.id === synced.linkedAccountId)?.apiAccountId ?? null;
      return { apiAccountId, apiCreditCardId: null };
    }
    if (synced.linkedCreditCardId) {
      const cards = await this.findLinkedCreditCardsByConnection(bankConnectionId);
      const apiCreditCardId = cards.find((c) => c.id === synced.linkedCreditCardId)?.apiCreditCardId ?? null;
      return { apiAccountId: null, apiCreditCardId };
    }
    return { apiAccountId: null, apiCreditCardId: null };
  }

  private async flagConnectionNeedsAttention(synced: SyncedTransaction): Promise<void> {
    const bankConnectionId = await this.findBankConnectionIdForOrigin(
      synced.linkedAccountId,
      synced.linkedCreditCardId,
    );
    if (!bankConnectionId) return;
    const connection = await this.findById(bankConnectionId, synced.userId);
    if (!connection) return;
    connection.markNeedsAttention();
    await this.save(connection);
  }

  /** Manually retries every currently-`error` synced_transaction for one connection, bypassing the backoff gate. */
  async retryConnectionImports(input: RetryConnectionImportsInput): Promise<RetryConnectionImportsResult> {
    const connection = await this.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);

    const [accounts, cards] = await Promise.all([
      this.findLinkedAccountsByConnection(connection.id),
      this.findLinkedCreditCardsByConnection(connection.id),
    ]);
    const origins = [
      ...accounts.map((a) => ({ linkedAccountId: a.id as string | null, linkedCreditCardId: null as string | null })),
      ...cards.map((c) => ({ linkedAccountId: null as string | null, linkedCreditCardId: c.id as string | null })),
    ];

    const errored = (
      await Promise.all(
        origins.map((o) => this.findSyncedTransactionsByOrigin(o.linkedAccountId, o.linkedCreditCardId)),
      )
    )
      .flat()
      .filter((t) => t.syncStatus === 'error');

    let succeeded = 0;
    for (const synced of errored) {
      try {
        await this.retryFailedImports({ synced, force: true });
        if (synced.syncStatus === 'success') succeeded++;
      } catch (err) {
        if (!(err instanceof ImportRetriesExhaustedError)) throw err;
      }
    }
    return { retried: errored.length, succeeded, stillFailing: errored.length - succeeded };
  }

  /** Picks up every active connection that is stale (never synced or beyond the threshold) and re-syncs it. */
  async syncStaleConnections(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_SYNC_THRESHOLD_HOURS * 60 * 60 * 1000);
    const stale = await this.findStaleActiveConnections(threshold);

    for (const connection of stale) {
      try {
        await this.pluggy.forceRefreshItem(connection.pluggyItemId);
        await this.syncConnection({ userId: connection.userId, bankConnectionId: connection.id });
      } catch (error) {
        this.logger.warn(`Daily sync failed for connection ${connection.id}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * item/created and item/updated cannot invoke complete-connection: Pluggy's webhook payload
   * carries only itemId, never the userId that flow requires. The actual connection row is always
   * created by the widget-return POST /bank-connections (which does have the user's JWT). So here
   * we just resolve the owner via findByItemId and (re)trigger a sync when the connection already
   * exists; if it doesn't yet (webhook raced ahead of the widget return), we no-op.
   */
  async handleWebhook(payload: PluggyWebhookPayload): Promise<{ received: true }> {
    if (SYNCABLE_EVENTS.has(payload.event) && payload.itemId) {
      const connection = await this.findByItemId(payload.itemId);
      if (connection) {
        await this.syncConnection({ userId: connection.userId, bankConnectionId: connection.id }).catch(
          (error: Error) => {
            this.logger.error(`Webhook-triggered sync failed for connection ${connection.id}: ${error.message}`);
          },
        );
      }
    } else if (payload.event === 'item/error' && payload.itemId) {
      const connection = await this.findByItemId(payload.itemId);
      if (connection) {
        connection.markNeedsAttention();
        await this.save(connection);
      }
    }

    return { received: true };
  }
}

function isDueForRetry(synced: SyncedTransaction, now: Date): boolean {
  const backoffMs = BASE_BACKOFF_MINUTES * 60_000 * 2 ** Math.max(synced.retryCount - 1, 0);
  return now.getTime() - synced.updatedAt.getTime() >= backoffMs;
}

/**
 * Some Pluggy connectors report `installmentNumber`/`totalInstallments` as `0` (or only one of
 * the pair, or `installmentNumber > totalInstallments` after a renegotiation/reprocessing) for
 * card purchases instead of a clean `1..count` pair. The domain requires both fields null
 * together or a valid `1..count` pair (synced-transaction.ts assertInstallmentPair), so any
 * incomplete or out-of-range pair is treated as "no installment metadata" rather than passed
 * through as-is — this metadata is informational only, never authoritative over the transaction.
 */
function normalizeInstallmentPair(metadata: {
  installmentNumber: number | null;
  totalInstallments: number | null;
} | null): { installmentNumber: number | null; installmentCount: number | null } {
  const number = metadata?.installmentNumber;
  const count = metadata?.totalInstallments;
  if (!number || !count || number < 1 || count < 1 || number > count) {
    return { installmentNumber: null, installmentCount: null };
  }
  return { installmentNumber: number, installmentCount: count };
}

function lastFourDigits(number: string | null): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function matchBankId(institutionName: string): string {
  const needle = institutionName.toLowerCase();
  const match = BANKS.find((bank) => needle.includes(bank.name.toLowerCase()));
  return match?.id ?? 'other';
}

function matchCardBrand(brand: string | null): string {
  const candidate = brand?.toLowerCase() ?? '';
  return isCardBrandId(candidate) ? candidate : 'other';
}

function dayOfMonth(date: Date | null): number {
  return date ? date.getDate() : 1;
}

// ---------------------------------------------------------------------------
// Entity <-> domain mappers
// ---------------------------------------------------------------------------

function toConnectionEntity(connection: BankConnection): BankConnectionEntity {
  const props = connection.toProps();
  const entity = new BankConnectionEntity();
  entity.id = props.id;
  entity.userId = props.userId;
  entity.pluggyItemId = props.pluggyItemId;
  entity.institutionId = props.institutionId;
  entity.institutionName = props.institutionName;
  entity.status = props.status;
  entity.lastSyncedAt = props.lastSyncedAt;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toConnectionDomain(row: BankConnectionEntity): BankConnection {
  return BankConnection.restore({
    id: row.id,
    userId: row.userId,
    pluggyItemId: row.pluggyItemId,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    status: row.status as BankConnectionStatus,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toAccountEntity(account: LinkedAccount): LinkedAccountEntity {
  const props = account.toProps();
  const entity = new LinkedAccountEntity();
  entity.id = props.id;
  entity.bankConnectionId = props.bankConnectionId;
  entity.userId = props.userId;
  entity.pluggyAccountId = props.pluggyAccountId;
  entity.type = props.type;
  entity.displayName = props.displayName;
  entity.balance = props.balance;
  entity.currency = props.currency;
  entity.apiAccountId = props.apiAccountId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toAccountDomain(row: LinkedAccountEntity): LinkedAccount {
  return LinkedAccount.restore({
    id: row.id,
    bankConnectionId: row.bankConnectionId,
    userId: row.userId,
    pluggyAccountId: row.pluggyAccountId,
    type: row.type as LinkedAccountType,
    displayName: row.displayName,
    balance: row.balance,
    currency: row.currency as 'BRL',
    apiAccountId: row.apiAccountId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toCardEntity(card: LinkedCreditCard): LinkedCreditCardEntity {
  const props = card.toProps();
  const entity = new LinkedCreditCardEntity();
  entity.id = props.id;
  entity.bankConnectionId = props.bankConnectionId;
  entity.userId = props.userId;
  entity.pluggyAccountId = props.pluggyAccountId;
  entity.brand = props.brand;
  entity.lastDigits = props.lastDigits;
  entity.creditLimit = props.creditLimit;
  entity.availableLimit = props.availableLimit;
  entity.currentBalance = props.currentBalance;
  entity.closingDate = props.closingDate;
  entity.dueDate = props.dueDate;
  entity.apiCreditCardId = props.apiCreditCardId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toCardDomain(row: LinkedCreditCardEntity): LinkedCreditCard {
  return LinkedCreditCard.restore({
    id: row.id,
    bankConnectionId: row.bankConnectionId,
    userId: row.userId,
    pluggyAccountId: row.pluggyAccountId,
    brand: row.brand,
    lastDigits: row.lastDigits,
    creditLimit: row.creditLimit,
    availableLimit: row.availableLimit,
    currentBalance: row.currentBalance,
    closingDate: row.closingDate ? new Date(row.closingDate) : null,
    dueDate: row.dueDate ? new Date(row.dueDate) : null,
    apiCreditCardId: row.apiCreditCardId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toTransactionEntity(transaction: SyncedTransaction): SyncedTransactionEntity {
  const props = transaction.toProps();
  const entity = new SyncedTransactionEntity();
  entity.id = props.id;
  entity.linkedAccountId = props.linkedAccountId;
  entity.linkedCreditCardId = props.linkedCreditCardId;
  entity.userId = props.userId;
  entity.pluggyTransactionId = props.pluggyTransactionId;
  entity.description = props.description;
  entity.amount = props.amount;
  entity.date = props.date;
  entity.direction = props.direction;
  entity.pluggyStatus = props.pluggyStatus;
  entity.installmentNumber = props.installmentNumber;
  entity.installmentTotal = props.installmentTotal;
  entity.syncStatus = props.syncStatus;
  entity.transactionsMsId = props.transactionsMsId;
  entity.retryCount = props.retryCount;
  entity.lastError = props.lastError;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toTransactionDomain(row: SyncedTransactionEntity): SyncedTransaction {
  return SyncedTransaction.restore({
    id: row.id,
    linkedAccountId: row.linkedAccountId,
    linkedCreditCardId: row.linkedCreditCardId,
    userId: row.userId,
    pluggyTransactionId: row.pluggyTransactionId,
    description: row.description,
    amount: row.amount,
    date: new Date(row.date),
    direction: row.direction as SyncedTransaction['direction'],
    pluggyStatus: row.pluggyStatus as SyncedTransaction['pluggyStatus'],
    installmentNumber: row.installmentNumber,
    installmentTotal: row.installmentTotal,
    syncStatus: row.syncStatus as SyncStatus,
    transactionsMsId: row.transactionsMsId,
    retryCount: row.retryCount,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
