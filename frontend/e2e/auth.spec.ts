import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Authentication & Registration', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
  });

  test('should show login page with Google OAuth link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/continue with google/i)).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show admin login page at /admin/login', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByText(/admin login/i)).toBeVisible();
    await expect(page.getByPlaceholder(/admin@/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should fail admin login with wrong credentials', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder(/admin@/i).fill('wrong@rockershr.com');
    await page.getByPlaceholder(/enter your password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
  });

  test('should successfully login as admin and redirect to admin overview', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder(/admin@/i).fill('admin@rockers.com');
    await page.getByPlaceholder(/enter your password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/(overview|dashboard)/);
  });
});
