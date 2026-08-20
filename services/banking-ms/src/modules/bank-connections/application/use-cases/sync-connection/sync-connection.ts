import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BANKS, CARD_BRANDS, isCardBrandId } from '@finance/contracts';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { LinkedAccount } from '../../../domain/linked-account';
import { LinkedCreditCard } from '../../../domain/linked-credit-card';
import { fromCents } from '../../../domain/money';
import {
  PLUGGY_CLIENT,
  type PluggyAccount,
  type PluggyClient,
  type PluggyTransaction,
} from '../../../domain/pluggy-client.port';
import { SyncedTransaction, type PluggySourceSnapshot } from '../../../domain/synced-transaction';
import {
  TRANSACTIONS_IMPORTER,
  type TransactionsImporter,
} from '../../../domain/transactions-importer.port';

const SYNC_LOOKBACK_DAYS = 90;

/**
 * Some Pluggy connectors report `installmentNumber`/`totalInstallments` as `0` (or only one of
 * the pair, or `installmentNumber > totalInstallments` after a renegotiation/reprocessing) for
 * card purchases instead of a clean `1..count` pair. The domain requires both fields null
 * together or a valid `1..count` pair (transaction.ts assertInstallmentPair), so any incomplete
 * or out-of-range pair is treated as "no installment metadata" rather than passed through as-is —
 * this metadata is informational only, never authoritative over the transaction's validity.
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

@Injectable()
export class SyncConnectionUseCase {
  private readonly logger = new Logger(SyncConnectionUseCase.name);

  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
    @Inject(TRANSACTIONS_IMPORTER) private readonly importer: TransactionsImporter,
  ) {}

  async execute(input: SyncConnectionInput): Promise<SyncConnectionResult> {
    const connection = await this.connections.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);

    const item = await this.pluggy.getItem(connection.pluggyItemId);
    if (item.status === 'LOGIN_ERROR' || item.status === 'ERROR' || item.status === 'WAITING_USER_INPUT') {
      connection.markNeedsAttention();
    } else if (item.status === 'UPDATED') {
      connection.markActive();
    }

    const [existingAccounts, existingCards] = await Promise.all([
      this.connections.findLinkedAccountsByConnection(connection.id),
      this.connections.findLinkedCreditCardsByConnection(connection.id),
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
          await this.connections.upsertLinkedAccount(account);
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
          await this.connections.upsertLinkedCreditCard(card);
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
    await this.connections.save(connection);

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
    await this.connections.upsertLinkedAccount(account);
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
    await this.connections.upsertLinkedCreditCard(card);
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
      const existing = await this.connections.findSyncedTransactionByPluggyId(userId, tx.id);

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
        await this.connections.upsertSyncedTransaction(existing);
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
      await this.connections.upsertSyncedTransaction(synced);
    }

    const allSynced = await this.connections.findSyncedTransactionsByOrigin(linkedAccountId, linkedCreditCardId);
    for (const row of allSynced) {
      if (row.syncStatus === 'success' && !seenPluggyIds.has(row.pluggyTransactionId)) {
        await this.importer.deleteTransaction(userId, row.pluggyTransactionId);
        await this.connections.deleteSyncedTransaction(row.id);
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
