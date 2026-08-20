import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './common/auth/auth.module';
import { HealthModule } from './common/health/health.module';
import { BankConnectionsModule } from './modules/bank-connections/presentation/bank-connections.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: 'banking',
      synchronize: false,
      autoLoadEntities: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    HealthModule,
    BankConnectionsModule,
  ],
})
export class AppModule {}
