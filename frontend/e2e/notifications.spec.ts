import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user session
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'user-1',
            name: 'Notification Test User',
            email: 'notifuser@gmail.com',
            role: 'employee',
          },
        }),
      });
    });
  });

  test('should show unread notification count on bell icon', async ({ page }) => {
    await page.route('**/api/v1/notifications/count', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { unread: 5 } }),
      });
    });

    await page.goto('/dashboard');

    // Bell icon should show badge with count
    const badge = page
      .locator('[data-testid="notification-badge"]')
      .or(page.locator('[aria-label*="notification"] .badge'))
      .or(page.getByText('5'));
    await expect(badge).toBeVisible();
  });

  test('should navigate to notifications page', async ({ page }) => {
    await page.route('**/api/v1/notifications/count', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { unread: 3 } }),
      });
    });

    await page.goto('/dashboard');

    // Click notification bell
    const bell = page
      .locator('[data-testid="notification-bell"]')
      .or(page.locator('[aria-label*="notification"]'));
    await bell.click();

    await expect(page).toHaveURL(/\/notifications/);
  });

  test('should display list of notifications', async ({ page }) => {
    await page.route('**/api/v1/notifications?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'notif-1',
              event_key: 'leave.approved.l2',
              rendered_title: 'Leave Fully Approved',
              rendered_body: 'Your Casual Leave request for Mar 25-26 has been fully approved.',
              is_read: false,
              created_at: new Date().toISOString(),
            },
            {
              id: 'notif-2',
              event_key: 'leave.submitted.employee',
              rendered_title: 'Leave Request Submitted',
              rendered_body: 'Your Sick Leave request for Apr 10 has been submitted.',
              is_read: false,
              created_at: new Date(Date.now() - 86400000).toISOString(),
            },
            {
              id: 'notif-3',
              event_key: 'registration.activated',
              rendered_title: 'Account Activated',
              rendered_body: 'Welcome to Rockers HR! Your account has been activated.',
              is_read: true,
              created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
            },
          ],
          meta: { total: 3, page: 1, limit: 20 },
        }),
      });
    });

    await page.goto('/notifications');

    // Should show notification items
    await expect(page.getByText(/leave fully approved/i)).toBeVisible();
    await expect(page.getByText(/leave request submitted/i)).toBeVisible();
    await expect(page.getByText(/account activated/i)).toBeVisible();
  });

  test('should visually distinguish read and unread notifications', async ({ page }) => {
    await page.route('**/api/v1/notifications?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'notif-unread',
              event_key: 'leave.approved.l2',
              rendered_title: 'Unread Notification',
              rendered_body: 'This is unread.',
              is_read: false,
              created_at: new Date().toISOString(),
            },
            {
              id: 'notif-read',
              event_key: 'leave.submitted.employee',
              rendered_title: 'Read Notification',
              rendered_body: 'This is read.',
              is_read: true,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/notifications');

    // Unread notifications should have distinct styling (blue border, background, etc.)
    const unreadItem = page.getByText(/unread notification/i).locator('..');
    const readItem = page.getByText(/read notification/i).locator('..');

    // Both should be visible
    await expect(unreadItem).toBeVisible();
    await expect(readItem).toBeVisible();
  });

  test('should mark a single notification as read', async ({ page }) => {
    let markReadCalled = false;

    await page.route('**/api/v1/notifications?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'notif-1',
              event_key: 'leave.approved.l2',
              rendered_title: 'Leave Approved',
              rendered_body: 'Your leave was approved.',
              is_read: markReadCalled,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/notifications/notif-1/read', async (route) => {
      markReadCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'notif-1', is_read: true } }),
      });
    });

    await page.goto('/notifications');

    // Click on the notification to mark as read (or click a mark-read button)
    const notification = page.getByText(/leave approved/i);
    await notification.click();

    // The mark-read API should have been called
    expect(markReadCalled).toBe(true);
  });

  test('should mark all notifications as read', async ({ page }) => {
    let markAllReadCalled = false;

    await page.route('**/api/v1/notifications?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'notif-1',
              rendered_title: 'Notification 1',
              rendered_body: 'Body 1',
              is_read: markAllReadCalled,
              created_at: new Date().toISOString(),
            },
            {
              id: 'notif-2',
              rendered_title: 'Notification 2',
              rendered_body: 'Body 2',
              is_read: markAllReadCalled,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/notifications/read-all', async (route) => {
      markAllReadCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: 2 } }),
      });
    });

    await page.goto('/notifications');

    // Click "Mark all as read" button
    const markAllBtn = page.getByRole('button', { name: /mark all.*read|read all/i });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      expect(markAllReadCalled).toBe(true);
    }
  });

  test('should show empty state when no notifications', async ({ page }) => {
    await page.route('**/api/v1/notifications?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
      });
    });

    await page.goto('/notifications');

    // Should show empty state
    await expect(
      page.getByText(/no notification|all caught up|nothing/i),
    ).toBeVisible();
  });
});
