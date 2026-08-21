import { Global, Module } from '@nestjs/common';
import { ApiClient } from './api-client';
import { BankingApiClient } from './banking-api-client';

@Global()
@Module({
  providers: [ApiClient, BankingApiClient],
  exports: [ApiClient, BankingApiClient],
})
export class CommonModule {}
