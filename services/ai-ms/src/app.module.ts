import { Module } from '@nestjs/common';
import { AuthModule } from './common/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InvoiceImportModule } from './modules/invoice-import/invoice-import.module';

@Module({
  imports: [AuthModule, HealthModule, InvoiceImportModule],
})
export class AppModule {}
