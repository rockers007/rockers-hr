/**
 * Payroll permission matrix — generated from PAYROLL_RBAC.md §2.
 * Roles use system_key values from master_role_types:
 *   super_admin, hr_manager, reports_admin, employee, manager
 *
 * Permissions with `_own` suffix always require `userId === currentUser.sub`
 * regardless of which role the user holds — enforced by the guard.
 */

export type PayrollRole =
  | 'super_admin'
  | 'hr_manager'
  | 'reports_admin'
  | 'employee'
  | 'manager';

export const PAYROLL_PERMISSIONS = {
  // Salary config (§2.1)
  SALARY_VIEW: 'payroll.salary.view',
  SALARY_VIEW_OWN: 'payroll.salary.view_own',
  SALARY_EDIT: 'payroll.salary.edit',

  // Master data (§2.1)
  MASTER_COMPONENTS_EDIT: 'payroll.master.components.edit',
  MASTER_STATUTORY_EDIT: 'payroll.master.statutory.edit',
  MASTER_ESIC_TOGGLE: 'payroll.master.esic.toggle',
  MASTER_BANK_FORMAT_EDIT: 'payroll.master.bank_format.edit',
  MASTER_COMPANY_EDIT: 'payroll.master.company.edit',
  MASTER_READ: 'payroll.master.read',

  // Run (§2.2)
  RUN_VIEW: 'payroll.run.view',
  RUN_CREATE: 'payroll.run.create',
  RUN_IMPORT: 'payroll.run.import',
  RUN_CALCULATE: 'payroll.run.calculate',
  RUN_EDIT_ITEMS: 'payroll.run.edit_items',
  RUN_LOCK: 'payroll.run.lock',
  RUN_RELEASE: 'payroll.run.release',
  RUN_CANCEL: 'payroll.run.cancel',
  RUN_REIMPORT: 'payroll.run.reimport',

  // Payslips (§2.3)
  PAYSLIP_VIEW_ANY: 'payroll.payslip.view_any',
  PAYSLIP_VIEW_OWN: 'payroll.payslip.view_own',
  PAYSLIP_PREVIEW: 'payroll.payslip.preview',
  PAYSLIP_RETRY_EMAIL: 'payroll.payslip.retry_email',

  // Bank file (§2.4 — Super Admin only for approve/generate)
  BANK_FILE_PREVIEW: 'payroll.bank_file.preview',
  BANK_FILE_APPROVE: 'payroll.bank_file.approve',
  BANK_FILE_GENERATE: 'payroll.bank_file.generate',

  // Bank change (§2.5)
  BANK_CHANGE_SUBMIT: 'payroll.bank_change.submit',
  BANK_CHANGE_VIEW_ANY: 'payroll.bank_change.view_any',
  BANK_CHANGE_APPROVE: 'payroll.bank_change.approve',
  BANK_CHANGE_REJECT: 'payroll.bank_change.reject',

  // Investment proofs (§2.6)
  INVESTMENT_UPLOAD: 'payroll.investment_proof.upload',
  INVESTMENT_VIEW_OWN: 'payroll.investment_proof.view_own',
  INVESTMENT_VIEW_ANY: 'payroll.investment_proof.view_any',
  INVESTMENT_DELETE_OWN: 'payroll.investment_proof.delete_own',

  // Reports (§2.7)
  REPORT_SALARY_REGISTER: 'payroll.report.salary_register',
  REPORT_DEPARTMENT_COST: 'payroll.report.department_cost',
  REPORT_PAYROLL_SUMMARY: 'payroll.report.payroll_summary',
  REPORT_COMPLIANCE: 'payroll.report.compliance',
  REPORT_EXPORT_CSV: 'payroll.report.export_csv',
  REPORT_EXPORT_PDF: 'payroll.report.export_pdf',

  // Employee self-service (§2.8)
  ME_SALARY_VIEW: 'payroll.me.salary.view',
  ME_PAYSLIPS_LIST: 'payroll.me.payslips.list',
  ME_PAYSLIPS_DOWNLOAD: 'payroll.me.payslips.download',
  ME_YTD_VIEW: 'payroll.me.ytd.view',
  ME_OT_TRACKER_VIEW: 'payroll.me.ot_tracker.view',
} as const;

export type PayrollPermission =
  (typeof PAYROLL_PERMISSIONS)[keyof typeof PAYROLL_PERMISSIONS];

const P = PAYROLL_PERMISSIONS;

// Common employee self-service permissions every role gets
const ME_PERMS: PayrollPermission[] = [
  P.ME_SALARY_VIEW,
  P.ME_PAYSLIPS_LIST,
  P.ME_PAYSLIPS_DOWNLOAD,
  P.ME_YTD_VIEW,
  P.ME_OT_TRACKER_VIEW,
  P.SALARY_VIEW_OWN,
  P.PAYSLIP_VIEW_OWN,
];

const HR_MANAGER_PERMS: PayrollPermission[] = [
  ...ME_PERMS,
  P.SALARY_VIEW,
  P.SALARY_EDIT,
  P.MASTER_READ,
  P.RUN_VIEW,
  P.RUN_CREATE,
  P.RUN_IMPORT,
  P.RUN_CALCULATE,
  P.RUN_EDIT_ITEMS,
  P.RUN_LOCK,
  P.RUN_RELEASE,
  P.RUN_CANCEL,
  P.RUN_REIMPORT,
  P.PAYSLIP_VIEW_ANY,
  P.PAYSLIP_PREVIEW,
  P.PAYSLIP_RETRY_EMAIL,
  P.BANK_FILE_PREVIEW,
  P.BANK_CHANGE_VIEW_ANY,
  P.BANK_CHANGE_APPROVE,
  P.BANK_CHANGE_REJECT,
  P.INVESTMENT_VIEW_ANY,
  P.REPORT_SALARY_REGISTER,
  P.REPORT_DEPARTMENT_COST,
  P.REPORT_PAYROLL_SUMMARY,
  P.REPORT_COMPLIANCE,
  P.REPORT_EXPORT_CSV,
  P.REPORT_EXPORT_PDF,
];

const REPORTS_ADMIN_PERMS: PayrollPermission[] = [
  ...ME_PERMS,
  P.MASTER_READ,
  P.RUN_VIEW,
  P.REPORT_SALARY_REGISTER,
  P.REPORT_DEPARTMENT_COST,
  P.REPORT_PAYROLL_SUMMARY,
  P.REPORT_COMPLIANCE,
  P.REPORT_EXPORT_CSV,
  P.REPORT_EXPORT_PDF,
];

const EMPLOYEE_PERMS: PayrollPermission[] = [
  ...ME_PERMS,
  P.BANK_CHANGE_SUBMIT,
  P.INVESTMENT_UPLOAD,
  P.INVESTMENT_DELETE_OWN,
  P.INVESTMENT_VIEW_OWN,
];

export const ROLE_PERMISSIONS: Record<PayrollRole, PayrollPermission[]> = {
  super_admin: Object.values(P) as PayrollPermission[], // gets everything
  hr_manager: HR_MANAGER_PERMS,
  reports_admin: REPORTS_ADMIN_PERMS,
  employee: EMPLOYEE_PERMS,
  manager: EMPLOYEE_PERMS, // managers get employee payroll access only (§1 note)
};

export function roleHasPermission(
  role: string,
  permission: PayrollPermission,
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role as PayrollRole];
  if (!rolePerms) return false;
  return rolePerms.includes(permission);
}

export function getPermissionsForRole(role: string): PayrollPermission[] {
  return ROLE_PERMISSIONS[role as PayrollRole] ?? [];
}
