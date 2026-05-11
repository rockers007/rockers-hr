import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-account lockout tracking for password-based login.
 *
 *   failed_login_count — counter of consecutive wrong-password attempts.
 *                        Reset to 0 on any successful login.
 *   locked_until       — when set to a future timestamp, every login attempt
 *                        is rejected with 423 LOCKED. Auto-unlock happens
 *                        simply by the value falling into the past.
 *
 * Applied to both `users` (employee email login) and `admin_users` (admin
 * login). See LoginLockoutPolicy constants in auth services for thresholds.
 */
export class LoginAttemptTracking1712000000040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "failed_login_count" INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ADD COLUMN IF NOT EXISTS "failed_login_count" INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        DROP COLUMN IF EXISTS "locked_until",
        DROP COLUMN IF EXISTS "failed_login_count"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "locked_until",
        DROP COLUMN IF EXISTS "failed_login_count"
    `);
  }
}
