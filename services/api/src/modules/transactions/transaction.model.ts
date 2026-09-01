import type {
  Recurrence,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '@finance/contracts';
import { InvalidTransactionError, AlreadyPaidError, NotPaidError } from './transactions.types';
import { toCents } from './recurrence';

export interface TransactionProps {
  id: string;
  userId: string;
  description: string;
  /** Raw imported description before user edit; null for manual/unedited rows. Used for category matching. */
  originalDescription: string | null;
  dueDate: Date;
  /** Real purchase date for card rows; null for account rows (dueDate is the invoice due). */
  purchaseDate: Date | null;
  amount: string;
  effectiveAmount: string | null;
  recurrence: Recurrence;
  effectiveDate: Date | null;
  type: TransactionType;
  notes: string | null;
  status: TransactionStatus;
  endDate: Date | null;
  installmentCount: number | null;
  installmentNumber: number | null;
  groupId: string | null;
  categoryId: string;
  accountId: string | null;
  creditCardId: string | null;
  source: TransactionSource;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTransactionAttributes {
  description: string;
  dueDate: Date;
  purchaseDate: Date | null;
  amount: string;
  type: TransactionType;
  notes: string | null;
  categoryId: string;
  accountId: string | null;
  creditCardId: string | null;
  endDate: Date | null;
  installmentCount: number | null;
  installmentNumber: number | null;
}

export interface CreateTransactionData {
  id: string;
  userId: string;
  description: string;
  originalDescription?: string | null;
  dueDate: Date;
  purchaseDate?: Date | null;
  amount: string;
  recurrence: Recurrence;
  type: TransactionType;
  categoryId: string;
  accountId?: string | null;
  creditCardId?: string | null;
  notes?: string | null;
  endDate?: Date | null;
  installmentCount?: number | null;
  installmentNumber?: number | null;
  groupId?: string | null;
  source?: TransactionSource;
  externalId?: string | null;
  now?: Date;
}

/**
 * Transaction aggregate — one row = one occurrence. Enforces value/origin/recurrence
 * invariants (R7); category-type coherence and reference ownership are checked by the
 * service via injected repositories. Scoping is done by the service.
 */
export class Transaction {
  private constructor(private props: TransactionProps) {}

  static create(input: CreateTransactionData): Transaction {
    const now = input.now ?? new Date();
    const description = assertDescription(input.description);
    assertAmount(input.amount);
    assertOrigin(input.type, input.accountId ?? null, input.creditCardId ?? null);
    assertRecurrence({
      recurrence: input.recurrence,
      dueDate: input.dueDate,
      endDate: input.endDate ?? null,
      installmentCount: input.installmentCount ?? null,
      installmentNumber: input.installmentNumber ?? null,
      groupId: input.groupId ?? null,
    });
    return new Transaction({
      id: input.id,
      userId: input.userId,
      description,
      originalDescription: input.originalDescription ?? null,
      dueDate: input.dueDate,
      purchaseDate: input.purchaseDate ?? null,
      amount: input.amount,
      effectiveAmount: null,
      recurrence: input.recurrence,
      effectiveDate: null,
      type: input.type,
      notes: input.notes ?? null,
      status: 'pending',
      endDate: input.endDate ?? null,
      installmentCount: input.installmentCount ?? null,
      installmentNumber: input.installmentNumber ?? null,
      groupId: input.groupId ?? null,
      categoryId: input.categoryId,
      accountId: input.accountId ?? null,
      creditCardId: input.creditCardId ?? null,
      source: input.source ?? 'manual',
      externalId: input.externalId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrate from persistence without re-running create-time defaults. */
  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  /** Apply editable fields. Preserves status/effectiveDate/effectiveAmount (R3). */
  update(patch: Partial<UpdateTransactionAttributes>, now: Date = new Date()): void {
    const next = { ...this.props };
    if (patch.description !== undefined) next.description = assertDescription(patch.description);
    if (patch.dueDate !== undefined) next.dueDate = patch.dueDate;
    if (patch.purchaseDate !== undefined) next.purchaseDate = patch.purchaseDate;
    if (patch.amount !== undefined) {
      assertAmount(patch.amount);
      next.amount = patch.amount;
    }
    if (patch.type !== undefined) next.type = patch.type;
    if (patch.notes !== undefined) next.notes = patch.notes;
    if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
    if (patch.accountId !== undefined) next.accountId = patch.accountId;
    if (patch.creditCardId !== undefined) next.creditCardId = patch.creditCardId;
    if (patch.endDate !== undefined) next.endDate = patch.endDate;
    if (patch.installmentCount !== undefined) next.installmentCount = patch.installmentCount;
    if (patch.installmentNumber !== undefined) next.installmentNumber = patch.installmentNumber;

    assertOrigin(next.type, next.accountId, next.creditCardId);
    assertRecurrence({
      recurrence: next.recurrence,
      dueDate: next.dueDate,
      endDate: next.endDate,
      installmentCount: next.installmentCount,
      installmentNumber: next.installmentNumber,
      groupId: next.groupId,
    });
    next.updatedAt = now;
    this.props = next;
  }

  /** pending -> paid, recording the effective date/amount. Blocks re-effectuating (FR-017). */
  effectuate(input: { date?: Date; amount?: string } = {}, now: Date = new Date()): void {
    if (this.props.status === 'paid') throw new AlreadyPaidError(this.props.id);
    const amount = input.amount ?? this.props.amount;
    assertAmount(amount);
    this.props.status = 'paid';
    this.props.effectiveDate = input.date ?? now;
    this.props.effectiveAmount = amount;
    this.props.updatedAt = now;
  }

  /** paid -> pending, clearing the effective date/amount. Inverse of effectuate(). */
  undoEffectuate(now: Date = new Date()): void {
    if (this.props.status === 'pending') throw new NotPaidError(this.props.id);
    this.props.status = 'pending';
    this.props.effectiveDate = null;
    this.props.effectiveAmount = null;
    this.props.updatedAt = now;
  }

  toProps(): TransactionProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get description(): string {
    return this.props.description;
  }
  get originalDescription(): string | null {
    return this.props.originalDescription;
  }
  get dueDate(): Date {
    return this.props.dueDate;
  }
  get purchaseDate(): Date | null {
    return this.props.purchaseDate;
  }
  get amount(): string {
    return this.props.amount;
  }
  get effectiveAmount(): string | null {
    return this.props.effectiveAmount;
  }
  get recurrence(): Recurrence {
    return this.props.recurrence;
  }
  get effectiveDate(): Date | null {
    return this.props.effectiveDate;
  }
  get type(): TransactionType {
    return this.props.type;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get status(): TransactionStatus {
    return this.props.status;
  }
  get endDate(): Date | null {
    return this.props.endDate;
  }
  get installmentCount(): number | null {
    return this.props.installmentCount;
  }
  get installmentNumber(): number | null {
    return this.props.installmentNumber;
  }
  get groupId(): string | null {
    return this.props.groupId;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get accountId(): string | null {
    return this.props.accountId;
  }
  get creditCardId(): string | null {
    return this.props.creditCardId;
  }
  get source(): TransactionSource {
    return this.props.source;
  }
  get externalId(): string | null {
    return this.props.externalId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertDescription(value: string): string {
  const description = value.trim();
  if (description.length === 0) throw new InvalidTransactionError('Description must not be empty');
  if (description.length > 120) throw new InvalidTransactionError('Description too long');
  return description;
}

function assertAmount(amount: string): void {
  if (toCents(amount) <= 0) throw new InvalidTransactionError('Amount must be greater than zero');
}

function assertOrigin(
  type: TransactionType,
  accountId: string | null,
  creditCardId: string | null,
): void {
  const hasAccount = Boolean(accountId);
  const hasCard = Boolean(creditCardId);
  if (hasAccount === hasCard) {
    const label = type === 'expense' ? 'Expense' : 'Income';
    throw new InvalidTransactionError(`${label} requires exactly one of account or card`);
  }
}

/** installmentNumber/installmentCount must be provided together, in range (used on 'single' rows carrying informational Pluggy card-installment metadata). */
function assertInstallmentPair(
  installmentNumber: number | null,
  installmentCount: number | null,
): void {
  if ((installmentNumber === null) !== (installmentCount === null)) {
    throw new InvalidTransactionError('installmentNumber and installmentCount must be provided together');
  }
  if (installmentNumber !== null && installmentCount !== null) {
    if (installmentCount < 1) throw new InvalidTransactionError('installmentCount must be >= 1');
    if (installmentNumber < 1 || installmentNumber > installmentCount) {
      throw new InvalidTransactionError('installmentNumber must be within 1..installmentCount');
    }
  }
}

function assertRecurrence(data: {
  recurrence: Recurrence;
  dueDate: Date;
  endDate: Date | null;
  installmentCount: number | null;
  installmentNumber: number | null;
  groupId: string | null;
}): void {
  switch (data.recurrence) {
    case 'single':
      if (data.groupId || data.endDate) {
        throw new InvalidTransactionError('Single transaction cannot carry group/end fields');
      }
      assertInstallmentPair(data.installmentNumber, data.installmentCount);
      break;
    case 'installment':
      if (!data.installmentCount || data.installmentCount < 1) {
        throw new InvalidTransactionError('Installment requires installmentCount >= 1');
      }
      if (
        !data.installmentNumber ||
        data.installmentNumber < 1 ||
        data.installmentNumber > data.installmentCount
      ) {
        throw new InvalidTransactionError('installmentNumber must be within 1..installmentCount');
      }
      if (!data.groupId) throw new InvalidTransactionError('Installment requires a groupId');
      if (data.endDate) throw new InvalidTransactionError('Installment cannot have endDate');
      break;
    case 'fixed':
      if (!data.groupId) throw new InvalidTransactionError('Fixed requires a groupId');
      if (data.installmentCount || data.installmentNumber) {
        throw new InvalidTransactionError('Fixed cannot carry installment fields');
      }
      if (data.endDate && data.endDate.getTime() < data.dueDate.getTime()) {
        throw new InvalidTransactionError('endDate must be >= dueDate');
      }
      break;
  }
}
