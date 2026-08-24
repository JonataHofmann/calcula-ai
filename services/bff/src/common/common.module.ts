import { Global, Module } from '@nestjs/common';
import { ApiClient } from './api-client';
import { BankingApiClient } from './banking-api-client';
import { AiApiClient } from './ai-api-client';

@Global()
@Module({
  providers: [ApiClient, BankingApiClient, AiApiClient],
  exports: [ApiClient, BankingApiClient, AiApiClient],
})
export class CommonModule {}
