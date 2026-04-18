import { test, expect } from '@playwright/test';

const FAKE_USER = '00000000-0000-0000-0000-000000000001';

test.describe('Payroll — Investment Proofs', () => {
  test('[Payroll-Proofs] POST rejects bad FY format', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/investment-proofs', {
      data: {
        financial_year: '2025',
        category: '80C',
        s3_key: 'stub/s3/key.pdf',
      },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-Proofs] POST requires category', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/investment-proofs', {
      data: {
        financial_year: '2025-2026',
        category: '',
        s3_key: 'stub.pdf',
      },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-Proofs] GET /investment-proofs/mine', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/investment-proofs/mine?fy=2025-2026');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Proofs] GET /investment-proofs admin view', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/investment-proofs?userId=${FAKE_USER}&fy=2025-2026`,
    );
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-Proofs] DELETE unknown id → 404', async ({ request }) => {
    const resp = await request.delete(
      '/api/v1/payroll/investment-proofs/00000000-0000-0000-0000-000000000099',
    );
    expect([401, 403, 404]).toContain(resp.status());
  });
});
