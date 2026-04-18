import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleTokensToUsers1711900000003 implements MigrationInterface {
  name = 'AddGoogleTokensToUsers1711900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_access_token" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_refresh_token" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "google_refresh_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "google_access_token"`,
    );
  }
}
