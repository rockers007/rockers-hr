import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResignationFields1711900000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "resignation_date" date,
        ADD COLUMN IF NOT EXISTS "last_working_day" date,
        ADD COLUMN IF NOT EXISTS "employment_status" text NOT NULL DEFAULT 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "resignation_date",
        DROP COLUMN IF EXISTS "last_working_day",
        DROP COLUMN IF EXISTS "employment_status"
    `);
  }
}
