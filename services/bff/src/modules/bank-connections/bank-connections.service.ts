import { Injectable, Logger } from '@nestjs/common';
import type {
  BankConnectionCreateInput,
  BankConnectionDto,
  ConnectTokenInput,
  ConnectTokenResponse,
} from '@finance/contracts';
import { BankingApiClient } from '../../common/banking-api-client';

/** Proxies Pluggy bank-connection flows to banking-ms; all provider logic lives upstream. */
@Injectable()
export class BankConnectionsService {
  private readonly logger = new Logger(BankConnectionsService.name);

  constructor(private readonly api: BankingApiClient) {}

  createConnectToken(token: string, body: ConnectTokenInput): Promise<ConnectTokenResponse> {
    this.logger.log('Proxying POST /connect-tokens');
    return this.api.post<ConnectTokenResponse>('/connect-tokens', { token, body });
  }

  create(
    token: string,
    body: BankConnectionCreateInput,
    idempotencyKey?: string,
  ): Promise<BankConnectionDto> {
    this.logger.log('Proxying POST /bank-connections');
    return this.api.post<BankConnectionDto>('/bank-connections', { token, body, idempotencyKey });
  }

  list(token: string): Promise<BankConnectionDto[]> {
    this.logger.log('Proxying GET /bank-connections');
    return this.api.get<BankConnectionDto[]>('/bank-connections', { token });
  }

  disconnect(token: string, id: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /bank-connections/${id}`);
    return this.api.delete<void>(`/bank-connections/${id}`, { token, idempotencyKey });
  }

  refresh(token: string, id: string): Promise<void> {
    this.logger.log(`Proxying POST /bank-connections/${id}/refresh`);
    return this.api.post<void>(`/bank-connections/${id}/refresh`, { token });
  }
}
