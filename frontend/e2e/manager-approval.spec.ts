import { test, expect } from '@playwright/test';
import { ApiHelper } from './helpers/api';

test.describe('Manager Approval — Level 1', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
  });

  test('should show pending approvals list for manager', async ({ page }) => {
    // Mock pending approvals endpoint
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              sla_remaining_hours: 3,
            },
            {
              id: 'lr-2',
              user: { id: 'emp-2', full_name: 'Arjun Kulkarni' },
              leave_type: { id: 'lt-2', label: 'Sick Leave', color: '#ef4444' },
              start_date: api.futureWorkday(3),
              end_date: api.futureWorkday(3),
              working_days: 1,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
              sla_remaining_hours: -1,
            },
          ],
        }),
      });
    });

    // Navigate to manager approvals (could be on dashboard or separate page)
    await page.goto('/dashboard');

    // Should see pending approvals
    await expect(page.getByText(/priya sharma/i)).toBeVisible();
    await expect(page.getByText(/arjun kulkarni/i)).toBeVisible();
  });

  test('should show approve and decline buttons on each request', async ({ page }) => {
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              sla_remaining_hours: 3,
            },
          ],
        }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /decline/i })).toBeVisible();
  });

  test('should successfully approve a leave request at L1', async ({ page }) => {
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              sla_remaining_hours: 3,
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/manager/approvals/lr-1/approve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'lr-1', status: 'PENDING_L2' },
        }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /approve/i }).first().click();

    // Confirmation dialog may appear
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|approve/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // Success feedback
    await expect(page.getByText(/approved|success/i)).toBeVisible();
  });

  test('should require reason when declining', async ({ page }) => {
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              sla_remaining_hours: 3,
            },
          ],
        }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /decline/i }).first().click();

    // Reason field should appear
    await expect(page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i))).toBeVisible();
  });

  test('should successfully decline with reason', async ({ page }) => {
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              sla_remaining_hours: 3,
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/manager/approvals/lr-1/decline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'lr-1', status: 'DECLINED' },
        }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /decline/i }).first().click();

    // Fill reason
    const reasonField = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
    await reasonField.fill('Team at full capacity during these dates.');

    // Submit decline
    await page.getByRole('button', { name: /decline.*leave|confirm.*decline|submit/i }).click();

    // Success feedback
    await expect(page.getByText(/declined|success/i)).toBeVisible();
  });

  test('should show SLA overdue indicator', async ({ page }) => {
    await page.route('**/api/v1/manager/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-overdue',
              user: { id: 'emp-1', full_name: 'Late Approval' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(7),
              working_days: 1,
              status: 'PENDING_L1',
              sla_deadline: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
              sla_remaining_hours: -2,
            },
          ],
        }),
      });
    });

    await page.goto('/dashboard');

    // Should show overdue indicator
    await expect(page.getByText(/overdue/i).or(page.locator('.sla-overdue'))).toBeVisible();
  });
});
