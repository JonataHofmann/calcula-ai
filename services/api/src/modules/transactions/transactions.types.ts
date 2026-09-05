import type { Recurrence, SortOrder, TransactionSort, TransactionType } from '@finance/contracts';
import type { Transaction } from './transaction.model';

/**
 * Module-local domain errors and types (R3). Errors are framework-agnostic and
 * mapped to HTTP by DomainExceptionFilter via the `name` convention — the `.name`
 * strings below are load-bearing (e.g. `*ConflictError` → 409) and must not change.
 */

export class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}

export class TransactionNotFoundError extends Error {
  constructor(id: string) {
    super(`Transaction not found: ${id}`);
    this.name = 'TransactionNotFoundError';
  }
}

/** A projection estimate the user does not own (or absent) -> 404 (name ends with NotFoundError). */
export class ProjectionEstimateNotFoundError extends Error {
  constructor(id: string) {
    super(`Projection estimate not found: ${id}`);
    this.name = 'ProjectionEstimateNotFoundError';
  }
}

/** Effectuating an already-paid transaction -> 409 (name ends with ConflictError). */
export class AlreadyPaidError extends Error {
  constructor(id: string) {
    super(`Transaction already paid: ${id}`);
    this.name = 'AlreadyPaidConflictError';
  }
}

/** Referenced category/account/card missing or owned by another user -> 404 (R9/FR-022). */
export class ReferenceNotFoundError extends Error {
  constructor(kind: 'category' | 'account' | 'card', id: string) {
    super(`${kind} not found: ${id}`);
    this.name = 'ReferenceNotFoundError';
  }
}

/** `Idempotency-Key` (externalId) reused with a different body -> 409 (name ends with ConflictError). */
export class SyncedImportConflictError extends Error {
  constructor(externalId: string) {
    super(`Idempotency-Key conflict for externalId: ${externalId}`);
    this.name = 'SyncedImportConflictError';
  }
}

/** Undoing effectuation on a still-pending transaction -> 409 (name ends with ConflictError). */
export class NotPaidError extends Error {
  constructor(id: string) {
    super(`Transaction not paid: ${id}`);
    this.name = 'NotPaidConflictError';
  }
}

/**
 * A row in the monthly cash-basis listing. `logical` rows are virtual (a paid
 * transaction surfaced in the month it was effectuated, though due elsewhere);
 * `settledElsewhere` real rows stay visible in their due month but are excluded
 * from that month's balance (Option A — no double counting).
 */
export interface ListedTransaction {
  transaction: Transaction;
  logical: boolean;
  settledElsewhere: boolean;
}

/** Repository-level filters folded into the service (Dates already resolved from the ISO query — R4). */
export interface FindTransactionsFilter {
  dueFrom: Date;
  dueTo: Date;
  search?: string;
  amount?: string;
  recurrence?: Recurrence;
  type?: TransactionType;
  categoryId?: string;
  /**
   * Resolved category filter set: the selected category plus its subcategories. When present it
   * takes precedence over `categoryId` so selecting a parent lists its children's transactions too.
   */
  categoryIds?: string[];
  accountId?: string;
  creditCardId?: string;
  sort: TransactionSort;
  order: SortOrder;
}
