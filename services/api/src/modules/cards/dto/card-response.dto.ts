import type { CreditCardDto } from '@finance/contracts';

/**
 * Response shape leaving the controller — a distinct type from the persistence
 * entity (FR-012). Field types mirror the public `CreditCardDto` contract (no
 * `userId`, FR-023).
 */
export class CardResponseDto implements CreditCardDto {
  id!: CreditCardDto['id'];
  name!: CreditCardDto['name'];
  lastDigits!: CreditCardDto['lastDigits'];
  dueDay!: CreditCardDto['dueDay'];
  closingDay!: CreditCardDto['closingDay'];
  limit!: CreditCardDto['limit'];
  brandId!: CreditCardDto['brandId'];
}
