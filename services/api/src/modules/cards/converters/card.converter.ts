import type { CreditCardEntity } from '../entities/credit-card.entity';
import { CardResponseDto } from '../dto/card-response.dto';

/** Sole place entity → response-DTO translation happens (FR-013). */
export class CardConverter {
  static toResponse(entity: CreditCardEntity): CardResponseDto {
    // brandId is persisted as a string but validated against the contract's
    // enum upstream (service assert), so the narrowing cast is sound.
    return {
      id: entity.id,
      name: entity.name,
      lastDigits: entity.lastDigits,
      dueDay: entity.dueDay,
      closingDay: entity.closingDay,
      limit: entity.limit,
      brandId: entity.brandId,
    } as CardResponseDto;
  }
}
