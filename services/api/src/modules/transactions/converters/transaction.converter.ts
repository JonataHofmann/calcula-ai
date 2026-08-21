import type { Transaction } from '../transaction.model';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

/**
 * Sole place aggregate → response-DTO translation happens (FR-013). Drops
 * `userId`/`createdAt`/`updatedAt` (FR-023) and serialises dates to ISO instants.
 */
export class TransactionConverter {
  static toResponse(t: Transaction): TransactionResponseDto {
    return {
      id: t.id,
      description: t.description,
      dueDate: t.dueDate.toISOString(),
      amount: t.amount,
      effectiveAmount: t.effectiveAmount,
      recurrence: t.recurrence,
      effectiveDate: t.effectiveDate ? t.effectiveDate.toISOString() : null,
      type: t.type,
      notes: t.notes,
      status: t.status,
      endDate: t.endDate ? t.endDate.toISOString() : null,
      installmentCount: t.installmentCount,
      installmentNumber: t.installmentNumber,
      groupId: t.groupId,
      categoryId: t.categoryId,
      accountId: t.accountId,
      creditCardId: t.creditCardId,
      source: t.source,
      externalId: t.externalId,
    };
  }
}
