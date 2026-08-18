/** Requested card does not exist for the scoped user (also used for cross-user access — FR-021). */
export class CreditCardNotFoundError extends Error {
  constructor(id: string) {
    super(`Credit card not found: ${id}`);
    this.name = 'CreditCardNotFoundError';
  }
}

/** Domain invariant violated (empty name, bad digits/days/limit, unknown brand). */
export class InvalidCreditCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCreditCardError';
  }
}
