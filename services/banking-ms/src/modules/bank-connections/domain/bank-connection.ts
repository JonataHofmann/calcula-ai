import type { BankConnectionStatus } from '@finance/contracts';
import { InvalidPluggyItemError } from './errors';

export interface BankConnectionProps {
  id: string;
  userId: string;
  pluggyItemId: string;
  institutionId: string;
  institutionName: string;
  status: BankConnectionStatus;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBankConnectionData {
  id: string;
  userId: string;
  pluggyItemId: string;
  institutionId: string;
  institutionName: string;
  now?: Date;
}

/**
 * BankConnection aggregate — one row per Pluggy Item consented by a user.
 * Uniqueness of (userId, pluggyItemId) is enforced by the repository/DB, not here.
 */
export class BankConnection {
  private constructor(private props: BankConnectionProps) {}

  static create(input: CreateBankConnectionData): BankConnection {
    const now = input.now ?? new Date();
    return new BankConnection({
      id: input.id,
      userId: input.userId,
      pluggyItemId: assertNonEmpty(input.pluggyItemId, 'pluggyItemId'),
      institutionId: assertNonEmpty(input.institutionId, 'institutionId'),
      institutionName: assertNonEmpty(input.institutionName, 'institutionName'),
      status: 'active',
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: BankConnectionProps): BankConnection {
    return new BankConnection(props);
  }

  /** Sync detected a recoverable auth/consent issue (Pluggy item LOGIN_ERROR/OUTDATED/...). */
  markNeedsAttention(now: Date = new Date()): void {
    if (this.props.status === 'disconnected') return;
    this.props.status = 'needs_attention';
    this.props.updatedAt = now;
  }

  /** Sync recovered — item is healthy again. */
  markActive(now: Date = new Date()): void {
    if (this.props.status === 'disconnected') return;
    this.props.status = 'active';
    this.props.updatedAt = now;
  }

  /** Terminal — connection revoked at Pluggy. Never physically deleted, only marked disconnected. */
  disconnect(now: Date = new Date()): void {
    if (this.props.status === 'disconnected') return;
    this.props.status = 'disconnected';
    this.props.updatedAt = now;
  }

  recordSync(now: Date = new Date()): void {
    this.props.lastSyncedAt = now;
    this.props.updatedAt = now;
  }

  toProps(): BankConnectionProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get pluggyItemId(): string {
    return this.props.pluggyItemId;
  }

  get institutionId(): string {
    return this.props.institutionId;
  }

  get institutionName(): string {
    return this.props.institutionName;
  }

  get status(): BankConnectionStatus {
    return this.props.status;
  }

  get lastSyncedAt(): Date | null {
    return this.props.lastSyncedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvalidPluggyItemError(`${field} must not be empty`);
  return trimmed;
}
