import type { AccountDto } from '@finance/contracts';

/**
 * Response shape leaving the controller — a distinct type from the persistence
 * entity (FR-012). Field types mirror the public `AccountDto` contract (no
 * `userId`, FR-023).
 */
export class AccountResponseDto implements AccountDto {
  id!: AccountDto['id'];
  name!: AccountDto['name'];
  bankId!: AccountDto['bankId'];
  icon!: AccountDto['icon'];
  color!: AccountDto['color'];
}
