/**
 * Domain errors — `this.name` follows the convention consumed by DomainExceptionFilter:
 * `*NotFoundError` -> 404, `Invalid*`/`*ValidationError` -> 400, `Duplicate*`/`*ConflictError` -> 409.
 */

export class DuplicateConnectionError extends Error {
  constructor(pluggyItemId: string) {
    super(`Bank connection already exists for item: ${pluggyItemId}`);
    this.name = 'DuplicateConnectionError';
  }
}

export class ConnectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Bank connection not found: ${id}`);
    this.name = 'ConnectionNotFoundError';
  }
}

export class InvalidPluggyItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPluggyItemError';
  }
}

/** Retry budget for a synced transaction import is exhausted; needs manual intervention (409, not 500). */
export class ImportRetriesExhaustedError extends Error {
  constructor(pluggyTransactionId: string) {
    super(`Import retries exhausted for transaction: ${pluggyTransactionId}`);
    this.name = 'ImportRetriesExhaustedConflictError';
  }
}

/** A manual refresh was requested on a connection that isn't active (needs_attention/disconnected). */
export class ConnectionNotActiveError extends Error {
  constructor(id: string) {
    super(`Bank connection is not active: ${id}`);
    this.name = 'ConnectionNotActiveConflictError';
  }
}

/** Pluggy returns 409 on PATCH /items/:id when a previous update for that item hasn't finished yet. */
export class ItemAlreadyUpdatingError extends Error {
  constructor(itemId: string) {
    super(`Item is already updating: ${itemId}`);
    this.name = 'ItemAlreadyUpdatingConflictError';
  }
}
