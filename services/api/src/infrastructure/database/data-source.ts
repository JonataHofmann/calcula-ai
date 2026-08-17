import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/modules/**/infrastructure/persistence/entities/*.entity.ts'],
  migrations: ['src/modules/**/infrastructure/persistence/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
