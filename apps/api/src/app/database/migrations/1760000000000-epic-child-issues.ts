import { MigrationInterface, QueryRunner } from 'typeorm';

export class EpicChildIssues1760000000000 implements MigrationInterface {
  name = 'EpicChildIssues1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN "parentEpicId" varchar(36),
      ADD CONSTRAINT fk_tasks_parent_epic
        FOREIGN KEY ("parentEpicId") REFERENCES tasks(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_tasks_parent_epic ON tasks ("parentEpicId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_tasks_parent_epic;');
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP CONSTRAINT fk_tasks_parent_epic,
      DROP COLUMN "parentEpicId";
    `);
  }
}
