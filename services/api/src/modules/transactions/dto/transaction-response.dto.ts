import type { TransactionDto } from '@finance/contracts';

/**
 * Response shape leaving the controller — a distinct type from the persistence
 * entity/aggregate (FR-012). Field types mirror the public `TransactionDto`
 * contract (no `userId`/`createdAt`/`updatedAt`, FR-023). Dates are ISO strings.
 */
export class TransactionResponseDto implements TransactionDto {
  id!: TransactionDto['id'];
  description!: TransactionDto['description'];
  dueDate!: TransactionDto['dueDate'];
  amount!: TransactionDto['amount'];
  effectiveAmount!: TransactionDto['effectiveAmount'];
  recurrence!: TransactionDto['recurrence'];
  effectiveDate!: TransactionDto['effectiveDate'];
  type!: TransactionDto['type'];
  notes!: TransactionDto['notes'];
  status!: TransactionDto['status'];
  endDate!: TransactionDto['endDate'];
  installmentCount!: TransactionDto['installmentCount'];
  installmentNumber!: TransactionDto['installmentNumber'];
  groupId!: TransactionDto['groupId'];
  categoryId!: TransactionDto['categoryId'];
  accountId!: TransactionDto['accountId'];
  creditCardId!: TransactionDto['creditCardId'];
  source!: TransactionDto['source'];
  externalId!: TransactionDto['externalId'];
}
