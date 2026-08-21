import { InvalidPluggyItemError } from './errors';
import { toCents } from './money';

export interface LinkedCreditCardProps {
  id: string;
  bankConnectionId: string;
  userId: string;
  pluggyAccountId: string;
  brand: string | null;
  lastDigits: string | null;
  creditLimit: string | null;
  availableLimit: string | null;
  currentBalance: string;
  closingDate: Date | null;
  dueDate: Date | null;
  apiCreditCardId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLinkedCreditCardData {
  id: string;
  bankConnectionId: string;
  userId: string;
  pluggyAccountId: string;
  brand?: string | null;
  lastDigits?: string | null;
  creditLimit?: string | null;
  availableLimit?: string | null;
  currentBalance: string;
  closingDate?: Date | null;
  dueDate?: Date | null;
  apiCreditCardId?: string | null;
  now?: Date;
}

export interface UpdateLinkedCreditCardSnapshot {
  currentBalance: string;
  creditLimit?: string | null;
  availableLimit?: string | null;
  closingDate?: Date | null;
  dueDate?: Date | null;
}

/** Linked Credit Card aggregate — Pluggy models a card as an Account of type CREDIT (R8). */
export class LinkedCreditCard {
  private constructor(private props: LinkedCreditCardProps) {}

  static create(input: CreateLinkedCreditCardData): LinkedCreditCard {
    const now = input.now ?? new Date();
    assertMoney(input.currentBalance, 'currentBalance');
    if (input.creditLimit != null) assertMoney(input.creditLimit, 'creditLimit');
    if (input.availableLimit != null) assertMoney(input.availableLimit, 'availableLimit');
    assertLastDigits(input.lastDigits ?? null);
    return new LinkedCreditCard({
      id: input.id,
      bankConnectionId: input.bankConnectionId,
      userId: input.userId,
      pluggyAccountId: input.pluggyAccountId,
      brand: input.brand ?? null,
      lastDigits: input.lastDigits ?? null,
      creditLimit: input.creditLimit ?? null,
      availableLimit: input.availableLimit ?? null,
      currentBalance: input.currentBalance,
      closingDate: input.closingDate ?? null,
      dueDate: input.dueDate ?? null,
      apiCreditCardId: input.apiCreditCardId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: LinkedCreditCardProps): LinkedCreditCard {
    return new LinkedCreditCard(props);
  }

  /** Records the services/api `CreditCard` created for this Pluggy card — called once, on first sync. */
  linkApiCreditCard(apiCreditCardId: string, now: Date = new Date()): void {
    this.props.apiCreditCardId = apiCreditCardId;
    this.props.updatedAt = now;
  }

  /** Applied on every sync — Pluggy always sends the current snapshot for the card. */
  updateSnapshot(input: UpdateLinkedCreditCardSnapshot, now: Date = new Date()): void {
    assertMoney(input.currentBalance, 'currentBalance');
    this.props.currentBalance = input.currentBalance;
    if (input.creditLimit !== undefined) {
      if (input.creditLimit != null) assertMoney(input.creditLimit, 'creditLimit');
      this.props.creditLimit = input.creditLimit;
    }
    if (input.availableLimit !== undefined) {
      if (input.availableLimit != null) assertMoney(input.availableLimit, 'availableLimit');
      this.props.availableLimit = input.availableLimit;
    }
    if (input.closingDate !== undefined) this.props.closingDate = input.closingDate;
    if (input.dueDate !== undefined) this.props.dueDate = input.dueDate;
    this.props.updatedAt = now;
  }

  toProps(): LinkedCreditCardProps {
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

  get brand(): string | null {
    return this.props.brand;
  }

  get lastDigits(): string | null {
    return this.props.lastDigits;
  }

  get creditLimit(): string | null {
    return this.props.creditLimit;
  }

  get availableLimit(): string | null {
    return this.props.availableLimit;
  }

  get currentBalance(): string {
    return this.props.currentBalance;
  }

  get closingDate(): Date | null {
    return this.props.closingDate;
  }

  get dueDate(): Date | null {
    return this.props.dueDate;
  }

  get apiCreditCardId(): string | null {
    return this.props.apiCreditCardId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertMoney(value: string, field: string): void {
  if (!Number.isFinite(toCents(value))) {
    throw new InvalidPluggyItemError(`${field} must be a valid decimal amount`);
  }
}

function assertLastDigits(lastDigits: string | null): void {
  if (lastDigits !== null && !/^\d{4}$/.test(lastDigits)) {
    throw new InvalidPluggyItemError('lastDigits must be exactly 4 digits');
  }
}
