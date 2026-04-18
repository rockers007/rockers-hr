import { DataSource } from 'typeorm';

/**
 * Seeds payroll master data per PAYROLL_MASTER_DATA.md.
 * Idempotent — safe to re-run.
 */
export async function seedPayrollMasterData(dataSource: DataSource): Promise<void> {
  console.log('Seeding payroll master data...');

  // 1. Salary components (§3.1) — must sum to 100
  await dataSource.query(`
    INSERT INTO payroll_salary_components (code, display_name, payslip_label, percentage, display_order, is_pf_base)
    VALUES
      ('BASIC',      'Basic Salary',           'BASIC',           50.00, 1, TRUE),
      ('HRA',        'House Rent Allowance',   'HRA',             20.00, 2, FALSE),
      ('SP_ALLOW',   'Special Allowances',     'SP. ALLOWANCES',  15.00, 3, FALSE),
      ('CONVEYANCE', 'Conveyance',             'CONVEYANCE',       7.00, 4, FALSE),
      ('LTC',        'Leave Travel Concession','LTC',              5.00, 5, FALSE),
      ('RE_MEDICAL', 'Reimbursement Medical',  'RE. MEDICAL',      2.00, 6, FALSE),
      ('EDUCATION',  'Education Allowances',   'EDU. ALLOWANCES',  1.00, 7, FALSE)
    ON CONFLICT (code) DO NOTHING
  `);

  // 2. Statutory config (§4.1) — single active row
  const statutoryExists = await dataSource.query(
    `SELECT 1 FROM payroll_statutory_config WHERE is_active = TRUE LIMIT 1`,
  );
  if (statutoryExists.length === 0) {
    await dataSource.query(`
      INSERT INTO payroll_statutory_config (
        profile_name, pf_cap_amount, pf_fixed_at_cap, pf_rate_below_cap,
        pf_employer_matches_employee, esic_active, esic_threshold_gross,
        esic_employer_rate, esic_employee_rate, pt_flat_amount,
        ot_multiplier, ot_divisor_day, ot_divisor_hour,
        payroll_cycle_days, financial_year_start_month, currency,
        effective_from, is_active
      ) VALUES (
        'DEFAULT', 15000.00, 1800.00, 0.1200,
        TRUE, FALSE, 21000.00,
        0.0325, 0.0075, 200.00,
        1.50, 30, 9,
        30, 4, 'INR',
        CURRENT_DATE, TRUE
      )
    `);
  }

  // 3. Earning types (§6.1)
  await dataSource.query(`
    INSERT INTO payroll_earning_types (code, display_name, payslip_label, is_manual, is_auto_from_leave, display_order)
    VALUES
      ('FIX_VARIABLE',    'Fix Variable / Incentive', 'FIX VARIABLE',       TRUE,  FALSE, 8),
      ('OT_PAY',          'Overtime Pay',              'EXTRA WORKING HRS', FALSE, TRUE,  9),
      ('SECURITY_RETURN', 'Security Return',           'SECURITY RETURN',   TRUE,  FALSE, 10),
      ('BONUS',           'Bonus',                     'BONUS',             TRUE,  FALSE, 11)
    ON CONFLICT (code) DO NOTHING
  `);

  // 4. Deduction types (§7.1)
  await dataSource.query(`
    INSERT INTO payroll_deduction_types (
      code, display_name, payslip_label, is_statutory, is_auto_calculated,
      is_manual, is_active_by_default, display_order
    ) VALUES
      ('PF_EMPLOYEE',   'Employee Provident Fund',       'PF',             TRUE,  TRUE,  FALSE, TRUE,  1),
      ('ESIC_EMPLOYEE', 'Employee State Insurance',      'ESIC',           TRUE,  TRUE,  FALSE, FALSE, 2),
      ('PT',            'Professional Tax',              'P.TAX',          TRUE,  TRUE,  FALSE, TRUE,  3),
      ('TDS',           'Tax Deducted at Source',        'TDS',            TRUE,  FALSE, TRUE,  TRUE,  4),
      ('SECURITY',      'Security Deposit',              'SECURITY',       FALSE, FALSE, TRUE,  TRUE,  5),
      ('LOAN_EMI',      'Loan Recovery',                 'LOAN',           FALSE, FALSE, TRUE,  TRUE,  6),
      ('SAL_DEDUCTION', 'Salary Deduction (Other)',      'SAL DEDUCTION',  FALSE, FALSE, TRUE,  TRUE,  7)
    ON CONFLICT (code) DO NOTHING
  `);

  // 5. Bank file format placeholder (§8.1)
  await dataSource.query(`
    INSERT INTO payroll_bank_file_formats (code, display_name, delimiter, column_order)
    VALUES (
      'DEFAULT_NEFT', 'Generic NEFT Bulk', '|',
      '["EMP_NAME","BANK_NAME","ACC_NO","IFSC","AMOUNT","REMARKS"]'::jsonb
    )
    ON CONFLICT (code) DO NOTHING
  `);

  // 6. Company profile (§9.1) — single row
  const companyExists = await dataSource.query(
    `SELECT 1 FROM company_profile LIMIT 1`,
  );
  if (companyExists.length === 0) {
    await dataSource.query(`
      INSERT INTO company_profile (
        company_name, address_line_1, address_line_2, city, state,
        payslip_footer_text
      ) VALUES (
        'ROCKERS TECHNOLOGIES',
        '3rd Floor, Corner Heights',
        'Kalali Road',
        'Vadodara',
        'Gujarat',
        'This is a system generated pay slip and does not require signature'
      )
    `);
  }

  console.log('Payroll master data seeded.');
}
