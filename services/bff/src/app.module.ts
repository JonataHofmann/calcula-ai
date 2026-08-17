import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { SessionEntity } from './auth/session/session.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [SessionEntity],
      synchronize: false,
      autoLoadEntities: true,
    }),
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
