export const PLUGGY_CLIENT = Symbol('PLUGGY_CLIENT');

export type PluggyItemStatus =
  | 'UPDATING'
  | 'LOGIN_ERROR'
  | 'OUTDATED'
  | 'UPDATED'
  | 'WAITING_USER_INPUT'
  | 'ERROR';

export interface PluggyConnectToken {
  connectToken: string;
  expiresAt: Date;
}

export interface PluggyItem {
  id: string;
  status: PluggyItemStatus;
  institutionId: string;
  institutionName: string;
}

export interface PluggyCreditData {
  brand: string | null;
  creditLimit: number | null;
  availableCreditLimit: number | null;
  balanceCloseDate: string | null;
  balanceDueDate: string | null;
}

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  name: string;
  number: string | null;
  balance: number;
  currencyCode: string;
  creditData: PluggyCreditData | null;
}

export interface PluggyCreditCardMetadata {
  installmentNumber: number | null;
  totalInstallments: number | null;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'POSTED';
  creditCardMetadata: PluggyCreditCardMetadata | null;
}

/** Thin authenticated client over the Pluggy REST API (docs.pluggy.ai). */
export interface PluggyClient {
  createConnectToken(input: { itemId?: string }): Promise<PluggyConnectToken>;
  getItem(itemId: string): Promise<PluggyItem>;
  forceRefreshItem(itemId: string): Promise<PluggyItem>;
  listAccounts(itemId: string): Promise<PluggyAccount[]>;
  listTransactions(accountId: string, from: Date): Promise<PluggyTransaction[]>;
}
