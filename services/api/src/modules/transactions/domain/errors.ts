/** Framework-agnostic domain errors. Mapped to HTTP by DomainExceptionFilter (name convention). */

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
