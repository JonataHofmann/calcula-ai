import 'reflect-metadata';

import { loadDotEnv } from '@finance/config';

// ANTES de importar AppModule: o TypeORM.forRoot lê process.env.DATABASE_URL no
// import do módulo. Carregar o .env aqui garante que as envs existam nesse ponto.
loadDotEnv();

import { createLogger } from '@finance/logger';
import {
  createRequestLoggingMiddleware,
  PinoNestLogger,
  requestContextMixin,
} from '@finance/observability';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppModule } from './app.module';

const logger = createLogger({ name: 'bff', mixin: requestContextMixin() });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(new PinoNestLogger(logger));

  app.use(helmet());
  app.use(createRequestLoggingMiddleware(logger));
  app.use(cookieParser());
  // Backup import envia um snapshot JSON grande — bem acima do default de 100kb.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  const origin = process.env.WEB_URL ?? process.env.CORS_ORIGINS?.split(',') ?? [];
  console.log(`CORS:`, origin);
  app.enableCors({
    origin: process.env.WEB_URL ?? process.env.CORS_ORIGINS?.split(',') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Erro rastreável SEMPRE: qual microserviço falhou, status/corpo do upstream, stack,
  // requestId/correlationId. Nunca "Internal Server Error" nu.
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.BFF_PORT ?? 3032);
}

void bootstrap();
