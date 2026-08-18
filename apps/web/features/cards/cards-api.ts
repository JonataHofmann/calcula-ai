import type {
  CreateCreditCardInput,
  CreditCardDto,
  UpdateCreditCardInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

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

export function deleteCard(id: string): Promise<void> {
  return apiFetch<void>(`/cards/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
