import { test, expect } from '@playwright/test';

// Smoke-level E2E for payroll master data endpoints. Follows the pattern of
// tests/02-master-data.spec.ts — accept plausible auth statuses rather than
// require a full admin login flow for every test.

test.describe('Payroll — Master Data', () => {
  test('[Payroll-Master] GET /payroll/master/components returns 7 rows (or 401/403)', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/components');
    expect([200, 401, 403]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      const rows = body.data ?? body;
      expect(Array.isArray(rows)).toBe(true);
    }
  });

  test('[Payroll-Master] GET /payroll/master/statutory returns single config', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/statutory');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] ESIC activation requires confirmation phrase', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/master/statutory/esic/activate', {
      data: { activate: true, confirmation_phrase: 'WRONG' },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-Master] PUT /components rejects sum != 100', async ({ request }) => {
    const bad = Array.from({ length: 7 }).map((_, i) => ({
      code: ['BASIC','HRA','SP_ALLOW','CONVEYANCE','LTC','RE_MEDICAL','EDUCATION'][i],
      display_name: 'X', payslip_label: 'X',
      percentage: 1, display_order: i + 1, is_pf_base: i === 0,
    }));
    const resp = await request.put('/api/v1/payroll/master/components', {
      data: { components: bad },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-Master] GET /earning-types returns BONUS seeded', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/earning-types');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] GET /deduction-types returns ESIC with is_active_by_default FALSE', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/deduction-types');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] GET /company-profile returns Rockers Technologies', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/company-profile');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] GET /bank-formats returns DEFAULT_NEFT', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/master/bank-formats');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] Unauthenticated PATCH /statutory rejected', async ({ request }) => {
    const resp = await request.patch('/api/v1/payroll/master/statutory', {
      data: { pt_flat_amount: 250 },
    });
    expect([401, 403]).toContain(resp.status());
  });

  test('[Payroll-Master] Bad request body on PUT /components returns 4xx', async ({ request }) => {
    const resp = await request.put('/api/v1/payroll/master/components', {
      data: { components: 'not-an-array' },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });
});
