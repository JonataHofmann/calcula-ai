import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Post } from '@nestjs/common';
import {
  bankConnectionCreateInput,
  type BankConnectionCreateInput,
  type BankConnectionDto,
  connectTokenInput,
  type ConnectTokenInput,
  type ConnectTokenResponse,
  refreshBankConnectionInput,
  type RefreshBankConnectionInput,
  type RetryConnectionImportsResponse,
} from '@finance/contracts';
import type { AuthenticatedUser } from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BankConnectionsService } from './bank-connections.service';
import { BankConnectionConverter } from './converters/bank-connection.converter';

@Controller()
export class BankConnectionsController {
  private readonly logger = new Logger(BankConnectionsController.name);

  constructor(private readonly service: BankConnectionsService) {}

  @Post('connect-tokens')
  async createToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(connectTokenInput)) input: ConnectTokenInput,
  ): Promise<ConnectTokenResponse> {
    this.logger.log(`POST /connect-tokens (mode=${input.mode}) for user ${user.id}`);
    const result = await this.service.createConnectToken(
      input.mode === 'reauth'
        ? { userId: user.id, mode: 'reauth', bankConnectionId: input.bankConnectionId }
        : { userId: user.id, mode: 'create' },
    );
    return { connectToken: result.connectToken, expiresAt: result.expiresAt.toISOString() };
  }

  @Post('bank-connections')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(bankConnectionCreateInput)) input: BankConnectionCreateInput,
  ): Promise<BankConnectionDto> {
    this.logger.log(`POST /bank-connections (item=${input.pluggyItemId}) for user ${user.id}`);
    const connection = await this.service.completeConnection({
      userId: user.id,
      pluggyItemId: input.pluggyItemId,
    });
    return BankConnectionConverter.toResponse({
      ...connection,
      accounts: [],
      creditCards: [],
      transactionsTotal: 0,
      transactionsErrored: 0,
    });
  }

  @Get('bank-connections')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<BankConnectionDto[]> {
    this.logger.log(`GET /bank-connections for user ${user.id}`);
    const connections = await this.service.listConnections({ userId: user.id });
    return connections.map((c) => BankConnectionConverter.toResponse(c));
  }

  @Delete('bank-connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /bank-connections/${id} for user ${user.id}`);
    await this.service.disconnectConnection({ id, userId: user.id });
  }

  @Post('bank-connections/:id/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(refreshBankConnectionInput)) input: RefreshBankConnectionInput,
  ): Promise<void> {
    this.logger.log(`POST /bank-connections/${id}/refresh (forceFullSync=${input.forceFullSync}) for user ${user.id}`);
    await this.service.triggerManualRefresh({
      bankConnectionId: id,
      userId: user.id,
      forceFullSync: input.forceFullSync,
    });
  }

  @Post('bank-connections/:id/retry-imports')
  @HttpCode(HttpStatus.OK)
  async retryImports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RetryConnectionImportsResponse> {
    this.logger.log(`POST /bank-connections/${id}/retry-imports for user ${user.id}`);
    return this.service.retryConnectionImports({ bankConnectionId: id, userId: user.id });
  }
}
