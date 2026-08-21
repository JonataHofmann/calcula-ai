import 'reflect-metadata';
import { loadDotEnv } from '@finance/config';
loadDotEnv();
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@finance/logger';
import { createRequestLoggingMiddleware } from '@finance/observability';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

const logger = createLogger({ name: 'bff' });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(createRequestLoggingMiddleware(logger));
  app.use(cookieParser());
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
