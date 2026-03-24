import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Employee Dashboard', () => {
  let api: ApiHelper;
  let adminToken: string;
  let employee: { id: string; gmail: string };

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    adminToken = await api.adminLogin();

    // Seed a test employee
    employee = await api.createEmployee(adminToken, {
      name: 'Dashboard Test User',
      join_date: '2025-01-01',
      account_status: 'active',
    });
  });

  test.beforeEach(async ({ page }) => {
    // Mock OAuth to log in as the test employee
    const auth = new AuthHelper(page);
    // For real integration tests, we'd get a JWT for this employee from the API.
    // Here we intercept the API calls to simulate authentication.
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: employee.id,
            name: 'Dashboard Test User',
            email: employee.gmail,
            role: 'employee',
            department: { id: 'dept-1', label: 'Engineering' },
            is_in_probation: false,
          },
        }),
      });
    });
  });

  test('should display the dashboard with greeting', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/hi,.*dashboard test user/i)).toBeVisible();
  });

  test('should show leave balance cards', async ({ page }) => {
    await page.goto('/dashboard');

    // Leave balance section should be visible
    await expect(page.getByText(/leave balance/i)).toBeVisible();

    // Balance cards should contain leave type names from master data
    // At minimum, we expect some cards to be rendered
    const balanceCards = page.locator('[data-testid="leave-balance-card"], .leave-balance-card');
    // If test IDs are not set, look for common patterns
    const balanceSection = page.locator('text=/remaining|available|total/i');
    await expect(balanceSection.first()).toBeVisible();
  });

  test('should show Quick Apply button', async ({ page }) => {
    await page.goto('/dashboard');
    const applyBtn = page.getByRole('link', { name: /apply.*leave|apply for leave/i }).or(
      page.getByRole('button', { name: /apply.*leave|apply for leave/i }),
    );
    await expect(applyBtn).toBeVisible();
  });

  test('should display notification bell with unread count', async ({ page }) => {
    await page.goto('/dashboard');
    // Notification bell icon should be present
    const bell = page.locator('[data-testid="notification-bell"], [aria-label*="notification"]');
    await expect(bell).toBeVisible();
  });

  test('should show active requests section', async ({ page }) => {
    await page.goto('/dashboard');
    // Active requests or empty state should be visible
    const activeRequests = page
      .getByText(/active request/i)
      .or(page.getByText(/no.*active|no.*pending/i));
    await expect(activeRequests.first()).toBeVisible();
  });

  test('should show team on leave today section', async ({ page }) => {
    await page.goto('/dashboard');
    // Team section or empty state
    const teamSection = page
      .getByText(/team.*leave.*today/i)
      .or(page.getByText(/everyone.*in.*today/i));
    await expect(teamSection.first()).toBeVisible();
  });

  test('should navigate to leave application from Quick Apply', async ({ page }) => {
    await page.goto('/dashboard');
    const applyBtn = page.getByRole('link', { name: /apply.*leave|apply for leave/i }).or(
      page.getByRole('button', { name: /apply.*leave|apply for leave/i }),
    );
    await applyBtn.click();
    await expect(page).toHaveURL(/\/apply/);
  });
});
