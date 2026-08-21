import type { AccountEntity } from '../entities/account.entity';
import { AccountResponseDto } from '../dto/account-response.dto';

/** Sole place entity → response-DTO translation happens (FR-013). */
export class AccountConverter {
  static toResponse(entity: AccountEntity): AccountResponseDto {
    // Catalog fields are persisted as strings but are validated against the
    // contract's enums upstream (zod pipe), so the narrowing cast is sound.
    return {
      id: entity.id,
      name: entity.name,
      bankId: entity.bankId,
      icon: entity.icon,
      color: entity.color,
    } as AccountResponseDto;
  }
}
