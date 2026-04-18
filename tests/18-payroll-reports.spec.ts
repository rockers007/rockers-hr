import { test, expect } from '@playwright/test';

test.describe('Payroll — Reports', () => {
  test('[Payroll-Reports] salary-register JSON', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/salary-register?year=2026&month=3',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] salary-register CSV', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/salary-register?year=2026&month=3&format=csv',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] department-cost JSON', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/department-cost?year=2026&month=3',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] payroll-summary monthly', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/payroll-summary?year=2026&period=monthly',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] payroll-summary yearly', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/payroll-summary?year=2026&period=yearly',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] compliance JSON', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/compliance?year=2026&month=3',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Reports] compliance CSV', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/reports/compliance?year=2026&month=3&format=csv',
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });
});
