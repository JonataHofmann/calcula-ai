import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AuthenticatedUser,
  createTransactionInput,
  type CreateTransactionInput,
  effectuateInput,
  type EffectuateInput,
  forecastQuerySchema,
  type ForecastQuery,
  type ForecastResponse,
  groupScopeSchema,
  type GroupScope,
  listTransactionsQuery,
  type ListTransactionsQuery,
  overdueQuery,
  type OverdueQuery,
  type TransactionDto,
  updateTransactionInput,
  type UpdateTransactionInput,
} from '@finance/contracts';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { Transaction } from '../domain/transaction';
import { CreateTransactionUseCase } from '../application/use-cases/create-transaction/create-transaction';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions/list-transactions';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction/get-transaction';
import { UpdateTransactionUseCase } from '../application/use-cases/update-transaction/update-transaction';
import { DeleteTransactionUseCase } from '../application/use-cases/delete-transaction/delete-transaction';
import { EffectuateTransactionUseCase } from '../application/use-cases/effectuate-transaction/effectuate-transaction';
import { ListOverdueUseCase } from '../application/use-cases/list-overdue/list-overdue';
import { GetForecastUseCase } from '../application/use-cases/get-forecast/get-forecast';

const scopePipe = new ZodValidationPipe(groupScopeSchema.optional());

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly listTransactions: ListTransactionsUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly updateTransaction: UpdateTransactionUseCase,
    private readonly deleteTransaction: DeleteTransactionUseCase,
    private readonly effectuateTransaction: EffectuateTransactionUseCase,
    private readonly listOverdue: ListOverdueUseCase,
    private readonly getForecast: GetForecastUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTransactionInput)) input: CreateTransactionInput,
  ): Promise<{ transactions: TransactionDto[] }> {
    const created = await this.createTransaction.execute(user.id, input);
    return { transactions: created.map(toDto) };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listTransactionsQuery)) query: ListTransactionsQuery,
  ): Promise<TransactionDto[]> {
    const transactions = await this.listTransactions.execute(user.id, query);
    return transactions.map(toDto);
  }

  @Get('overdue')
  async overdue(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(overdueQuery)) query: OverdueQuery,
  ): Promise<TransactionDto[]> {
    const transactions = await this.listOverdue.execute(user.id, query);
    return transactions.map(toDto);
  }

  @Get('forecast')
  async forecast(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(forecastQuerySchema)) query: ForecastQuery,
  ): Promise<ForecastResponse> {
    return this.getForecast.execute(user.id, query);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    const transaction = await this.getTransaction.execute(user.id, id);
    return toDto(transaction);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTransactionInput)) input: UpdateTransactionInput,
    @Query('scope', scopePipe) scope: GroupScope | undefined,
  ): Promise<{ transactions: TransactionDto[] }> {
    const updated = await this.updateTransaction.execute(user.id, id, input, scope);
    return { transactions: updated.map(toDto) };
  }

  @Post(':id/effectuate')
  async effectuate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(effectuateInput)) input: EffectuateInput,
  ): Promise<{ transaction: TransactionDto; next: TransactionDto | null }> {
    const { transaction, next } = await this.effectuateTransaction.execute(user.id, id, input);
    return { transaction: toDto(transaction), next: next ? toDto(next) : null };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope', scopePipe) scope: GroupScope | undefined,
  ): Promise<void> {
    await this.deleteTransaction.execute(user.id, id, scope);
  }
}

/** Domain -> HTTP contract. No userId/createdAt/updatedAt (FR-023); dates as ISO instants. */
function toDto(t: Transaction): TransactionDto {
  return {
    id: t.id,
    description: t.description,
    dueDate: t.dueDate.toISOString(),
    amount: t.amount,
    effectiveAmount: t.effectiveAmount,
    recurrence: t.recurrence,
    effectiveDate: t.effectiveDate ? t.effectiveDate.toISOString() : null,
    type: t.type,
    notes: t.notes,
    status: t.status,
    endDate: t.endDate ? t.endDate.toISOString() : null,
    installmentCount: t.installmentCount,
    installmentNumber: t.installmentNumber,
    groupId: t.groupId,
    categoryId: t.categoryId,
    accountId: t.accountId,
    creditCardId: t.creditCardId,
  };
}
