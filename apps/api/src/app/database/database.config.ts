import { AppEnv } from '../config/env.validation';
import {
  AuditLogEntity,
  ChatMessageEntity,
  ChatPendingActionEntity,
  InvitationEntity,
  LlmInteractionEntity,
  MembershipEntity,
  OrganizationEntity,
  PasswordResetTokenEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from './entities';
import { InitialSchema1710000000000 } from './migrations/1710000000000-initial-schema';
import { AiAdditions1720000000000 } from './migrations/1720000000000-ai-additions';
import { MultiOrgMembership1730000000000 } from './migrations/1730000000000-multi-org-membership';
import { DataSourceOptions } from 'typeorm';

export function buildDatabaseOptions(env: Pick<AppEnv, 'DATABASE_URL'>): DataSourceOptions {
  const useSsl = /neon\.tech|sslmode=require/i.test(env.DATABASE_URL);

  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    entities: [
      OrganizationEntity,
      UserEntity,
      MembershipEntity,
      InvitationEntity,
      PasswordResetTokenEntity,
      TaskEntity,
      TaskActivityEntity,
      TaskEmbeddingEntity,
      AuditLogEntity,
      ChatMessageEntity,
      ChatPendingActionEntity,
      LlmInteractionEntity,
    ],
    migrations: [
      InitialSchema1710000000000,
      AiAdditions1720000000000,
      MultiOrgMembership1730000000000,
    ],
    synchronize: false,
    logging: false,
  };
}
