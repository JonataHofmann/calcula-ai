import { Injectable, Logger } from '@nestjs/common';
import type {
  CreateCreditCardInput,
  CreditCardDto,
  UpdateCreditCardInput,
} from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

/** Proxies credit-card CRUD to the API-MS. All business rules live upstream; this only forwards. */
@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(private readonly api: ApiClient) {}

  list(token: string): Promise<CreditCardDto[]> {
    this.logger.log('Proxying GET /cards');
    return this.api.get<CreditCardDto[]>('/cards', { token });
  }

  create(
    token: string,
    body: CreateCreditCardInput,
    idempotencyKey?: string,
  ): Promise<CreditCardDto> {
    this.logger.log('Proxying POST /cards');
    return this.api.post<CreditCardDto>('/cards', { token, body, idempotencyKey });
  }

  update(
    token: string,
    id: string,
    body: UpdateCreditCardInput,
    idempotencyKey?: string,
  ): Promise<CreditCardDto> {
    this.logger.log(`Proxying PATCH /cards/${id}`);
    return this.api.patch<CreditCardDto>(`/cards/${id}`, { token, body, idempotencyKey });
  }

  remove(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /cards/${id}`);
    return this.api.delete<void>(`/cards/${id}`, { token, idempotencyKey });
  }
}
