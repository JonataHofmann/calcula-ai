import { isCardBrandId } from '@finance/contracts';
import { InvalidCreditCardError } from './errors';

export interface CreditCardProps {
  id: string;
  userId: string;
  name: string;
  lastDigits: string;
  dueDay: number;
  closingDay: number;
  limit: string;
  brandId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditCardAttributes {
  name: string;
  lastDigits: string;
  dueDay: number;
  closingDay: number;
  limit: string;
  brandId: string;
}

/** CreditCard aggregate. Enforces digits/day/limit/brand invariants; scoping is done by the repository. */
export class CreditCard {
  private constructor(private props: CreditCardProps) {}

  static create(input: {
    id: string;
    userId: string;
    name: string;
    lastDigits: string;
    dueDay: number;
    closingDay: number;
    limit: string;
    brandId: string;
    now?: Date;
  }): CreditCard {
    const now = input.now ?? new Date();
    return new CreditCard({
      id: input.id,
      userId: input.userId,
      name: assertName(input.name),
      lastDigits: assertLastDigits(input.lastDigits),
      dueDay: assertDay(input.dueDay, 'dueDay'),
      closingDay: assertDay(input.closingDay, 'closingDay'),
      limit: assertLimit(input.limit),
      brandId: assertBrand(input.brandId),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrate from persistence without re-running create-time defaults. */
  static restore(props: CreditCardProps): CreditCard {
    return new CreditCard(props);
  }

  update(patch: Partial<CreditCardAttributes>, now: Date = new Date()): void {
    if (patch.name !== undefined) this.props.name = assertName(patch.name);
    if (patch.lastDigits !== undefined) this.props.lastDigits = assertLastDigits(patch.lastDigits);
    if (patch.dueDay !== undefined) this.props.dueDay = assertDay(patch.dueDay, 'dueDay');
    if (patch.closingDay !== undefined) this.props.closingDay = assertDay(patch.closingDay, 'closingDay');
    if (patch.limit !== undefined) this.props.limit = assertLimit(patch.limit);
    if (patch.brandId !== undefined) this.props.brandId = assertBrand(patch.brandId);
    this.props.updatedAt = now;
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get name(): string {
    return this.props.name;
  }
  get lastDigits(): string {
    return this.props.lastDigits;
  }
  get dueDay(): number {
    return this.props.dueDay;
  }
  get closingDay(): number {
    return this.props.closingDay;
  }
  get limit(): string {
    return this.props.limit;
  }
  get brandId(): string {
    return this.props.brandId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertName(value: string): string {
  const name = value.trim();
  if (name.length === 0) throw new InvalidCreditCardError('Card name must not be empty');
  return name;
}

function assertLastDigits(value: string): string {
  if (!/^\d{4}$/.test(value)) throw new InvalidCreditCardError('lastDigits must be exactly 4 digits');
  return value;
}

function assertDay(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new InvalidCreditCardError(`${field} must be an integer between 1 and 31`);
  }
  return value;
}

function assertLimit(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidCreditCardError('limit must be a non-negative decimal');
  }
  return value;
}

function assertBrand(brandId: string): string {
  if (!isCardBrandId(brandId)) throw new InvalidCreditCardError(`Unknown card brand: ${brandId}`);
  return brandId;
}
