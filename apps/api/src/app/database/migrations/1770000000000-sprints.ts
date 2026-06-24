import { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprints1770000000000 implements MigrationInterface {
  name = 'Sprints1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sprints (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        name varchar(120) NOT NULL,
        goal text,
        state varchar(24) NOT NULL DEFAULT 'planned',
        "capacityPoints" int,
        "startDate" date,
        "endDate" date,
        "organizationId" varchar(36) NOT NULL,
        CONSTRAINT fk_sprints_organization
          FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX idx_sprints_org_state ON sprints ("organizationId", state);`,
    );

    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN "sprintId" varchar(36),
      ADD CONSTRAINT fk_tasks_sprint
        FOREIGN KEY ("sprintId") REFERENCES sprints(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(
      `CREATE INDEX idx_tasks_sprint ON tasks ("sprintId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_tasks_sprint;');
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP CONSTRAINT fk_tasks_sprint,
      DROP COLUMN "sprintId";
    `);
    await queryRunner.query('DROP INDEX idx_sprints_org_state;');
    await queryRunner.query('DROP TABLE sprints;');
  }
}
