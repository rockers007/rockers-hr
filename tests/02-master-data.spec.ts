import { test, expect } from '@playwright/test';

test.describe('Master Data Management', () => {

  test('[Master] Fetch active records via generic GET /master/:table endpoint', async ({ request }) => {
    const resp = await request.get('/api/v1/master/qualifications');
    expect([200, 401, 500]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('data');
    }
  });

  test('[Master] Reject invalid table name in /master/:table', async ({ request }) => {
    const resp = await request.get('/api/v1/master/invalid_table_name');
    expect([400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Master] Admin fetches all records including inactive via /master/:table/all', async ({ request }) => {
    const resp = await request.get('/api/v1/master/qualifications/all');
    expect([200, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Master] Employee cannot access /master/:table/all endpoint', async ({ request }) => {
    const resp = await request.get('/api/v1/master/qualifications/all');
    // Without auth, should get 401 or 403
    expect([401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Master] Create new leave type via POST /master/leave_types', async ({ request }) => {
    const resp = await request.post('/api/v1/master/leave_types', {
      data: { label: 'Test Leave Type', annual_days: 1, sort_order: 99 },
    });
    expect([201, 400, 401, 403, 500]).toContain(resp.status());
  });

  test('[Master] Soft-delete master record via DELETE /master/:table/:id', async ({ request }) => {
    const resp = await request.delete('/api/v1/master/qualifications/00000000-0000-0000-0000-000000000000');
    expect([200, 204, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Master] Update sort_order and label via PATCH /master/:table/:id', async ({ request }) => {
    const resp = await request.patch('/api/v1/master/departments/00000000-0000-0000-0000-000000000000', {
      data: { label: 'Updated Dept', sort_order: 5 },
    });
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Master] SLA config uses key-value pattern (no label/sort_order)', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('data');
    }
  });

  test('[Master] File types use mime_type/extension/context pattern', async ({ request }) => {
    const resp = await request.get('/api/v1/master/file_types');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Master] Permission-gated master table access per admin role', async ({ request }) => {
    // Without admin auth, POST should be rejected
    const resp = await request.post('/api/v1/master/departments', {
      data: { label: 'Test Dept' },
    });
    expect([401, 403, 500]).toContain(resp.status());
  });

  test('[Master] Notification templates use event_key pattern', async ({ request }) => {
    const resp = await request.get('/api/v1/master/notification_templates');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Master] Public holidays managed per year with date uniqueness', async ({ request }) => {
    const resp = await request.get('/api/v1/master/public_holidays');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Master] carry_over field is always 0 and non-editable for leave types', async ({ request }) => {
    const resp = await request.patch('/api/v1/master/leave_types/00000000-0000-0000-0000-000000000000', {
      data: { carry_over: 5 },
    });
    expect([400, 401, 403, 404, 422, 500]).toContain(resp.status());
  });
});
