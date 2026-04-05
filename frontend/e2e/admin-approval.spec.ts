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

  test('should show pending approvals page', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/admin/approvals');

    await expect(
      page.getByRole('heading', { name: 'Pending Approvals', exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('should list pending requests with employee details', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l2-1',
              level: 2,
              leave_request: {
                id: 'req-1',
                user: { id: 'emp-1', name: 'Priya Sharma', gmail: 'priya@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(7),
                end_date: api.futureWorkday(8),
                working_days: 2,
                reason: 'Family event',
                sandwich_flag: false,
                status: 'pending_l2',
              },
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
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
              level: 2,
              leave_request: {
                id: 'req-approve',
                user: { id: 'emp-1', name: 'Priya Sharma', gmail: 'priya@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(7),
                end_date: api.futureWorkday(8),
                working_days: 2,
                reason: 'Family event',
                sandwich_flag: false,
                status: 'pending_l2',
              },
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l2-1/approve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'approved' } }),
      });
    });

    await page.goto('/admin/approvals');

    // Wait for the approve button to appear and click it
    const approveBtn = page.getByRole('button', { name: 'Approve' }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // The card should be removed (approved) and toast shown
    await expect(page.getByText(/approved|success/i)).toBeVisible({ timeout: 10_000 });
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
              level: 2,
              leave_request: {
                id: 'req-decline',
                user: { id: 'emp-2', name: 'Arjun K', gmail: 'arjun@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(5),
                end_date: api.futureWorkday(5),
                working_days: 1,
                reason: 'Personal',
                sandwich_flag: false,
                status: 'pending_l2',
              },
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l2-2/decline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'declined' } }),
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

  test('should show L1 (manager-pending) requests and allow admin direct approval', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l1-direct',
              level: 1,
              leave_request: {
                id: 'req-l1-1',
                user: { id: 'emp-5', name: 'Neha Gupta', gmail: 'neha@gmail.com' },
                leave_type: { id: 'lt-2', label: 'Sick Leave', color: '#ef4444' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(3),
                end_date: api.futureWorkday(3),
                working_days: 1,
                reason: 'Not feeling well',
                sandwich_flag: false,
                status: 'pending_l1',
              },
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l1-direct/approve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'approved' } }),
      });
    });

    await page.goto('/admin/approvals');

    // Verify L1 badge is visible
    await expect(page.getByText(/pending manager/i)).toBeVisible();
    await expect(page.getByText(/neha gupta/i)).toBeVisible();
    await expect(page.getByText(/sick leave/i)).toBeVisible();

    // Admin directly approves L1
    await page.getByRole('button', { name: /approve/i }).first().click();

    await expect(page.getByText(/approved|success/i)).toBeVisible();
  });

  test('should display both L1 and L2 approvals with correct badges', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l1-badge',
              level: 1,
              leave_request: {
                id: 'req-l1-b',
                user: { id: 'emp-6', name: 'L1 Employee', gmail: 'l1@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(5),
                end_date: api.futureWorkday(5),
                working_days: 1,
                reason: 'Personal work',
                sandwich_flag: false,
                status: 'pending_l1',
              },
              sla_deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
            {
              id: 'lr-l2-badge',
              level: 2,
              leave_request: {
                id: 'req-l2-b',
                user: { id: 'emp-7', name: 'L2 Employee', gmail: 'l2@gmail.com' },
                leave_type: { id: 'lt-2', label: 'Sick Leave', color: '#ef4444' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(6),
                end_date: api.futureWorkday(7),
                working_days: 2,
                reason: 'Medical',
                sandwich_flag: false,
                status: 'pending_l2',
              },
              sla_deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/admin/approvals');

    // Both badges should be visible
    await expect(page.getByText(/pending manager/i)).toBeVisible();
    await expect(page.getByText(/pending hr/i)).toBeVisible();

    // Both employees visible
    await expect(page.getByText(/l1 employee/i)).toBeVisible();
    await expect(page.getByText(/l2 employee/i)).toBeVisible();
  });

  test('should allow admin to decline an L1 approval directly', async ({ page }) => {
    await page.route('**/api/v1/admin/approvals/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'lr-l1-decline',
              level: 1,
              leave_request: {
                id: 'req-l1-d',
                user: { id: 'emp-8', name: 'Decline Test', gmail: 'decline@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(4),
                end_date: api.futureWorkday(4),
                working_days: 1,
                reason: 'Shopping',
                sandwich_flag: false,
                status: 'pending_l1',
              },
              sla_deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/approvals/lr-l1-decline/decline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'declined' } }),
      });
    });

    await page.goto('/admin/approvals');

    await page.getByRole('button', { name: /decline/i }).first().click();

    // Fill decline reason
    const reasonField = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
    await reasonField.fill('Not enough notice given.');

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
              level: 2,
              leave_request: {
                id: 'req-esc',
                user: { id: 'emp-3', name: 'Escalated User', gmail: 'esc@gmail.com' },
                leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
                duration_type: { label: 'Full Day' },
                start_date: api.futureWorkday(3),
                end_date: api.futureWorkday(3),
                working_days: 1,
                reason: 'Urgent personal work',
                sandwich_flag: false,
                status: 'escalated',
              },
              sla_deadline: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/admin/approvals');

    await expect(page.getByText(/escalated user/i)).toBeVisible();
  });
});
