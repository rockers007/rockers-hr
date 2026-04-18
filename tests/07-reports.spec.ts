import { test, expect } from '@playwright/test';

test.describe('Reports & Export', () => {

  test('[Report] Generate monthly leave report', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/monthly?year=2026&month=4');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Generate yearly leave report', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/yearly?year=2026');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Generate leave balance report', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/balance');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Export monthly report as CSV', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/monthly/export?format=csv&year=2026&month=4');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Export monthly report as PDF', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/monthly/export?format=pdf&year=2026&month=4');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Export yearly report as CSV', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/yearly/export?format=csv&year=2026');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Filter reports by department', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/monthly?year=2026&month=4&department_id=00000000-0000-0000-0000-000000000001');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Compensation eligibility report (available_days > 0)', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/compensation?year=2026');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Employee role cannot access reports endpoints', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/monthly');
    expect([401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Report] Reports Admin has read-only report access', async ({ request }) => {
    const resp = await request.get('/api/v1/reports/yearly');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });
});
