import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  CreateTransactionInput,
  EffectuateInput,
  ForecastQuery,
  ForecastResponse,
  TransactionDto,
  UpdateTransactionInput,
} from '@finance/contracts';
import type { Request } from 'express';
import {
  TransactionsService,
  type CreateResult,
  type EffectuateResult,
} from './transactions.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies transaction endpoints to the API-MS. All money/scope rules live in the API-MS (regra 6). */
@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(
    @Req() req: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<TransactionDto[]> {
    this.logger.log('GET /transactions');
    return this.transactions.list(tokenOf(req), query);
  }

  @Get('overdue')
  overdue(
    @Req() req: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<TransactionDto[]> {
    this.logger.log('GET /transactions/overdue');
    return this.transactions.overdue(tokenOf(req), query);
  }

  @Get('forecast')
  forecast(
    @Req() req: SessionRequest,
    @Query() query: ForecastQuery,
  ): Promise<ForecastResponse> {
    this.logger.log('GET /transactions/forecast');
    return this.transactions.forecast(tokenOf(req), query);
  }

  @Get(':id')
  get(@Req() req: SessionRequest, @Param('id') id: string): Promise<TransactionDto> {
    this.logger.log(`GET /transactions/${id}`);
    return this.transactions.get(tokenOf(req), id);
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateTransactionInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateResult> {
    this.logger.log('POST /transactions');
    return this.transactions.create(tokenOf(req), body, idempotencyKey);
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateTransactionInput,
    @Query('scope') scope?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateResult> {
    this.logger.log(`PATCH /transactions/${id}`);
    return this.transactions.update(tokenOf(req), id, body, scope, idempotencyKey);
  }

  @Post(':id/effectuate')
  effectuate(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: EffectuateInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<EffectuateResult> {
    this.logger.log(`POST /transactions/${id}/effectuate`);
    return this.transactions.effectuate(tokenOf(req), id, body, idempotencyKey);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Query('scope') scope?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /transactions/${id}`);
    return this.transactions.remove(tokenOf(req), id, scope, idempotencyKey);
  }
}
