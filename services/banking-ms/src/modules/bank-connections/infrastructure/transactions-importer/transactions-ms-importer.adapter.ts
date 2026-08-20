import type {
  CreateSyncedAccountInput,
  CreateSyncedCardInput,
  ImportTransactionInput,
  TransactionsImporter,
  UpdateTransactionInput,
} from '../../domain/transactions-importer.port';

import { Injectable, Logger } from '@nestjs/common';

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SyncedImportResponse {
  id: string;
  source: 'synced';
  externalId: string;
  pluggyStatus: 'pending' | 'posted';
}

interface SyncedResourceResponse {
  id: string;
}

const TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS = 30;

/** Calls services/api's transactions-import-api contract using a Keycloak client-credentials service token. */
@Injectable()
export class TransactionsMsImporterAdapter implements TransactionsImporter {
  private readonly logger = new Logger(TransactionsMsImporterAdapter.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly transactionsApiBaseUrl: string,
    private readonly keycloakTokenUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async importTransaction(input: ImportTransactionInput): Promise<{ transactionsMsId: string }> {
    const response = await this.request<SyncedImportResponse>(
      'POST',
      '/transactions/synced-import',
      input.pluggyTransactionId,
      {
        userId: input.userId,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate.toISOString(),
        type: input.type,
        accountId: input.accountId,
        creditCardId: input.creditCardId,
        source: 'synced',
        externalId: input.pluggyTransactionId,
        pluggyStatus: input.pluggyStatus,
        installmentNumber: input.installmentNumber ?? null,
        installmentCount: input.installmentCount ?? null,
      },
    );
    return { transactionsMsId: response.id };
  }

  async updateTransaction(input: UpdateTransactionInput): Promise<void> {
    const { userId, pluggyTransactionId, dueDate, ...rest } = input;
    await this.request<SyncedImportResponse>(
      'PATCH',
      `/transactions/synced-import/${encodeURIComponent(pluggyTransactionId)}`,
      pluggyTransactionId,
      { userId, ...rest, ...(dueDate ? { dueDate: dueDate.toISOString() } : {}) },
    );
  }

  async deleteTransaction(userId: string, pluggyTransactionId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/transactions/synced-import/${encodeURIComponent(pluggyTransactionId)}`,
      pluggyTransactionId,
      { userId },
    );
  }

  async createSyncedAccount(input: CreateSyncedAccountInput): Promise<{ id: string }> {
    const { pluggyAccountId, ...rest } = input;
    const response = await this.request<SyncedResourceResponse>(
      'POST',
      '/accounts/synced-create',
      `account:${pluggyAccountId}`,
      rest,
    );
    return { id: response.id };
  }

  async createSyncedCard(input: CreateSyncedCardInput): Promise<{ id: string }> {
    const { pluggyAccountId, ...rest } = input;
    const response = await this.request<SyncedResourceResponse>(
      'POST',
      '/cards/synced-create',
      `card:${pluggyAccountId}`,
      rest,
    );
    return { id: response.id };
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }
    const response = await fetch(this.keycloakTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(`Keycloak service-account token request failed with status ${response.status}`);
    }
    const data = (await response.json()) as KeycloakTokenResponse;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt =
      Date.now() + (data.expires_in - TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS) * 1000;
    return this.accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    pluggyTransactionId: string,
    body: unknown,
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const idempotencyKey = `banking-ms:${pluggyTransactionId}`;
    this.logger.debug(
      `-> ${method} ${path} [${idempotencyKey}] ${JSON.stringify(body)}`,
    );
    const response = await fetch(`${this.transactionsApiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let responseBody: string;
      try {
        responseBody = await response.text();
      } catch {
        responseBody = '<unreadable body>';
      }
      this.logger.error(
        `<- ${method} ${path} [${idempotencyKey}] failed with status ${response.status}: ${responseBody}`,
      );
      throw new Error(
        `Transactions import ${method} ${path} failed with status ${response.status}: ${responseBody}`,
      );
    }
    if (response.status === 204) {
      this.logger.debug(`<- ${method} ${path} [${idempotencyKey}] ${response.status}`);
      return undefined as T;
    }
    const json = await response.json();
    this.logger.debug(`<- ${method} ${path} [${idempotencyKey}] ${response.status} ${JSON.stringify(json)}`);
    return json as T;
  }
}
