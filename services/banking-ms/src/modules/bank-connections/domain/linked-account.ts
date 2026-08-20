import type { LinkedAccountType } from '@finance/contracts';
import { InvalidPluggyItemError } from './errors';
import { toCents } from './money';

export interface LinkedAccountProps {
  id: string;
  bankConnectionId: string;
  userId: string;
  pluggyAccountId: string;
  type: LinkedAccountType;
  displayName: string;
  balance: string;
  currency: 'BRL';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLinkedAccountData {
  id: string;
  bankConnectionId: string;
  userId: string;
  pluggyAccountId: string;
  type: LinkedAccountType;
  displayName: string;
  balance: string;
  now?: Date;
}

/** Linked Account aggregate — Pluggy's view of a bank account (R8, distinct from the domestic `Account`). */
export class LinkedAccount {
  private constructor(private props: LinkedAccountProps) {}

  static create(input: CreateLinkedAccountData): LinkedAccount {
    const now = input.now ?? new Date();
    assertBalance(input.balance);
    return new LinkedAccount({
      id: input.id,
      bankConnectionId: input.bankConnectionId,
      userId: input.userId,
      pluggyAccountId: input.pluggyAccountId,
      type: input.type,
      displayName: assertNonEmpty(input.displayName),
      balance: input.balance,
      currency: 'BRL',
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: LinkedAccountProps): LinkedAccount {
    return new LinkedAccount(props);
  }

  /** Applied on every sync — Pluggy always sends the current snapshot balance. */
  updateSnapshot(input: { displayName: string; balance: string }, now: Date = new Date()): void {
    assertBalance(input.balance);
    this.props.displayName = assertNonEmpty(input.displayName);
    this.props.balance = input.balance;
    this.props.updatedAt = now;
  }

  toProps(): LinkedAccountProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get bankConnectionId(): string {
    return this.props.bankConnectionId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get pluggyAccountId(): string {
    return this.props.pluggyAccountId;
  }

  get type(): LinkedAccountType {
    return this.props.type;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get balance(): string {
    return this.props.balance;
  }

  get currency(): 'BRL' {
    return this.props.currency;
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
  if (trimmed.length === 0) throw new InvalidPluggyItemError('displayName must not be empty');
  return trimmed;
}

function assertBalance(balance: string): void {
  // Balance may be negative (overdraft) — only reject malformed/non-numeric values.
  if (!Number.isFinite(toCents(balance))) {
    throw new InvalidPluggyItemError('balance must be a valid decimal amount');
  }
}
