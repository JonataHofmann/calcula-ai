import { isBankId, isColorToken, isIconKey } from '@finance/contracts';
import { InvalidAccountError } from './errors';

export interface AccountProps {
  id: string;
  userId: string;
  name: string;
  bankId: string;
  icon: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountAttributes {
  name: string;
  bankId: string;
  icon: string;
  color: string;
}

/** Account aggregate. Enforces name/catalog invariants; scoping is done by the repository. */
export class Account {
  private constructor(private props: AccountProps) {}

  static create(input: {
    id: string;
    userId: string;
    name: string;
    bankId: string;
    icon: string;
    color: string;
    now?: Date;
  }): Account {
    const now = input.now ?? new Date();
    const name = assertName(input.name);
    assertCatalog(input.bankId, input.icon, input.color);
    return new Account({
      id: input.id,
      userId: input.userId,
      name,
      bankId: input.bankId,
      icon: input.icon,
      color: input.color,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrate from persistence without re-running create-time defaults. */
  static restore(props: AccountProps): Account {
    return new Account(props);
  }

  update(patch: Partial<AccountAttributes>, now: Date = new Date()): void {
    if (patch.name !== undefined) this.props.name = assertName(patch.name);
    if (patch.bankId !== undefined) {
      if (!isBankId(patch.bankId)) throw new InvalidAccountError(`Unknown bank: ${patch.bankId}`);
      this.props.bankId = patch.bankId;
    }
    if (patch.icon !== undefined) {
      if (!isIconKey(patch.icon)) throw new InvalidAccountError(`Unknown icon: ${patch.icon}`);
      this.props.icon = patch.icon;
    }
    if (patch.color !== undefined) {
      if (!isColorToken(patch.color)) throw new InvalidAccountError(`Unknown color: ${patch.color}`);
      this.props.color = patch.color;
    }
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
  get bankId(): string {
    return this.props.bankId;
  }
  get icon(): string {
    return this.props.icon;
  }
  get color(): string {
    return this.props.color;
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
  if (name.length === 0) throw new InvalidAccountError('Account name must not be empty');
  return name;
}

function assertCatalog(bankId: string, icon: string, color: string): void {
  if (!isBankId(bankId)) throw new InvalidAccountError(`Unknown bank: ${bankId}`);
  if (!isIconKey(icon)) throw new InvalidAccountError(`Unknown icon: ${icon}`);
  if (!isColorToken(color)) throw new InvalidAccountError(`Unknown color: ${color}`);
}
