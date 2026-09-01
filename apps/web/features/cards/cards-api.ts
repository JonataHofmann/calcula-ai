import type {
  CreateCreditCardInput,
  CreditCardDto,
  TransactionCountResult,
  UpdateCreditCardInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';
import { withQuery } from '../../util/http';

export function listCards(): Promise<CreditCardDto[]> {
  return apiFetch<CreditCardDto[]>('/cards');
}

export function createCard(input: CreateCreditCardInput): Promise<CreditCardDto> {
  return apiFetch<CreditCardDto>('/cards', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function updateCard(
  id: string,
  input: UpdateCreditCardInput,
): Promise<CreditCardDto> {
  return apiFetch<CreditCardDto>(`/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

/** Number of transactions linked to this card (shown before a cascading delete). */
export function getCardTransactionCount(id: string): Promise<TransactionCountResult> {
  return apiFetch<TransactionCountResult>(`/cards/${id}/transaction-count`);
}

export function deleteCard(id: string, deleteTransactions = false): Promise<void> {
  return apiFetch<void>(
    withQuery(`/cards/${id}`, { deleteTransactions: deleteTransactions ? 'true' : undefined }),
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}
