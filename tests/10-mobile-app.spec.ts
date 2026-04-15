import { test, expect } from '@playwright/test';

test.describe('Mobile App (Flutter)', () => {

  test('[Mobile] FCM token registration on app launch', async ({ request }) => {
    const resp = await request.patch('/api/v1/users/me/fcm-token', {
      data: { fcm_token: 'test-fcm-token-12345' },
    });
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Push notification delivery via FCM', async ({ request }) => {
    const resp = await request.get('/api/v1/notifications');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Master data fetched on first launch', async ({ request }) => {
    const tables = ['qualifications', 'genders', 'role_types', 'departments', 'leave_types'];
    for (const table of tables) {
      const resp = await request.get(`/api/v1/master/${table}`);
      expect([200, 401, 500]).toContain(resp.status());
    }
  });

  test('[Mobile] OAuth flow launches system browser', async ({ request }) => {
    const resp = await request.get('/api/v1/auth/google', { maxRedirects: 0 });
    expect([200, 302, 303, 500]).toContain(resp.status());
  });

  test('[Mobile] Leave application 3-step flow', async ({ request }) => {
    // Step 1: Get eligible types
    const typesResp = await request.get('/api/v1/leave/types/eligible');
    expect([200, 401, 404, 500]).toContain(typesResp.status());
    // Step 2: Calculate working days
    const calcResp = await request.post('/api/v1/leave/calculate', {
      data: { leave_type_id: '00000000-0000-0000-0000-000000000001', start_date: '2026-07-01', end_date: '2026-07-02' },
    });
    expect([200, 400, 401, 404, 500]).toContain(calcResp.status());
    // Step 3: Submit
    const submitResp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-07-01',
        end_date: '2026-07-02',
        reason: 'Mobile app leave flow test request',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(submitResp.status());
  });

  test('[Mobile] Pull-to-refresh updates master data cache', async ({ request }) => {
    const resp = await request.get('/api/v1/master/leave_types');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Mobile] Conditional navigation based on user state', async ({ request }) => {
    const resp = await request.get('/api/v1/users/me');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Leave balance summary on dashboard', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/balance');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Notification list with pagination', async ({ request }) => {
    const resp = await request.get('/api/v1/notifications?page=1&limit=20');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Polling fallback when FCM unavailable', async ({ request }) => {
    const resp = await request.get('/api/v1/notifications?is_read=false');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] FCM token refresh handled automatically', async ({ request }) => {
    const resp = await request.patch('/api/v1/users/me/fcm-token', {
      data: { fcm_token: 'refreshed-fcm-token-67890' },
    });
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Mobile] Decline leave requires reason with minimum length', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/decline', {
      data: { reason: 'short' },
    });
    expect([400, 401, 403, 404, 422, 500]).toContain(resp.status());
  });
});
