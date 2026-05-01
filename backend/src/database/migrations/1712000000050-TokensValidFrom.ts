import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tokens_valid_from` to users + admin_users. Any JWT whose `iat`
 * (issued-at) claim is earlier than this timestamp is rejected by
 * JwtStrategy.validate. We bump the column on:
 *   - password change (self-service)
 *   - admin-triggered password reset
 *   - admin-triggered account unlock (so a compromised stolen token that
 *     triggered the lockout can't be reused after unlock)
 *
 * Existing rows default to the migration timestamp so that currently
 * logged-in users do not get kicked out when this ships.
 */
export class TokensValidFrom1712000000050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "tokens_valid_from" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ADD COLUMN IF NOT EXISTS "tokens_valid_from" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_users" DROP COLUMN IF EXISTS "tokens_valid_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tokens_valid_from"`,
    );
  }
}
