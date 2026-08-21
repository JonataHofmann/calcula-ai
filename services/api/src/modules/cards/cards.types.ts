/**
 * Module-local domain errors (research R3). Names are load-bearing:
 * `DomainExceptionFilter` maps `*NotFoundError` → 404 and `Invalid*` → 400.
 */

/** Requested card does not exist for the scoped user (also cross-user access — FR-021). */
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
