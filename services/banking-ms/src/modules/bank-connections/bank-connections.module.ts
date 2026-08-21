import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from '@finance/config';
import { BankConnectionsController } from './bank-connections.controller';
import { PluggyWebhookController } from './pluggy-webhook.controller';
import { BankConnectionsService } from './bank-connections.service';
import { BankConnectionEntity } from './entities/bank-connection.entity';
import { LinkedAccountEntity } from './entities/linked-account.entity';
import { LinkedCreditCardEntity } from './entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from './entities/synced-transaction.entity';
import { PLUGGY_CLIENT } from './pluggy-client.port';
import { TRANSACTIONS_IMPORTER } from './transactions-importer.port';
import { PluggyClientAdapter } from './pluggy-client.adapter';
import { PluggyWebhookGuard } from './pluggy-webhook.guard';
import { TransactionsMsImporterAdapter } from './transactions-ms-importer.adapter';
import { DailySyncJob } from './scheduling/daily-sync.job';
import { RetryImportsJob } from './scheduling/retry-imports.job';

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
    BankConnectionsService,
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
    DailySyncJob,
    RetryImportsJob,
  ],
})
export class BankConnectionsModule {}
