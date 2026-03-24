import { test, expect } from '@playwright/test';
import { ApiHelper } from './helpers/api';

test.describe('Leave Cancellation', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
  });

  test('should show cancel button for pending leave with future start date', async ({ page }) => {
    // Mock a pending leave request detail
    await page.route('**/api/v1/leave/requests/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'leave-1',
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              duration_type: { label: 'Full Day', day_value: 1.0 },
              start_date: api.futureWorkday(14),
              end_date: api.futureWorkday(14),
              working_days: 1,
              status: 'PENDING_L1',
              reason: 'Test leave',
              sandwich_flag: false,
              submitted_by_admin: null,
              can_cancel: true,
              approvals: [
                { level: 1, approver: { name: 'Manager' }, action: null, sla_deadline: new Date().toISOString() },
              ],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/my-leaves/leave-1');

    // Cancel button should be visible
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('should NOT show cancel button for past/started leave', async ({ page }) => {
    await page.route('**/api/v1/leave/requests/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'leave-2',
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              duration_type: { label: 'Full Day', day_value: 1.0 },
              start_date: '2025-01-15',
              end_date: '2025-01-15',
              working_days: 1,
              status: 'APPROVED',
              reason: 'Past leave',
              can_cancel: false,
              approvals: [
                { level: 1, approver: { name: 'Manager' }, action: 'approved', actioned_at: '2025-01-14T10:00:00Z' },
                { level: 2, approver: { name: 'HR' }, action: 'approved', actioned_at: '2025-01-14T12:00:00Z' },
              ],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/my-leaves/leave-2');

    // Cancel button should NOT be visible
    await expect(page.getByRole('button', { name: /cancel/i })).not.toBeVisible();
  });

  test('should show confirmation dialog when cancel is clicked', async ({ page }) => {
    await page.route('**/api/v1/leave/requests/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'leave-3',
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              duration_type: { label: 'Full Day', day_value: 1.0 },
              start_date: api.futureWorkday(14),
              end_date: api.futureWorkday(14),
              working_days: 1,
              status: 'PENDING_L1',
              reason: 'Test leave for cancellation',
              can_cancel: true,
              approvals: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/my-leaves/leave-3');
    await page.getByRole('button', { name: /cancel/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText(/are you sure/i)).toBeVisible();
    await expect(page.getByText(/balance.*restored/i).or(page.getByText(/cancel.*request/i))).toBeVisible();
  });

  test('should successfully cancel a leave request', async ({ page }) => {
    let cancelCalled = false;

    await page.route('**/api/v1/leave/requests/leave-4', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'leave-4',
            leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
            duration_type: { label: 'Full Day', day_value: 1.0 },
            start_date: api.futureWorkday(14),
            end_date: api.futureWorkday(14),
            working_days: 1,
            status: cancelCalled ? 'CANCELLED' : 'PENDING_L1',
            reason: 'Test leave for cancellation',
            can_cancel: !cancelCalled,
            approvals: [],
          },
        }),
      });
    });

    await page.route('**/api/v1/leave/requests/leave-4/cancel', async (route) => {
      cancelCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'leave-4',
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
            balance_restored: { leave_type: 'Casual Leave', days_returned: 1 },
          },
        }),
      });
    });

    await page.goto('/my-leaves/leave-4');
    await page.getByRole('button', { name: /cancel/i }).click();

    // Confirm cancellation in dialog
    await page.getByRole('button', { name: /cancel request|confirm|yes/i }).click();

    // Should show success or cancelled status
    await expect(page.getByText(/cancelled/i)).toBeVisible();
  });
});
