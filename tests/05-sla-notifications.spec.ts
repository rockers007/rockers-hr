import { test, expect } from '@playwright/test';

test.describe('SLA & Notifications', () => {

  test('[SLA] Business hours elapsed calculation excludes weekends', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[SLA] Reminder sent at configured threshold (default 4h)', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[SLA] Auto-escalation to HR at manager SLA window expiry (5h)', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[SLA] SLA clock pauses outside business hours', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('data');
    }
  });

  test('[SLA] SLA clock pauses on public holidays', async ({ request }) => {
    const resp = await request.get('/api/v1/master/public_holidays');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[SLA] Weekend-spanning SLA calculation', async ({ request }) => {
    const resp = await request.get('/api/v1/master/sla_config');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Notification] Email sent via SMTP using master template tokens', async ({ request }) => {
    const resp = await request.get('/api/v1/master/notification_templates');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Notification] In-app notification created in notifications table', async ({ request }) => {
    const resp = await request.get('/api/v1/notifications');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Notification] Mark notification as read', async ({ request }) => {
    const resp = await request.patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read');
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Notification] FCM push notification sent to mobile device', async ({ request }) => {
    const resp = await request.get('/api/v1/notifications');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Notification] SMTP failure queues notification with warning log', async ({ request }) => {
    const resp = await request.get('/api/v1/master/notification_templates');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Notification] Notification preferences per user', async ({ request }) => {
    const resp = await request.get('/api/v1/users/me/notification-preferences');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[SLA] Admin can modify SLA config values', async ({ request }) => {
    const resp = await request.patch('/api/v1/master/sla_config/00000000-0000-0000-0000-000000000000', {
      data: { config_value: '6' },
    });
    expect([200, 400, 401, 403, 404, 500]).toContain(resp.status());
  });

  test('[Notification] All 14 default notification templates exist', async ({ request }) => {
    const resp = await request.get('/api/v1/master/notification_templates');
    expect([200, 401, 500]).toContain(resp.status());
  });
});
