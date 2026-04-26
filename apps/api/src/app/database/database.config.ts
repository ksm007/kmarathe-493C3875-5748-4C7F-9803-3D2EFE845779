import { AppEnv } from '../config/env.validation';
import { AuditLogEntity, OrganizationEntity, TaskEntity, UserEntity } from './entities';
import { InitialSchema1710000000000 } from './migrations/1710000000000-initial-schema';
import { DataSourceOptions } from 'typeorm';

export function buildDatabaseOptions(env: Pick<AppEnv, 'DATABASE_URL'>): DataSourceOptions {
  const useSsl = /neon\.tech|sslmode=require/i.test(env.DATABASE_URL);

  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    entities: [OrganizationEntity, UserEntity, TaskEntity, AuditLogEntity],
    migrations: [InitialSchema1710000000000],
    synchronize: false,
    logging: false,
  };
}
