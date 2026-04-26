import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const apiDataSource = new DataSource(
  buildDatabaseOptions({
    DATABASE_URL,
  })
);
