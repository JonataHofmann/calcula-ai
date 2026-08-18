/** Requested account does not exist for the scoped user (also used for cross-user access — FR-021). */
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
