import { Global, Module } from '@nestjs/common';
import { ApiClient } from './api-client';

@Global()
@Module({
  providers: [ApiClient],
  exports: [ApiClient],
})
export class SharedModule {}
