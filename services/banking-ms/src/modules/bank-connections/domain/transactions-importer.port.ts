export const TRANSACTIONS_IMPORTER = Symbol('TRANSACTIONS_IMPORTER');

export type ImportedTransactionType = 'expense' | 'income';

export interface ImportTransactionInput {
  userId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  dueDate: Date;
  type: ImportedTransactionType;
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

/**
 * Service-to-service client for services/api's transactions-import-api contract.
 * Never bare `status` — `pluggyStatus` avoids colliding with the domestic TransactionStatus enum.
 */
export interface TransactionsImporter {
  importTransaction(input: ImportTransactionInput): Promise<{ transactionsMsId: string }>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(userId: string, pluggyTransactionId: string): Promise<void>;
}
