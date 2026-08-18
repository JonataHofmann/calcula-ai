import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateTransactionInput } from '@finance/contracts';
import { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import {
  ACCOUNT_LOOKUP,
  CARD_LOOKUP,
  CATEGORY_LOOKUP,
  type AccountLookup,
  type CardLookup,
  type CategoryLookup,
} from '../../../domain/lookups';
import { addMonthClamped, splitInstallments, toCents } from '../../../domain/recurrence';
import { validateReferences } from '../../shared/validate-references';

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CATEGORY_LOOKUP) private readonly categories: CategoryLookup,
    @Inject(ACCOUNT_LOOKUP) private readonly accounts: AccountLookup,
    @Inject(CARD_LOOKUP) private readonly cards: CardLookup,
  ) {}

  async execute(userId: string, input: CreateTransactionInput): Promise<Transaction[]> {
    await validateReferences(
      userId,
      {
        type: input.type,
        categoryId: input.categoryId,
        accountId: input.accountId ?? null,
        creditCardId: input.creditCardId ?? null,
      },
      { categories: this.categories, accounts: this.accounts, cards: this.cards },
    );

    const dueDate = new Date(input.dueDate);
    const common = {
      userId,
      description: input.description,
      type: input.type,
      categoryId: input.categoryId,
      accountId: input.accountId ?? null,
      creditCardId: input.creditCardId ?? null,
      notes: input.notes ?? null,
    };

    if (input.recurrence === 'installment') {
      const groupId = randomUUID();
      const count = input.installmentCount;
      const amounts =
        input.totalAmount !== undefined
          ? splitInstallments(toCents(input.totalAmount), count)
          : Array.from({ length: count }, () => input.amount as string);
      const rows = amounts.map((amount, i) =>
        Transaction.create({
          ...common,
          id: randomUUID(),
          recurrence: 'installment',
          amount,
          dueDate: addMonthClamped(dueDate, i),
          installmentCount: count,
          installmentNumber: i + 1,
          groupId,
        }),
      );
      await this.transactions.createMany(rows);
      return rows;
    }

    if (input.recurrence === 'fixed') {
      const transaction = Transaction.create({
        ...common,
        id: randomUUID(),
        recurrence: 'fixed',
        amount: input.amount,
        dueDate,
        endDate: input.endDate ? new Date(input.endDate) : null,
        groupId: randomUUID(),
      });
      await this.transactions.create(transaction);
      return [transaction];
    }

    const transaction = Transaction.create({
      ...common,
      id: randomUUID(),
      recurrence: 'single',
      amount: input.amount,
      dueDate,
    });
    await this.transactions.create(transaction);
    return [transaction];
  }
}
