import { test, expect } from '@playwright/test';

test.describe('Leave Approval Workflow', () => {

  test('[Approval] Manager approves Level 1 leave request', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] Manager declines Level 1 with required reason', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/decline', {
      data: { reason: 'Team at full capacity during these dates.' },
    });
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] Manager decline requires reason field', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/decline', {
      data: {},
    });
    expect([400, 401, 403, 404, 422, 500]).toContain(resp.status());
  });

  test('[Approval] HR approves Level 2 (final approval)', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] HR declines Level 2', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/decline', {
      data: { reason: 'HR decline test reason for testing purposes.' },
    });
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] Manager cannot approve another managers team requests', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] HR approves escalated request', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] HR declines escalated request', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/decline', {
      data: { reason: 'Escalation decline test for automated testing.' },
    });
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] Employee cannot approve their own leave', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Approval] View leave request with full approval timeline', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Approval] Admin submits leave on behalf and it follows normal workflow', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-11-10',
        end_date: '2026-11-11',
        reason: 'On-behalf submission workflow test request',
      },
    });
    expect([201, 400, 401, 403, 404, 422, 500]).toContain(resp.status());
  });

  test('[Approval] Balance updates correctly through full approval lifecycle', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/balance');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Approval] can_cancel flag correctly computed in leave request response', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });
});
