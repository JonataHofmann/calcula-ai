/**
 * Module-local domain errors (research R3). Names are load-bearing:
 * `DomainExceptionFilter` maps `*NotFoundError` → 404 and `Invalid*` → 400.
 */

/** Requested account does not exist for the scoped user (also cross-user access — FR-021). */
export class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Account not found: ${id}`);
    this.name = 'AccountNotFoundError';
  }
}

/** Domain invariant violated (empty name, unknown catalog reference). */
export class InvalidAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAccountError';
  }
}
