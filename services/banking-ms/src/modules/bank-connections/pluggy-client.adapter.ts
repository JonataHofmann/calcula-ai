import { Injectable } from '@nestjs/common';
import { ItemAlreadyUpdatingError } from './errors';
import type {
  PluggyAccount,
  PluggyClient,
  PluggyConnectToken,
  PluggyCreditData,
  PluggyItem,
  PluggyItemStatus,
  PluggyTransaction,
} from './pluggy-client.port';

/** Thrown by `request()` with the HTTP status so callers can map specific codes to domain errors. */
class PluggyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PluggyApiError';
  }
}

interface PluggyItemResponse {
  id: string;
  status: PluggyItemStatus;
  connector: { id: number | string; name: string };
}

interface PluggyAccountResponse {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  name: string;
  number: string | null;
  balance: number;
  currencyCode: string;
  creditData: {
    brand: string | null;
    creditLimit: number | null;
    availableCreditLimit: number | null;
    balanceCloseDate: string | null;
    balanceDueDate: string | null;
  } | null;
}

interface PluggyTransactionResponse {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'POSTED';
  creditCardMetadata: { installmentNumber: number | null; totalInstallments: number | null } | null;
}

interface PluggyAuthResponse {
  apiKey: string;
}

const API_KEY_TTL_MS = 110 * 60 * 1000;

@Injectable()
export class PluggyClientAdapter implements PluggyClient {
  private apiKey: string | null = null;
  private apiKeyExpiresAt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async createConnectToken(input: { itemId?: string }): Promise<PluggyConnectToken> {
    const response = await this.request<{ accessToken: string }>(
      'POST',
      '/connect_token',
      input.itemId ? { itemId: input.itemId } : {},
    );
    return { connectToken: response.accessToken, expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    return toItem(await this.request<PluggyItemResponse>('GET', `/items/${itemId}`));
  }

  async forceRefreshItem(itemId: string): Promise<PluggyItem> {
    try {
      return toItem(await this.request<PluggyItemResponse>('PATCH', `/items/${itemId}`));
    } catch (error) {
      if (error instanceof PluggyApiError && error.status === 409) {
        throw new ItemAlreadyUpdatingError(itemId);
      }
      throw error;
    }
  }

  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const response = await this.request<{ results: PluggyAccountResponse[] }>(
      'GET',
      `/accounts?itemId=${encodeURIComponent(itemId)}`,
    );
    return response.results.map(toAccount);
  }

  async listTransactions(accountId: string, from: Date): Promise<PluggyTransaction[]> {
    const fromDate = from.toISOString().slice(0, 10);
    const transactions: PluggyTransactionResponse[] = [];
    let path: string | null =
      `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${fromDate}`;
    while (path) {
      const response: { results: PluggyTransactionResponse[]; next: string | null } = await this.request<{
        results: PluggyTransactionResponse[];
        next: string | null;
      }>('GET', path);
      transactions.push(...response.results);
      path = response.next ? `/v2/transactions${response.next}` : null;
    }
    return transactions.map(toTransaction);
  }

  private async ensureApiKey(): Promise<string> {
    if (this.apiKey && Date.now() < this.apiKeyExpiresAt) {
      return this.apiKey;
    }
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });
    if (!response.ok) {
      throw new Error(`Pluggy authentication failed with status ${response.status}`);
    }
    const data = (await response.json()) as PluggyAuthResponse;
    this.apiKey = data.apiKey;
    this.apiKeyExpiresAt = Date.now() + API_KEY_TTL_MS;
    return this.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const apiKey = await this.ensureApiKey();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new PluggyApiError(
        `Pluggy request ${method} ${path} failed with status ${response.status}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}

function toItem(response: PluggyItemResponse): PluggyItem {
  return {
    id: response.id,
    status: response.status,
    institutionId: String(response.connector.id),
    institutionName: response.connector.name,
  };
}

function toAccount(response: PluggyAccountResponse): PluggyAccount {
  return {
    id: response.id,
    itemId: response.itemId,
    type: response.type,
    name: response.name,
    number: response.number,
    balance: response.balance,
    currencyCode: response.currencyCode,
    creditData: response.creditData ? toCreditData(response.creditData) : null,
  };
}

function toCreditData(creditData: NonNullable<PluggyAccountResponse['creditData']>): PluggyCreditData {
  return {
    brand: creditData.brand,
    creditLimit: creditData.creditLimit,
    availableCreditLimit: creditData.availableCreditLimit,
    balanceCloseDate: creditData.balanceCloseDate,
    balanceDueDate: creditData.balanceDueDate,
  };
}

function toTransaction(response: PluggyTransactionResponse): PluggyTransaction {
  return {
    id: response.id,
    accountId: response.accountId,
    description: response.description,
    amount: response.amount,
    date: response.date,
    type: response.type,
    status: response.status,
    creditCardMetadata: response.creditCardMetadata,
  };
}
