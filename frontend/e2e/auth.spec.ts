import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Authentication & Registration', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
  });

  test('should show login page with Google OAuth button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /continue with google|sign in with google/i })).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect new OAuth user to registration form', async ({ page }) => {
    const auth = new AuthHelper(page);
    // Mock OAuth to return registration_required
    await auth.mockGoogleOAuth('mock-temp-jwt', true);

    await page.goto('/login');
    await page.getByRole('button', { name: /continue with google|sign in with google/i }).click();

    // Should navigate to the registration form
    await expect(page).toHaveURL(/\/register/);
  });

  test('should display registration form with master-data-driven dropdowns', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.mockGoogleOAuth('mock-temp-jwt', true);

    await page.goto('/register');

    // Check all required form fields exist
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/gmail|email/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth|dob/i)).toBeVisible();

    // Dropdowns should be populated from master data
    await expect(page.getByLabel(/highest degree|qualification/i)).toBeVisible();
    await expect(page.getByLabel(/gender/i)).toBeVisible();
    await expect(page.getByLabel(/role type/i)).toBeVisible();
  });

  test('should show validation errors on empty registration form submit', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.mockGoogleOAuth('mock-temp-jwt', true);

    await page.goto('/register');

    // Try to submit empty form
    await page.getByRole('button', { name: /submit|register|next/i }).click();

    // Should show validation errors
    await expect(page.getByText(/required|please fill/i).first()).toBeVisible();
  });

  test('should submit registration and show pending state', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.mockGoogleOAuth('mock-temp-jwt', true);

    await page.goto('/register');

    // Fill in registration form
    await page.getByLabel(/full name/i).fill('Test Employee');
    await page.getByLabel(/phone/i).fill('9876543210');

    // Fill date of birth
    const dobField = page.getByLabel(/date of birth|dob/i);
    await dobField.fill('1995-03-15');

    // Select dropdowns (clicking first option in each)
    const qualDropdown = page.getByLabel(/highest degree|qualification/i);
    await qualDropdown.click();
    await page.getByRole('option').first().click();

    const genderDropdown = page.getByLabel(/gender/i);
    await genderDropdown.click();
    await page.getByRole('option').first().click();

    const roleDropdown = page.getByLabel(/role type/i);
    await roleDropdown.click();
    await page.getByRole('option').first().click();

    // Submit
    await page.getByRole('button', { name: /submit|register/i }).click();

    // Should redirect to pending page
    await expect(page).toHaveURL(/\/register\/pending/);
    await expect(page.getByText(/under hr review|pending activation/i)).toBeVisible();
  });

  test('should show admin login page at /admin/login', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('should fail admin login with wrong credentials', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel(/email/i).fill('wrong@rockershr.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
  });

  test('should successfully login as admin and redirect to admin overview', async ({ page }) => {
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();

    await expect(page).toHaveURL(/\/admin\/(overview|dashboard)/);
  });
});
