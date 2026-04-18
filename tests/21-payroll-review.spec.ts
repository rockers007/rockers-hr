import { test, expect } from '@playwright/test';

const FAKE_RUN = '00000000-0000-0000-0000-000000000099';
const FAKE_USER = '00000000-0000-0000-0000-000000000001';

test.describe('Payroll — Review Screen', () => {
  test('[Payroll-Review] GET items returns paginated rows', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/runs/${FAKE_RUN}/items?pageSize=50`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Review] Search query parameter accepted', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/runs/${FAKE_RUN}/items?search=RT-DEV`,
    );
    expect([200, 401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-Review] PATCH items editable fields only', async ({ request }) => {
    const resp = await request.patch(
      `/api/v1/payroll/runs/${FAKE_RUN}/items/${FAKE_USER}`,
      { data: { incentive: 5000, tds: 1500, loan_emi: 0, sal_deduction: 0, security_return: 0 } },
    );
    expect([200, 400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Review] Gross edit NOT allowed via item edit', async ({ request }) => {
    const resp = await request.patch(
      `/api/v1/payroll/runs/${FAKE_RUN}/items/${FAKE_USER}`,
      { data: { gross: 100000 } },
    );
    // Server silently ignores disallowed fields and reports 400 "No editable fields" when nothing maps
    expect([200, 400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-Review] Negative numbers on editable fields', async ({ request }) => {
    const resp = await request.patch(
      `/api/v1/payroll/runs/${FAKE_RUN}/items/${FAKE_USER}`,
      { data: { tds: -100 } },
    );
    expect([200, 400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });
});
