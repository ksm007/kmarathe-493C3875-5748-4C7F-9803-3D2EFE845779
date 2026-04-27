import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiAdditions1720000000000 implements MigrationInterface {
  name = 'AiAdditions1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS "assigneeId" varchar(36),
      ADD COLUMN IF NOT EXISTS "dueDate" date,
      ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_assignee
      FOREIGN KEY ("assigneeId") REFERENCES users(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_activities (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "taskId" varchar(36) NOT NULL,
        "organizationId" varchar(36) NOT NULL,
        "actorId" varchar(36),
        type varchar(48) NOT NULL,
        message text NOT NULL,
        metadata jsonb,
        CONSTRAINT fk_task_activities_task FOREIGN KEY ("taskId") REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_activities_actor FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_activities_task_created_at
      ON task_activities ("taskId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_embeddings (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "taskId" varchar(36) NOT NULL UNIQUE,
        "organizationId" varchar(36) NOT NULL,
        "assigneeId" varchar(36),
        "createdById" varchar(36) NOT NULL,
        document text NOT NULL,
        embedding jsonb NOT NULL,
        "syncedAt" timestamptz NOT NULL,
        CONSTRAINT fk_task_embeddings_task FOREIGN KEY ("taskId") REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_embeddings_org
      ON task_embeddings ("organizationId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_pending_actions (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" varchar(36) NOT NULL,
        "actionType" varchar(24) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'pending',
        summary varchar(255) NOT NULL,
        payload jsonb NOT NULL,
        "taskId" varchar(36),
        CONSTRAINT fk_chat_pending_actions_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_pending_actions_user_status_created_at
      ON chat_pending_actions ("userId", status, "createdAt");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" varchar(36) NOT NULL,
        role varchar(16) NOT NULL,
        content text NOT NULL,
        sources jsonb NOT NULL DEFAULT '[]',
        "pendingActionId" varchar(36),
        CONSTRAINT fk_chat_messages_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_messages_pending_action FOREIGN KEY ("pendingActionId") REFERENCES chat_pending_actions(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created_at
      ON chat_messages ("userId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS llm_interactions (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" varchar(36),
        operation varchar(80) NOT NULL,
        provider varchar(48) NOT NULL,
        model varchar(120) NOT NULL,
        "inputPreview" text NOT NULL,
        "outputPreview" text NOT NULL,
        "canaryTriggered" boolean NOT NULL DEFAULT false,
        "blockedReason" varchar(120),
        metadata jsonb,
        CONSTRAINT fk_llm_interactions_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_llm_interactions_user_created_at
      ON llm_interactions ("userId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS llm_interactions;');
    await queryRunner.query('DROP TABLE IF EXISTS chat_messages;');
    await queryRunner.query('DROP TABLE IF EXISTS chat_pending_actions;');
    await queryRunner.query('DROP TABLE IF EXISTS task_embeddings;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_task_activities_task_created_at;');
    await queryRunner.query('DROP TABLE IF EXISTS task_activities;');
    await queryRunner.query('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_assignee;');
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN IF EXISTS tags;');
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN IF EXISTS "dueDate";');
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN IF EXISTS "assigneeId";');
  }
}
