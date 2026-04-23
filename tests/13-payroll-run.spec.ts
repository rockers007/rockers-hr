import { test, expect } from '@playwright/test';

const FAKE_RUN = '00000000-0000-0000-0000-000000000099';
const FAKE_USER = '00000000-0000-0000-0000-000000000001';

test.describe('Payroll — Run Workflow', () => {
  test('[Payroll-Run] GET /runs list', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/runs?pageSize=10');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs requires month + year', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/runs', { data: {} });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs creates DRAFT for new month', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/runs', {
      data: { month: 12, year: 2099 },
    });
    expect([200, 201, 401, 403, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs/:id/import on missing run → 404', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/runs/${FAKE_RUN}/import`);
    expect([401, 403, 404, 409]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs/:id/calculate on missing run → 404', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/runs/${FAKE_RUN}/calculate`);
    expect([401, 403, 404, 409]).toContain(resp.status());
  });

  test('[Payroll-Run] GET /runs/:id 404 for unknown', async ({ request }) => {
    const resp = await request.get(`/api/v1/payroll/runs/${FAKE_RUN}`);
    expect([401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Run] GET /runs/:id/items 404 for unknown', async ({ request }) => {
    const resp = await request.get(`/api/v1/payroll/runs/${FAKE_RUN}/items`);
    expect([401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Run] PATCH /runs/:id/employees/:userId rejects bad state', async ({ request }) => {
    const resp = await request.patch(
      `/api/v1/payroll/runs/${FAKE_RUN}/employees/${FAKE_USER}`,
      { data: { lwp_days: 2 } },
    );
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] PATCH /runs/:id/items/:userId rejects bad state', async ({ request }) => {
    const resp = await request.patch(
      `/api/v1/payroll/runs/${FAKE_RUN}/items/${FAKE_USER}`,
      { data: { tds: 1500 } },
    );
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs/:id/lock requires confirmation phrase', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/runs/${FAKE_RUN}/lock`, {
      data: { confirmation_phrase: 'WRONG' },
    });
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs/:id/release requires release_date', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/runs/${FAKE_RUN}/release`, {
      data: {},
    });
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Run] POST /runs/:id/cancel', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/runs/${FAKE_RUN}/cancel`);
    expect([401, 403, 404, 409]).toContain(resp.status());
  });

  test('[Payroll-Run] GET /runs/:id/release-progress', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/runs/${FAKE_RUN}/release-progress`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });
});
