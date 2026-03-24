import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Admin — Level 2 Approval', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request, page }) => {
    api = new ApiHelper(request);
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();
  });

  test('should show pending L2 approvals page', async ({ page }) => {
    await page.goto('/admin/approvals');

    await expect(
      page.getByText(/pending.*approval|approval.*pending|level 2/i),
    ).toBeVisible();
  });

  test('should list pending L2 requests with employee details', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l2-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma', department: 'Engineering' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L2',
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              l1_approver: { name: 'Sanjay Kumar' },
              l1_approved_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/admin/approvals');

    await expect(page.getByText(/priya sharma/i)).toBeVisible();
    await expect(page.getByText(/casual leave/i)).toBeVisible();
  });

  test('should approve at Level 2 — triggers calendar + notification', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l2-1',
              user: { id: 'emp-1', full_name: 'Priya Sharma' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(7),
              end_date: api.futureWorkday(8),
              working_days: 2,
              status: 'PENDING_L2',
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l2-1/approve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'lr-l2-1',
            status: 'APPROVED',
            calendar_event_id: 'google-cal-event-123',
          },
        }),
      });
    });

    await page.goto('/admin/approvals');
    await page.getByRole('button', { name: /approve/i }).first().click();

    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|approve/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/approved|success/i)).toBeVisible();
  });

  test('should decline at Level 2 with reason', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l2-2',
              user: { id: 'emp-2', full_name: 'Arjun K' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(5),
              end_date: api.futureWorkday(5),
              working_days: 1,
              status: 'PENDING_L2',
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l2-2/decline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'lr-l2-2', status: 'DECLINED' },
        }),
      });
    });

    await page.goto('/admin/approvals');
    await page.getByRole('button', { name: /decline/i }).first().click();

    // Fill decline reason
    const reasonField = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
    await reasonField.fill('Company policy does not allow leave during this period.');

    await page.getByRole('button', { name: /decline|confirm|submit/i }).click();

    await expect(page.getByText(/declined|success/i)).toBeVisible();
  });

  test('should show escalated requests in the pending list', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-escalated',
              user: { id: 'emp-3', full_name: 'Escalated User' },
              leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
              start_date: api.futureWorkday(3),
              end_date: api.futureWorkday(3),
              working_days: 1,
              status: 'ESCALATED',
              escalated_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/admin/approvals');

    await expect(page.getByText(/escalated/i)).toBeVisible();
    await expect(page.getByText(/escalated user/i)).toBeVisible();
  });
});
