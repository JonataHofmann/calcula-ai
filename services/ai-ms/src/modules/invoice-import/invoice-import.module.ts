import { Module } from '@nestjs/common';
import { AI_PROVIDER } from '../../common/ai-provider.token';
import { RouterAiProvider } from '../../providers/router-ai.provider';
import { InvoiceImportController } from './invoice-import.controller';
import { InvoiceImportService } from './invoice-import.service';

@Module({
  controllers: [InvoiceImportController],
  providers: [
    InvoiceImportService,
    { provide: AI_PROVIDER, useClass: RouterAiProvider },
  ],
})
export class InvoiceImportModule {}
