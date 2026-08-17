import { Module } from '@nestjs/common';
import { AuthModule } from './common/auth/auth.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [AuthModule, HealthModule],
})
export class AppModule {}
