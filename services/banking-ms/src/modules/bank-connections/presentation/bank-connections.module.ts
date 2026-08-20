import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from '@finance/config';
import { BANK_CONNECTION_REPOSITORY } from '../domain/bank-connection.repository';
import { PLUGGY_CLIENT } from '../domain/pluggy-client.port';
import { TRANSACTIONS_IMPORTER } from '../domain/transactions-importer.port';
import { BankConnectionEntity } from '../infrastructure/persistence/entities/bank-connection.entity';
import { LinkedAccountEntity } from '../infrastructure/persistence/entities/linked-account.entity';
import { LinkedCreditCardEntity } from '../infrastructure/persistence/entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from '../infrastructure/persistence/entities/synced-transaction.entity';
import { TypeOrmBankConnectionRepository } from '../infrastructure/persistence/repositories/bank-connection.repository';
import { PluggyClientAdapter } from '../infrastructure/pluggy/pluggy-client.adapter';
import { PluggyWebhookGuard } from '../infrastructure/pluggy/pluggy-webhook.guard';
import { TransactionsMsImporterAdapter } from '../infrastructure/transactions-importer/transactions-ms-importer.adapter';
import { CompleteConnectionUseCase } from '../application/use-cases/complete-connection/complete-connection';
import { CreateConnectTokenUseCase } from '../application/use-cases/create-connect-token/create-connect-token';
import { DisconnectConnectionUseCase } from '../application/use-cases/disconnect-connection/disconnect-connection';
import { ListConnectionsUseCase } from '../application/use-cases/list-connections/list-connections';
import { SyncConnectionUseCase } from '../application/use-cases/sync-connection/sync-connection';
import { TriggerManualRefreshUseCase } from '../application/use-cases/trigger-manual-refresh/trigger-manual-refresh';
import { RetryFailedImportsUseCase } from '../application/use-cases/retry-failed-imports/retry-failed-imports';
import { RetryConnectionImportsUseCase } from '../application/use-cases/retry-connection-imports/retry-connection-imports';
import { DailySyncJob } from '../infrastructure/scheduling/daily-sync.job';
import { RetryImportsJob } from '../infrastructure/scheduling/retry-imports.job';
import { BankConnectionsController } from './bank-connections.controller';
import { PluggyWebhookController } from './pluggy-webhook.controller';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var for banking-ms: ${name}`);
  }
  return value;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankConnectionEntity,
      LinkedAccountEntity,
      LinkedCreditCardEntity,
      SyncedTransactionEntity,
    ]),
  ],
  controllers: [BankConnectionsController, PluggyWebhookController],
  providers: [
    { provide: BANK_CONNECTION_REPOSITORY, useClass: TypeOrmBankConnectionRepository },
    {
      provide: PLUGGY_CLIENT,
      useFactory: () => {
        const env = loadEnv();
        return new PluggyClientAdapter(
          requireEnv('PLUGGY_API_BASE_URL', env.PLUGGY_API_BASE_URL),
          requireEnv('PLUGGY_CLIENT_ID', env.PLUGGY_CLIENT_ID),
          requireEnv('PLUGGY_CLIENT_SECRET', env.PLUGGY_CLIENT_SECRET),
        );
      },
    },
    {
      provide: TRANSACTIONS_IMPORTER,
      useFactory: () => {
        const env = loadEnv();
        const keycloakUrl = requireEnv('KEYCLOAK_URL', env.KEYCLOAK_URL);
        const keycloakRealm = requireEnv('KEYCLOAK_REALM', env.KEYCLOAK_REALM);
        return new TransactionsMsImporterAdapter(
          requireEnv('TRANSACTIONS_MS_URL', env.TRANSACTIONS_MS_URL),
          `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
          requireEnv('BANKING_MS_KEYCLOAK_CLIENT_ID', env.BANKING_MS_KEYCLOAK_CLIENT_ID),
          requireEnv('BANKING_MS_KEYCLOAK_CLIENT_SECRET', env.BANKING_MS_KEYCLOAK_CLIENT_SECRET),
        );
      },
    },
    PluggyWebhookGuard,
    CreateConnectTokenUseCase,
    CompleteConnectionUseCase,
    ListConnectionsUseCase,
    SyncConnectionUseCase,
    DisconnectConnectionUseCase,
    TriggerManualRefreshUseCase,
    RetryFailedImportsUseCase,
    RetryConnectionImportsUseCase,
    DailySyncJob,
    RetryImportsJob,
  ],
})
export class BankConnectionsModule {}
