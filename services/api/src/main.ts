import 'reflect-metadata';
import { loadDotEnv } from '@finance/config';
loadDotEnv();
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createLogger } from '@finance/logger';
import {
  createRequestLoggingMiddleware,
  PinoNestLogger,
  requestContextMixin,
} from '@finance/observability';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

const logger = createLogger({ name: 'api', mixin: requestContextMixin() });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new PinoNestLogger(logger));

  app.use(helmet());
  app.use(createRequestLoggingMiddleware(logger));
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? [], credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Finance Platform API')
    .setDescription('API-MS: modular monolith for personal finance domains')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.API_PORT ?? 3031);
}

void bootstrap();
