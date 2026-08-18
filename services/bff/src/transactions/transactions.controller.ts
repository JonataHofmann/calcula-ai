import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  CreateTransactionInput,
  EffectuateInput,
  TransactionDto,
  UpdateTransactionInput,
} from '@finance/contracts';
import type { Request } from 'express';
import { ApiClient } from '../shared/api-client';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

function withQuery(path: string, query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

interface CreateResult {
  transactions: TransactionDto[];
}

interface EffectuateResult {
  transaction: TransactionDto;
  next: TransactionDto | null;
}

/** Proxies transaction endpoints to the API-MS. All money/scope rules live in the API-MS (regra 6). */
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly api: ApiClient) {}

  @Get()
  list(
    @Req() req: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<TransactionDto[]> {
    return this.api.get<TransactionDto[]>(withQuery('/transactions', query), {
      token: tokenOf(req),
    });
  }

  @Get('overdue')
  overdue(
    @Req() req: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<TransactionDto[]> {
    return this.api.get<TransactionDto[]>(withQuery('/transactions/overdue', query), {
      token: tokenOf(req),
    });
  }

  @Get(':id')
  get(@Req() req: SessionRequest, @Param('id') id: string): Promise<TransactionDto> {
    return this.api.get<TransactionDto>(`/transactions/${id}`, { token: tokenOf(req) });
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateTransactionInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateResult> {
    return this.api.post<CreateResult>('/transactions', {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateTransactionInput,
    @Query('scope') scope?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateResult> {
    return this.api.patch<CreateResult>(withQuery(`/transactions/${id}`, { scope }), {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Post(':id/effectuate')
  effectuate(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: EffectuateInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<EffectuateResult> {
    return this.api.post<EffectuateResult>(`/transactions/${id}/effectuate`, {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Query('scope') scope?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.delete<void>(withQuery(`/transactions/${id}`, { scope }), {
      token: tokenOf(req),
      idempotencyKey,
    });
  }
}
