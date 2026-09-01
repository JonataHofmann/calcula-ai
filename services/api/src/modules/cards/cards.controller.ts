import {
  Body,
  Controller,
  Delete,
  Get,
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
  createCreditCardInput,
  type CreateCreditCardInput,
  updateCreditCardInput,
  type UpdateCreditCardInput,
  type AuthenticatedUser,
  type TransactionCountResult,
} from '@finance/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CardsService } from './cards.service';
import { CardResponseDto } from './dto/card-response.dto';
import {
  createSyncedCardInput,
  type CreateSyncedCardInput,
} from './dto/create-synced-card.schema';

/** `?deleteTransactions=true` → also delete the entity's transactions. Absent/false → keep them. */
const deleteTransactionsPipe = new ZodValidationPipe(
  z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
);

@Controller('cards')
export class CardsController {
  private readonly logger = new Logger(CardsController.name);

  constructor(private readonly cards: CardsService) {}

  @Get(':id/transaction-count')
  async transactionCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionCountResult> {
    return { count: await this.cards.countTransactions(user.id, id) };
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CardResponseDto[]> {
    this.logger.log(`GET /cards user=${user.id}`);
    return this.cards.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCreditCardInput)) input: CreateCreditCardInput,
  ): Promise<CardResponseDto> {
    this.logger.log(`POST /cards user=${user.id}`);
    return this.cards.create(user.id, input);
  }

  /** Cross-service creation from banking-ms's Pluggy sync — never in the public BFF/web API. */
  @Post('synced-create')
  @UseGuards(ServiceAccountGuard)
  createSynced(
    @Body(new ZodValidationPipe(createSyncedCardInput)) input: CreateSyncedCardInput,
  ): Promise<CardResponseDto> {
    const { userId, ...rest } = input;
    this.logger.log(`POST /cards/synced-create user=${userId}`);
    return this.cards.create(userId, rest);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCreditCardInput)) input: UpdateCreditCardInput,
  ): Promise<CardResponseDto> {
    this.logger.log(`PATCH /cards/${id} user=${user.id}`);
    return this.cards.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('deleteTransactions', deleteTransactionsPipe) deleteTransactions: boolean,
  ): Promise<void> {
    this.logger.log(`DELETE /cards/${id} user=${user.id} deleteTransactions=${deleteTransactions}`);
    await this.cards.delete(user.id, id, deleteTransactions);
  }
}
