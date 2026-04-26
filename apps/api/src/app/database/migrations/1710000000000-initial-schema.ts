import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE organizations (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        name varchar(120) NOT NULL,
        slug varchar(120) NOT NULL UNIQUE,
        "parentOrganizationId" varchar(36),
        level int NOT NULL DEFAULT 1,
        CONSTRAINT fk_organizations_parent FOREIGN KEY ("parentOrganizationId") REFERENCES organizations(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        email varchar(255) NOT NULL UNIQUE,
        "fullName" varchar(160) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        role varchar(24) NOT NULL,
        "organizationId" varchar(36) NOT NULL,
        CONSTRAINT fk_users_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE tasks (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        title varchar(160) NOT NULL,
        description text,
        status varchar(32) NOT NULL,
        category varchar(32) NOT NULL,
        priority varchar(32) NOT NULL,
        position int NOT NULL DEFAULT 0,
        "organizationId" varchar(36) NOT NULL,
        "createdById" varchar(36) NOT NULL,
        CONSTRAINT fk_tasks_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_tasks_creator FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_tasks_org_status_position ON tasks ("organizationId", status, position);
    `);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "actorId" varchar(36),
        "actorEmail" varchar(255),
        "organizationId" varchar(36),
        action varchar(120) NOT NULL,
        resource varchar(80) NOT NULL,
        "resourceId" varchar(36),
        allowed boolean NOT NULL DEFAULT true,
        reason varchar(255),
        metadata jsonb,
        CONSTRAINT fk_audit_actor FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE audit_logs;');
    await queryRunner.query('DROP INDEX idx_tasks_org_status_position;');
    await queryRunner.query('DROP TABLE tasks;');
    await queryRunner.query('DROP TABLE users;');
    await queryRunner.query('DROP TABLE organizations;');
  }
}
