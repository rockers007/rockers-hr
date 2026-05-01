import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-employee ESIC applicability flag.
 *
 * ESIC was previously a system-wide-only toggle on
 * master_payroll_statutory_config.esic_active. This adds an additional
 * per-employee gate so HR can opt individual employees in or out of
 * ESIC without flipping the system-wide flag — matching the existing
 * pattern for PF (users.pf_applicable + statutory_config). The engine
 * applies ESIC only when BOTH flags are true AND gross is below the
 * configured threshold.
 *
 * Default TRUE for both new columns: keeps existing behavior for the
 * employees and runs that are already in the system. The system-wide
 * esic_active flag remains the master switch — if it's false, no
 * employee gets ESIC regardless of their individual flag.
 *
 * payroll_run_employees.snapshot_esic_applicable mirrors the existing
 * snapshot_pf_applicable column so a payroll run can be re-played with
 * the exact employee-level ESIC state that was in effect at run time.
 */
export class EsicApplicableFlag1712000000090 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "esic_applicable" BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await queryRunner.query(`
      ALTER TABLE "payroll_run_employees"
      ADD COLUMN IF NOT EXISTS "snapshot_esic_applicable" BOOLEAN NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payroll_run_employees" DROP COLUMN IF EXISTS "snapshot_esic_applicable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "esic_applicable"`,
    );
  }
}
