import { MigrationInterface, QueryRunner } from 'typeorm';

export class IssueWorkflowFields1740000000000 implements MigrationInterface {
  name = 'IssueWorkflowFields1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN "issueType" varchar(32) NOT NULL DEFAULT 'task',
      ADD COLUMN "storyPoints" int;
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      ALTER COLUMN status SET DEFAULT 'todo';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP COLUMN "storyPoints",
      DROP COLUMN "issueType";
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      ALTER COLUMN status DROP DEFAULT;
    `);
  }
}
