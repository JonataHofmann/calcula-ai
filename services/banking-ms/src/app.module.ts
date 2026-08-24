import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './common/auth.module';
import { HealthModule } from './modules/health/health.module';
import { BankConnectionsModule } from './modules/bank-connections/bank-connections.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: 'banking',
      synchronize: false,
      autoLoadEntities: true,
      // Roda migrations pendentes no boot (Docker/prod). Idempotente: só aplica o que falta.
      migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
      migrationsRun: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    HealthModule,
    BankConnectionsModule,
  ],
})
export class AppModule {}
