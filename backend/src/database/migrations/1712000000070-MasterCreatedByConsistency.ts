import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Code-review follow-up: bring `created_by` to the three master tables
 * added in earlier session migrations so they match the platform-wide
 * convention documented in PLAN.md §7. The column is nullable + FK to
 * admin_users(id) with ON DELETE RESTRICT so deleting an admin who
 * authored seed rows fails fast instead of silently nulling the
 * provenance.
 *
 * Affected tables:
 *   - master_marital_statuses (1712000000020)
 *   - master_document_types   (1712000000020)
 *   - master_designations     (1712000000060)
 */
export class MasterCreatedByConsistency1712000000070
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'master_marital_statuses',
      'master_document_types',
      'master_designations',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "created_by" UUID
      `);
      // FK kept idempotent via DO block — ALTER TABLE ADD CONSTRAINT
      // doesn't support IF NOT EXISTS pre-PG14.
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_${table}_created_by'
          ) THEN
            ALTER TABLE "${table}"
              ADD CONSTRAINT "fk_${table}_created_by"
              FOREIGN KEY ("created_by")
              REFERENCES admin_users(id)
              ON DELETE RESTRICT;
          END IF;
        END$$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'master_marital_statuses',
      'master_document_types',
      'master_designations',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "fk_${table}_created_by"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "created_by"`,
      );
    }
  }
}
