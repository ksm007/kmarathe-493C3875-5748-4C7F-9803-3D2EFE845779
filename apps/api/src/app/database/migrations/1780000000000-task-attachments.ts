import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskAttachments1780000000000 implements MigrationInterface {
  name = 'TaskAttachments1780000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE task_attachments (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "taskId" varchar(36) NOT NULL,
        "organizationId" varchar(36) NOT NULL,
        "uploadedById" varchar(36) NOT NULL,
        "fileName" varchar(255) NOT NULL,
        "contentType" varchar(80) NOT NULL,
        "byteSize" int NOT NULL,
        "storageKey" varchar(500) NOT NULL,
        CONSTRAINT fk_task_attachments_task
          FOREIGN KEY ("taskId") REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_attachments_organization
          FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_attachments_uploaded_by
          FOREIGN KEY ("uploadedById") REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_task_attachments_org_task ON task_attachments ("organizationId", "taskId");`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_task_attachments_org_task;');
    await queryRunner.query('DROP TABLE task_attachments;');
  }
}
