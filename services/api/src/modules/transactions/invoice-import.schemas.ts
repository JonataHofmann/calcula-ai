import {
  commitInvoiceInputSchema,
  type CommitInvoiceInput,
  type CommitInvoiceResult,
} from '@finance/contracts';

/**
 * Server-side validation schema for the invoice-import commit body. The commit is
 * user-scoped: `userId` NEVER comes from the body — it is taken from the JWT in the
 * controller (`@CurrentUser`). Re-exported from contracts so the api owns its request
 * boundary alongside the other transaction schemas.
 */
export { commitInvoiceInputSchema };
export type { CommitInvoiceInput, CommitInvoiceResult };
