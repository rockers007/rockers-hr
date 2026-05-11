import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Designation becomes a master table scoped per department.
 *
 *   master_designations (id, department_id FK, label, sort_order, is_active…)
 *
 * A new `users.designation_id` FK points at this table. The existing
 * `users.designation` TEXT column is left in place for back-compat so
 * historical values aren't lost — the frontend prefers the FK label when
 * present and falls back to the legacy text.
 *
 * UNIQUE(department_id, label) lets the same job title exist in multiple
 * departments (e.g. "Team Lead" under both Engineering and Design) while
 * preventing duplicates within a single department.
 */
export class MasterDesignations1712000000060 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "master_designations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "department_id" UUID NOT NULL
          REFERENCES "master_departments"("id") ON DELETE RESTRICT,
        "label" TEXT NOT NULL,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_master_designations_dept_label"
          UNIQUE ("department_id", "label")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_master_designations_dept" ON "master_designations" ("department_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "designation_id" UUID
          REFERENCES "master_designations"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_designation_id" ON "users" ("designation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "designation_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "master_designations"`);
  }
}
