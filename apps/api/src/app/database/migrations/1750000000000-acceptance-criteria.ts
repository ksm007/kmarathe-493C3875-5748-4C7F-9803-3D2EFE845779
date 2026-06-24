import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcceptanceCriteria1750000000000 implements MigrationInterface {
  name = 'AcceptanceCriteria1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN "acceptanceCriteria" jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP COLUMN "acceptanceCriteria";
    `);
  }
}
