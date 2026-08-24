import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AuthenticatedUser,
  type CategorySuggestionResult,
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
  updateTransactionInput,
  type UpdateTransactionInput,
} from '@finance/contracts';
import {
  commitInvoiceInputSchema,
  type CommitInvoiceInput,
  type CommitInvoiceResult,
} from './invoice-import.schemas';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TransactionsService } from './transactions.service';
import { TransactionConverter } from './converters/transaction.converter';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import {
  importSyncedTransactionInput,
  patchSyncedTransactionInput,
  userIdSchema,
  type ImportSyncedTransactionInput,
  type PatchSyncedTransactionInput,
  type SyncedImportResult,
} from './import-synced-transaction.schemas';

const scopePipe = new ZodValidationPipe(groupScopeSchema.optional());

/** `?descriptions=a&descriptions=b` (single value arrives as a string). */
const categorySuggestionsQuery = z.object({
  descriptions: z.preprocess(
    (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
    z.array(z.string().min(1).max(120)).min(1).max(500),
  ),
});
type CategorySuggestionsQuery = z.infer<typeof categorySuggestionsQuery>;

/**
 * HTTP surface for the transactions module: routing, request validation (Zod pipes),
 * authentication (guards + `@CurrentUser`) and DTO translation only. All business logic
 * lives in {@link TransactionsService}; responses go through {@link TransactionConverter}.
 */
@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactions: TransactionsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTransactionInput)) input: CreateTransactionInput,
  ): Promise<{ transactions: TransactionResponseDto[] }> {
    this.logger.log(`POST /transactions user=${user.id}`);
    const created = await this.transactions.create(user.id, input);
    return { transactions: created.map(TransactionConverter.toResponse) };
  }

  @Post('invoice-import')
  async commitInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(commitInvoiceInputSchema)) input: CommitInvoiceInput,
  ): Promise<CommitInvoiceResult> {
    this.logger.log(
      `POST /transactions/invoice-import user=${user.id} card=${input.creditCardId} mode=${input.mode}`,
    );
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Idempotency-Key header is required',
      });
    }
    return this.transactions.commitInvoice(user.id, input);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listTransactionsQuery)) query: ListTransactionsQuery,
  ): Promise<TransactionResponseDto[]> {
    this.logger.log(`GET /transactions user=${user.id}`);
    const transactions = await this.transactions.list(user.id, query);
    return transactions.map(TransactionConverter.toResponse);
  }

  @Get('overdue')
  async overdue(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(overdueQuery)) query: OverdueQuery,
  ): Promise<TransactionResponseDto[]> {
    this.logger.log(`GET /transactions/overdue user=${user.id}`);
    const transactions = await this.transactions.listOverdue(user.id, query);
    return transactions.map(TransactionConverter.toResponse);
  }

  @Get('forecast')
  async forecast(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(forecastQuerySchema)) query: ForecastQuery,
  ): Promise<ForecastResponse> {
    this.logger.log(`GET /transactions/forecast user=${user.id}`);
    return this.transactions.getForecast(user.id, query);
  }

  @Get('category-suggestions')
  async categorySuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(categorySuggestionsQuery)) query: CategorySuggestionsQuery,
  ): Promise<CategorySuggestionResult> {
    this.logger.log(`GET /transactions/category-suggestions user=${user.id}`);
    return this.transactions.suggestCategories(user.id, query.descriptions);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    this.logger.log(`GET /transactions/${id} user=${user.id}`);
    const transaction = await this.transactions.get(user.id, id);
    return TransactionConverter.toResponse(transaction);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTransactionInput)) input: UpdateTransactionInput,
    @Query('scope', scopePipe) scope: GroupScope | undefined,
  ): Promise<{ transactions: TransactionResponseDto[] }> {
    this.logger.log(`PATCH /transactions/${id} user=${user.id} scope=${scope ?? 'one'}`);
    const updated = await this.transactions.update(user.id, id, input, scope);
    return { transactions: updated.map(TransactionConverter.toResponse) };
  }

  @Post(':id/effectuate')
  async effectuate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(effectuateInput)) input: EffectuateInput,
  ): Promise<{ transaction: TransactionResponseDto; next: TransactionResponseDto | null }> {
    this.logger.log(`POST /transactions/${id}/effectuate user=${user.id}`);
    const { transaction, next } = await this.transactions.effectuate(user.id, id, input);
    return {
      transaction: TransactionConverter.toResponse(transaction),
      next: next ? TransactionConverter.toResponse(next) : null,
    };
  }

  @Post(':id/effectuate/undo')
  async undoEffectuate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ transaction: TransactionResponseDto }> {
    this.logger.log(`POST /transactions/${id}/effectuate/undo user=${user.id}`);
    const transaction = await this.transactions.undoEffectuate(user.id, id);
    return { transaction: TransactionConverter.toResponse(transaction) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope', scopePipe) scope: GroupScope | undefined,
  ): Promise<void> {
    this.logger.log(`DELETE /transactions/${id} user=${user.id} scope=${scope ?? 'one'}`);
    await this.transactions.delete(user.id, id, scope);
  }

  @Post('synced-import')
  @UseGuards(ServiceAccountGuard)
  async createSyncedImport(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(importSyncedTransactionInput)) input: ImportSyncedTransactionInput,
  ): Promise<SyncedImportResult> {
    this.logger.log(`POST /transactions/synced-import externalId=${input.externalId}`);
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'VALIDATION', message: 'Idempotency-Key header is required' });
    }
    return this.transactions.importSyncedCreate(input);
  }

  @Patch('synced-import/:externalId')
  @UseGuards(ServiceAccountGuard)
  async patchSyncedImport(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Body('userId', new ZodValidationPipe(userIdSchema)) userId: string,
    @Body(new ZodValidationPipe(patchSyncedTransactionInput)) patch: PatchSyncedTransactionInput,
  ): Promise<SyncedImportResult> {
    this.logger.log(`PATCH /transactions/synced-import/${externalId} user=${userId}`);
    return this.transactions.importSyncedPatch(userId, externalId, patch);
  }

  @Delete('synced-import/:externalId')
  @HttpCode(204)
  @UseGuards(ServiceAccountGuard)
  async removeSyncedImport(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Body('userId', new ZodValidationPipe(userIdSchema)) userId: string,
  ): Promise<void> {
    this.logger.log(`DELETE /transactions/synced-import/${externalId} user=${userId}`);
    await this.transactions.importSyncedDelete(userId, externalId);
  }
}
