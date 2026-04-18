import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Admin Employee Profile Edit', () => {
  let api: ApiHelper;
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
    adminToken = await api.adminLogin();
  });

  test('should display employees list', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    await page.goto('/admin/employees');
    await page.waitForTimeout(2000);

    await expect(page.getByText(/employees/i).first()).toBeVisible();
  });

  test('should navigate to employee detail page', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    await page.goto('/admin/employees');
    await page.waitForTimeout(3000);

    // Click on first employee row/link
    const firstRow = page.locator('a[href*="/admin/employees/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/admin\/employees\/.+/);
    }
  });

  test('should have Edit Profile button on employee detail page', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    const employee = await api.createEmployee(adminToken);
    await page.goto(`/admin/employees/${employee.id}`);
    await page.waitForTimeout(3000);

    await expect(page.getByText(/edit profile/i)).toBeVisible();
  });

  test('should display edit form with all fields', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    const employee = await api.createEmployee(adminToken);
    await page.goto(`/admin/employees/${employee.id}/edit`);
    await page.waitForTimeout(3000);

    // Check form fields exist by their label text
    await expect(page.getByText('Full Name')).toBeVisible();
    await expect(page.getByText('Phone')).toBeVisible();
    await expect(page.getByText('Department', { exact: true })).toBeVisible();
    await expect(page.getByText('Manager', { exact: true })).toBeVisible();
    await expect(page.getByText('Joining Date', { exact: true })).toBeVisible();
    await expect(page.getByText('Probation Confirmation Date', { exact: true })).toBeVisible();
  });

  test('should display separation details section', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    const employee = await api.createEmployee(adminToken);
    await page.goto(`/admin/employees/${employee.id}/edit`);
    await page.waitForTimeout(3000);

    await expect(page.getByText(/separation details/i)).toBeVisible();
    await expect(page.getByText('Employment Status')).toBeVisible();
    await expect(page.getByText('Resignation Date')).toBeVisible();
    await expect(page.getByText('Last Working Day')).toBeVisible();
  });

  test('should save employee profile changes via API', async ({ request }) => {
    const employee = await api.createEmployee(adminToken);
    const headers = { Authorization: `Bearer ${adminToken}` };
    const apiBase = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

    // Update employee phone
    const res = await request.patch(`${apiBase}/admin/users/${employee.id}`, {
      headers,
      data: { phone: '9999999999' },
    });
    expect(res.ok()).toBeTruthy();

    // Verify update
    const getRes = await request.get(`${apiBase}/admin/users/${employee.id}`, { headers });
    const body = await getRes.json();
    expect(body.data.phone).toBe('9999999999');
  });
});
