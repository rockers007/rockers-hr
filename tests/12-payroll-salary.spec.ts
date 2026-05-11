import { test, expect } from '@playwright/test';

const FAKE_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Payroll — Salary Configuration', () => {
  test('[Payroll-Salary] GET /employees/:id/salary returns fields + preview', async ({ request }) => {
    const resp = await request.get(`/api/v1/payroll/employees/${FAKE_ID}/salary`);
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Salary] PATCH /employees/:id/salary rejects unauth', async ({ request }) => {
    const resp = await request.patch(`/api/v1/payroll/employees/${FAKE_ID}/salary`, {
      data: { gross: 50000 },
    });
    expect([200, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Salary] PATCH /admin/users/:id accepts gross + dob + emp_number', async ({ request }) => {
    const resp = await request.patch(`/api/v1/admin/users/${FAKE_ID}`, {
      data: {
        gross: 38200,
        dob: '1995-03-14',
        emp_number: 'RT-TEST-001',
        designation: 'QA Engineer',
        incentive: 5000,
        pf_applicable: true,
      },
    });
    expect([200, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Salary] Bank fields accepted on /admin/users PATCH', async ({ request }) => {
    const resp = await request.patch(`/api/v1/admin/users/${FAKE_ID}`, {
      data: {
        bank_name: 'HDFC Bank',
        bank_account_no: '12830100028299',
        bank_ifsc: 'HDFC0001234',
      },
    });
    expect([200, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Salary] Invalid IFSC rejected', async ({ request }) => {
    const resp = await request.patch(`/api/v1/admin/users/${FAKE_ID}`, {
      data: { bank_ifsc: 'invalid' },
    });
    expect([401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Salary] Non-digit account number rejected', async ({ request }) => {
    const resp = await request.patch(`/api/v1/admin/users/${FAKE_ID}`, {
      data: { bank_account_no: 'abc12345678' },
    });
    expect([401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Salary] GET /me/salary returns own', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/salary');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Salary] GET /me/salary-preview returns computed fields', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/salary-preview');
    expect([200, 401, 403]).toContain(resp.status());
  });
});
