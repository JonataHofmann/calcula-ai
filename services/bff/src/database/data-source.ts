import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SessionEntity } from './session.entity';

export const BffDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [SessionEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
