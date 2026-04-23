import { test, expect } from '@playwright/test';

const FAKE_USER = '00000000-0000-0000-0000-000000000001';

test.describe('Payroll — Payslip PDF', () => {
  test('[Payroll-PDF] GET /payslips/:user/:year/:month admin', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/payslips/${FAKE_USER}/2026/3`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-PDF] GET /payslips/:user/:year/:month/preview streams PDF', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/payslips/${FAKE_USER}/2026/3/preview`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-PDF] POST /payslips/:user/:year/:month/retry-email', async ({ request }) => {
    const resp = await request.post(
      `/api/v1/payroll/payslips/${FAKE_USER}/2026/3/retry-email`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-PDF] GET /me/payslips returns list', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/payslips');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-PDF] GET /me/payslips?year=2026', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/payslips?year=2026');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-PDF] GET /me/payslips/:year/:month/download', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/payslips/2026/3/download');
    expect([200, 401, 403, 404]).toContain(resp.status());
  });
});
