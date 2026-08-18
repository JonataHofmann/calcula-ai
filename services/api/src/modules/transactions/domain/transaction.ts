import type { Recurrence, TransactionStatus, TransactionType } from '@finance/contracts';
import { InvalidTransactionError, AlreadyPaidError } from './errors';
import { toCents } from './recurrence';

export interface TransactionProps {
  id: string;
  userId: string;
  description: string;
  dueDate: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTransactionAttributes {
  description: string;
  dueDate: Date;
  amount: string;
  type: TransactionType;
  notes: string | null;
  categoryId: string;
  accountId: string | null;
  creditCardId: string | null;
  endDate: Date | null;
}

export interface CreateTransactionData {
  id: string;
  userId: string;
  description: string;
  dueDate: Date;
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
  now?: Date;
}

/**
 * Transaction aggregate — one row = one occurrence. Enforces value/origin/recurrence
 * invariants (R7); category-type coherence and reference ownership are checked by the
 * use case via lookup ports. Scoping is done by the repository.
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
      dueDate: input.dueDate,
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

    assertOrigin(next.type, next.accountId, next.creditCardId);
    if (next.recurrence === 'fixed' && next.endDate) {
      if (next.endDate.getTime() < next.dueDate.getTime()) {
        throw new InvalidTransactionError('endDate must be >= dueDate');
      }
    }
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
  get dueDate(): Date {
    return this.props.dueDate;
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
  if (type === 'expense') {
    const hasAccount = Boolean(accountId);
    const hasCard = Boolean(creditCardId);
    if (hasAccount === hasCard) {
      throw new InvalidTransactionError('Expense requires exactly one of account or card');
    }
  } else {
    if (!accountId) throw new InvalidTransactionError('Income requires an account');
    if (creditCardId) throw new InvalidTransactionError('Income cannot use a card');
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
      if (data.groupId || data.installmentCount || data.installmentNumber || data.endDate) {
        throw new InvalidTransactionError('Single transaction cannot carry group/installment/end fields');
      }
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
