import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  bankConnectionCreateInput,
  type BankConnectionCreateInput,
  type BankConnectionDto,
  connectTokenInput,
  type ConnectTokenInput,
  type ConnectTokenResponse,
} from '@finance/contracts';
import type { AuthenticatedUser } from '@finance/contracts';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { BankConnectionProps } from '../domain/bank-connection';
import type { LinkedAccountProps } from '../domain/linked-account';
import type { LinkedCreditCardProps } from '../domain/linked-credit-card';
import { CompleteConnectionUseCase } from '../application/use-cases/complete-connection/complete-connection';
import { CreateConnectTokenUseCase } from '../application/use-cases/create-connect-token/create-connect-token';
import { DisconnectConnectionUseCase } from '../application/use-cases/disconnect-connection/disconnect-connection';
import { ListConnectionsUseCase } from '../application/use-cases/list-connections/list-connections';
import { TriggerManualRefreshUseCase } from '../application/use-cases/trigger-manual-refresh/trigger-manual-refresh';

@Controller()
export class BankConnectionsController {
  constructor(
    private readonly createConnectToken: CreateConnectTokenUseCase,
    private readonly completeConnection: CompleteConnectionUseCase,
    private readonly listConnections: ListConnectionsUseCase,
    private readonly disconnectConnection: DisconnectConnectionUseCase,
    private readonly triggerManualRefresh: TriggerManualRefreshUseCase,
  ) {}

  @Post('connect-tokens')
  async createToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(connectTokenInput)) input: ConnectTokenInput,
  ): Promise<ConnectTokenResponse> {
    const result = await this.createConnectToken.execute(
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
    const connection = await this.completeConnection.execute({
      userId: user.id,
      pluggyItemId: input.pluggyItemId,
    });
    return toDto({ ...connection, accounts: [], creditCards: [] });
  }

  @Get('bank-connections')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<BankConnectionDto[]> {
    const connections = await this.listConnections.execute({ userId: user.id });
    return connections.map(toDto);
  }

  @Delete('bank-connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.disconnectConnection.execute({ id, userId: user.id });
  }

  @Post('bank-connections/:id/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async refresh(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.triggerManualRefresh.execute({ bankConnectionId: id, userId: user.id });
  }
}

/** Domain -> HTTP contract. Sync runs async (AGENTS.md rule 8), so accounts/cards are empty right after creation. */
function toDto(
  connection: BankConnectionProps & { accounts: LinkedAccountProps[]; creditCards: LinkedCreditCardProps[] },
): BankConnectionDto {
  return {
    id: connection.id,
    institutionName: connection.institutionName,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
    createdAt: connection.createdAt.toISOString(),
    accounts: connection.accounts.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      type: a.type,
      balance: a.balance,
      currency: a.currency,
    })),
    creditCards: connection.creditCards.map((c) => ({
      id: c.id,
      brand: c.brand,
      lastDigits: c.lastDigits,
      currentBalance: c.currentBalance,
      creditLimit: c.creditLimit,
    })),
  };
}
