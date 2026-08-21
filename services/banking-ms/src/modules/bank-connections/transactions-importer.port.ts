export const TRANSACTIONS_IMPORTER = Symbol('TRANSACTIONS_IMPORTER');

export type ImportedTransactionType = 'expense' | 'income';

export interface ImportTransactionInput {
  userId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  dueDate: Date;
  type: ImportedTransactionType;
  accountId: string | null;
  creditCardId: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  pluggyStatus: 'pending' | 'posted';
}

export interface UpdateTransactionInput {
  userId: string;
  pluggyTransactionId: string;
  description?: string;
  amount?: string;
  dueDate?: Date;
  pluggyStatus?: 'pending' | 'posted';
  installmentNumber?: number | null;
  installmentCount?: number | null;
}

export interface CreateSyncedAccountInput {
  userId: string;
  pluggyAccountId: string;
  name: string;
  bankId: string;
  icon: string;
  color: string;
}

export interface CreateSyncedCardInput {
  userId: string;
  pluggyAccountId: string;
  name: string;
  lastDigits: string;
  dueDay: number;
  closingDay: number;
  limit: string;
  brandId: string;
}

/**
 * Service-to-service client for services/api's transactions-import-api contract,
 * plus the synced-create routes used to materialize a real Account/CreditCard from a Pluggy sync.
 * Never bare `status` — `pluggyStatus` avoids colliding with the domestic TransactionStatus enum.
 */
export interface TransactionsImporter {
  importTransaction(input: ImportTransactionInput): Promise<{ transactionsMsId: string }>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(userId: string, pluggyTransactionId: string): Promise<void>;
  createSyncedAccount(input: CreateSyncedAccountInput): Promise<{ id: string }>;
  createSyncedCard(input: CreateSyncedCardInput): Promise<{ id: string }>;
}
