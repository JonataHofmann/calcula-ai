import type {
  PluggyTransactionStatus,
  SyncedTransactionDirection,
  SyncStatus,
} from '@finance/contracts';
import { InvalidPluggyItemError } from './errors';
import { toCents } from './money';

export interface SyncedTransactionProps {
  id: string;
  linkedAccountId: string | null;
  linkedCreditCardId: string | null;
  userId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  date: Date;
  direction: SyncedTransactionDirection;
  pluggyStatus: PluggyTransactionStatus;
  installmentNumber: number | null;
  installmentTotal: number | null;
  syncStatus: SyncStatus;
  transactionsMsId: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluggySourceSnapshot {
  description: string;
  amount: string;
  date: Date;
  pluggyStatus: PluggyTransactionStatus;
  installmentNumber: number | null;
  installmentTotal: number | null;
}

export interface ReconciliationPatch {
  description?: string;
  amount?: string;
  dueDate?: Date;
  pluggyStatus?: PluggyTransactionStatus;
  installmentNumber?: number | null;
  installmentCount?: number | null;
}

export interface CreateSyncedTransactionData {
  id: string;
  linkedAccountId?: string | null;
  linkedCreditCardId?: string | null;
  userId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  date: Date;
  direction: SyncedTransactionDirection;
  pluggyStatus: PluggyTransactionStatus;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  now?: Date;
}

/**
 * SyncedTransaction aggregate — one row per Pluggy transaction id (idempotency key, R6).
 * Never creates a second row for the same `pluggyTransactionId`; an `error` row is retried in place.
 */
export class SyncedTransaction {
  private constructor(private props: SyncedTransactionProps) {}

  static create(input: CreateSyncedTransactionData): SyncedTransaction {
    const now = input.now ?? new Date();
    assertOrigin(input.linkedAccountId ?? null, input.linkedCreditCardId ?? null);
    assertAmount(input.amount);
    return new SyncedTransaction({
      id: input.id,
      linkedAccountId: input.linkedAccountId ?? null,
      linkedCreditCardId: input.linkedCreditCardId ?? null,
      userId: input.userId,
      pluggyTransactionId: input.pluggyTransactionId,
      description: assertNonEmpty(input.description),
      amount: input.amount,
      date: input.date,
      direction: input.direction,
      pluggyStatus: input.pluggyStatus,
      installmentNumber: input.installmentNumber ?? null,
      installmentTotal: input.installmentTotal ?? null,
      syncStatus: 'pending',
      transactionsMsId: null,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: SyncedTransactionProps): SyncedTransaction {
    return new SyncedTransaction(props);
  }

  startProcessing(now: Date = new Date()): void {
    this.props.syncStatus = 'processing';
    this.props.updatedAt = now;
  }

  markSuccess(transactionsMsId: string, now: Date = new Date()): void {
    this.props.syncStatus = 'success';
    this.props.transactionsMsId = transactionsMsId;
    this.props.lastError = null;
    this.props.updatedAt = now;
  }

  /** Records a failed import attempt in place — never creates a new row for this pluggyTransactionId. */
  markError(message: string, now: Date = new Date()): void {
    this.props.syncStatus = 'error';
    this.props.retryCount += 1;
    this.props.lastError = message;
    this.props.updatedAt = now;
  }

  /** Re-arms an errored row for another attempt by the retry job. */
  retry(now: Date = new Date()): void {
    this.props.syncStatus = 'pending';
    this.props.updatedAt = now;
  }

  /** Caller (retry job) decides the limit and whether to raise ImportRetriesExhaustedError. */
  hasReachedRetryLimit(limit: number): boolean {
    return this.props.retryCount >= limit;
  }

  /**
   * Diffs a fresh Pluggy snapshot against the stored copy; applies changes in place and
   * returns the patch to push to Transactions MS, or null when nothing changed (FR-011).
   */
  reconcileWithSource(next: PluggySourceSnapshot, now: Date = new Date()): ReconciliationPatch | null {
    const patch: ReconciliationPatch = {};
    if (next.description !== this.props.description) patch.description = next.description;
    if (next.amount !== this.props.amount) patch.amount = next.amount;
    if (next.date.getTime() !== this.props.date.getTime()) patch.dueDate = next.date;
    if (next.pluggyStatus !== this.props.pluggyStatus) patch.pluggyStatus = next.pluggyStatus;
    if (next.installmentNumber !== this.props.installmentNumber) {
      patch.installmentNumber = next.installmentNumber;
    }
    if (next.installmentTotal !== this.props.installmentTotal) {
      patch.installmentCount = next.installmentTotal;
    }
    if (Object.keys(patch).length === 0) return null;

    this.props.description = next.description;
    this.props.amount = next.amount;
    this.props.date = next.date;
    this.props.pluggyStatus = next.pluggyStatus;
    this.props.installmentNumber = next.installmentNumber;
    this.props.installmentTotal = next.installmentTotal;
    this.props.updatedAt = now;
    return patch;
  }

  toProps(): SyncedTransactionProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get linkedAccountId(): string | null {
    return this.props.linkedAccountId;
  }

  get linkedCreditCardId(): string | null {
    return this.props.linkedCreditCardId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get pluggyTransactionId(): string {
    return this.props.pluggyTransactionId;
  }

  get description(): string {
    return this.props.description;
  }

  get amount(): string {
    return this.props.amount;
  }

  get date(): Date {
    return this.props.date;
  }

  get direction(): SyncedTransactionDirection {
    return this.props.direction;
  }

  get pluggyStatus(): PluggyTransactionStatus {
    return this.props.pluggyStatus;
  }

  get installmentNumber(): number | null {
    return this.props.installmentNumber;
  }

  get installmentTotal(): number | null {
    return this.props.installmentTotal;
  }

  get syncStatus(): SyncStatus {
    return this.props.syncStatus;
  }

  get transactionsMsId(): string | null {
    return this.props.transactionsMsId;
  }

  get retryCount(): number {
    return this.props.retryCount;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertNonEmpty(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvalidPluggyItemError('description must not be empty');
  return trimmed;
}

function assertAmount(amount: string): void {
  if (toCents(amount) <= 0) throw new InvalidPluggyItemError('amount must be greater than zero');
}

function assertOrigin(linkedAccountId: string | null, linkedCreditCardId: string | null): void {
  const hasAccount = Boolean(linkedAccountId);
  const hasCard = Boolean(linkedCreditCardId);
  if (hasAccount === hasCard) {
    throw new InvalidPluggyItemError(
      'SyncedTransaction requires exactly one of linkedAccountId or linkedCreditCardId',
    );
  }
}
