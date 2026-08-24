import 'reflect-metadata';

import { loadDotEnv } from '@finance/config';
import { createLogger } from '@finance/logger';
import {
  createRequestLoggingMiddleware,
  PinoNestLogger,
  requestContextMixin,
} from '@finance/observability';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

loadDotEnv();

const logger = createLogger({ name: 'bff', mixin: requestContextMixin() });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new PinoNestLogger(logger));

  app.use(helmet());
  app.use(createRequestLoggingMiddleware(logger));
  app.use(cookieParser());
  const origin = process.env.WEB_URL ?? process.env.CORS_ORIGINS?.split(',') ?? [];
  console.log(`CORS:`, origin);
  app.enableCors({
    origin: process.env.WEB_URL ?? process.env.CORS_ORIGINS?.split(',') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.listen(process.env.BFF_PORT ?? 3032);
}

void bootstrap();
