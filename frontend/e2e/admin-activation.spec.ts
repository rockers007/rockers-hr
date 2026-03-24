import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Admin — Registration Activation', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request, page }) => {
    api = new ApiHelper(request);
    // Login as admin for all tests
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();
  });

  test('should show pending registrations page', async ({ page }) => {
    await page.goto('/admin/registrations');

    await expect(page.getByText(/pending.*registration|registration.*pending/i)).toBeVisible();
  });

  test('should list pending registrations', async ({ page }) => {
    // Mock pending registrations endpoint
    await page.route('**/api/v1/admin/registrations/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'pending-1',
              name: 'New Employee',
              gmail: 'newemployee@gmail.com',
              phone: '9876543210',
              created_at: new Date().toISOString(),
              qualification: { label: "Bachelor's" },
              gender: { label: 'Male' },
              role_type: { label: 'Employee' },
            },
          ],
        }),
      });
    });

    await page.goto('/admin/registrations');

    await expect(page.getByText(/new employee/i)).toBeVisible();
    await expect(page.getByText(/newemployee@gmail.com/i)).toBeVisible();
  });

  test('should activate a pending registration', async ({ page }) => {
    await page.route('**/api/v1/admin/registrations/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'pending-1',
              name: 'Pending User',
              gmail: 'pending@gmail.com',
              phone: '9876543210',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/registrations/pending-1/activate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'pending-1', is_active: true },
        }),
      });
    });

    await page.goto('/admin/registrations');

    // Click on the pending registration or the activate button
    await page.getByRole('button', { name: /activate|approve/i }).first().click();

    // Activation form should ask for join date and manager
    const joinDateField = page.getByLabel(/join.*date|joining.*date/i);
    if (await joinDateField.isVisible()) {
      await joinDateField.fill('2026-04-01');
    }

    // Is Manager toggle
    const isManagerToggle = page.getByLabel(/is.*manager|manager.*toggle/i);
    if (await isManagerToggle.isVisible()) {
      // Leave as default (off)
    }

    // Confirm activation
    await page.getByRole('button', { name: /activate|confirm/i }).click();

    // Should show success
    await expect(page.getByText(/activated|success/i)).toBeVisible();
  });

  test('should reject a pending registration with reason', async ({ page }) => {
    await page.route('**/api/v1/admin/registrations/pending', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'pending-2',
              name: 'Rejected User',
              gmail: 'rejected@gmail.com',
              phone: '9876543210',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/admin/registrations/pending-2/reject', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'pending-2', is_active: false },
        }),
      });
    });

    await page.goto('/admin/registrations');

    // Click reject button
    await page.getByRole('button', { name: /reject|decline/i }).first().click();

    // Fill reason
    const reasonField = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
    await reasonField.fill('Duplicate registration.');

    // Confirm rejection
    await page.getByRole('button', { name: /reject|confirm/i }).click();

    // Should show success
    await expect(page.getByText(/rejected|success/i)).toBeVisible();
  });
});
