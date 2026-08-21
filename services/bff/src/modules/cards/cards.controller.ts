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
  Req,
} from '@nestjs/common';
import type {
  CreateCreditCardInput,
  CreditCardDto,
  UpdateCreditCardInput,
} from '@finance/contracts';
import type { Request } from 'express';
import { CardsService } from './cards.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies credit-card CRUD to the API-MS, scoped by the caller's session token. */
@Controller('cards')
export class CardsController {
  private readonly logger = new Logger(CardsController.name);

  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Req() req: SessionRequest): Promise<CreditCardDto[]> {
    this.logger.log('GET /cards');
    return this.cards.list(tokenOf(req));
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateCreditCardInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreditCardDto> {
    this.logger.log('POST /cards');
    return this.cards.create(tokenOf(req), body, idempotencyKey);
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateCreditCardInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreditCardDto> {
    this.logger.log(`PATCH /cards/${id}`);
    return this.cards.update(tokenOf(req), id, body, idempotencyKey);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /cards/${id}`);
    return this.cards.remove(tokenOf(req), id, idempotencyKey);
  }
}
