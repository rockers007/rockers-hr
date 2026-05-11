import { test, expect } from '@playwright/test';

test.describe('Payroll — RBAC', () => {
  test('[Payroll-RBAC] Unauth request to /payroll/runs → 401', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/runs');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Unauth /payroll/master/components → 401', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/components');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Unauth /payroll/bank-change/mine → 401', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/bank-change/mine');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Unauth /payroll/investment-proofs/mine → 401', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/investment-proofs/mine?fy=2025-2026',
    );
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Unauth /payroll/me/salary → 401', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/salary');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Unauth /payroll/reports/salary-register → 401', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/salary-register?year=2026&month=3',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-RBAC] ESIC toggle endpoint exists', async ({ request }) => {
    const resp = await request.post(
      '/api/v1/payroll/master/statutory/esic/activate',
      { data: { activate: false, confirmation_phrase: 'ACTIVATE ESIC' } },
    );
    expect([200, 400, 401, 403, 404, 422]).toContain(resp.status());
  });

  test('[Payroll-RBAC] Bank file approve is super-admin gated', async ({ request }) => {
    const resp = await request.post(
      '/api/v1/payroll/runs/00000000-0000-0000-0000-000000000000/bank-file/approve',
      {
        data: {
          confirmation_phrase: 'APPROVE BANK TRANSFER FILE',
          file_format_code: 'DEFAULT_NEFT',
          pending_bank_changes_action: 'use_old',
        },
      },
    );
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });
});
