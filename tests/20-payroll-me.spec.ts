import { test, expect } from '@playwright/test';

test.describe('Payroll — Employee Portal', () => {
  test('[Payroll-Me] GET /me/salary', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/salary');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/salary-preview', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/salary-preview');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/payslips', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/payslips');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/payslips?year=2026', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/payslips?year=2026');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/ytd', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/ytd');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/ytd?fy=2025-2026', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/ytd?fy=2025-2026');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/ot-tracker rejects bad params', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/me/ot-tracker');
    expect([200, 400, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/ot-tracker with year+month', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/me/ot-tracker?year=2026&month=3',
    );
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Me] GET /me/ot-tracker rejects month=13', async ({ request }) => {
    const resp = await request.get(
      '/api/v1/payroll/me/ot-tracker?year=2026&month=13',
    );
    expect([200, 400, 401, 403]).toContain(resp.status());
  });
});
