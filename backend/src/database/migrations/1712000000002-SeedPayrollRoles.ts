import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds payroll-relevant roles to master_role_types per PAYROLL_RBAC.md §1.
 * Existing: 'employee', 'manager'. Adding: 'super_admin', 'hr_manager', 'reports_admin'.
 */
export class SeedPayrollRoles1712000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO master_role_types (label, system_key, sort_order) VALUES
      ('Super Admin', 'super_admin', 3),
      ('HR Manager', 'hr_manager', 4),
      ('Reports Admin', 'reports_admin', 5)
      ON CONFLICT (system_key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM master_role_types WHERE system_key IN ('super_admin','hr_manager','reports_admin')`,
    );
  }
}
