import { Injectable, Logger } from '@nestjs/common';
import type {
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
} from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

/** Proxies account CRUD to the API-MS. All business rules live upstream; this only forwards. */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly api: ApiClient) {}

  list(token: string): Promise<AccountDto[]> {
    this.logger.log('Proxying GET /accounts');
    return this.api.get<AccountDto[]>('/accounts', { token });
  }

  create(token: string, body: CreateAccountInput, idempotencyKey?: string): Promise<AccountDto> {
    this.logger.log('Proxying POST /accounts');
    return this.api.post<AccountDto>('/accounts', { token, body, idempotencyKey });
  }

  update(
    token: string,
    id: string,
    body: UpdateAccountInput,
    idempotencyKey?: string,
  ): Promise<AccountDto> {
    this.logger.log(`Proxying PATCH /accounts/${id}`);
    return this.api.patch<AccountDto>(`/accounts/${id}`, { token, body, idempotencyKey });
  }

  remove(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /accounts/${id}`);
    return this.api.delete<void>(`/accounts/${id}`, { token, idempotencyKey });
  }
}
