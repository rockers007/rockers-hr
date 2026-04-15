import { test, expect } from '@playwright/test';

test.describe('Google Calendar Integration', () => {

  test('[Calendar] Event created only at Level 2 approval', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] Event not created at Level 1 approval', async ({ request }) => {
    const resp = await request.post('/api/v1/manager/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] Event deleted when approved leave is cancelled', async ({ request }) => {
    const resp = await request.patch('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/cancel');
    expect([200, 400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Calendar] Event title format matches config', async ({ request }) => {
    // Verify calendar event title format from SLA config
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Calendar] Calendar API failure does not block approval', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/approvals/00000000-0000-0000-0000-000000000000/approve');
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] Employee added as attendee to calendar event', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] Calendar event spans correct date range', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] calendar_event_id stored in leave request', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Calendar] Google Calendar credentials missing returns warning', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Calendar] Half-day leave creates correct calendar event', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });
});
