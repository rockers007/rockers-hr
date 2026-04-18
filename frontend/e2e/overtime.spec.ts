import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

test.describe('Overtime Management', () => {
  let api: ApiHelper;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    adminToken = await api.adminLogin();
  });

  test.describe('Admin Overtime Page', () => {
    test('should display overtime management page with tabs', async ({ page }) => {
      const auth = new AuthHelper(page);
      await auth.loginAsAdmin();

      await page.goto('/admin/overtime');
      await expect(page.getByText(/overtime management/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /pending/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /approved/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /declined/i })).toBeVisible();
    });

    test('should show pending overtime requests', async ({ page }) => {
      const auth = new AuthHelper(page);
      await auth.loginAsAdmin();

      await page.goto('/admin/overtime');
      await page.waitForTimeout(2000);

      // Page should be on pending tab by default
      await expect(page.getByText(/overtime management/i)).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      const auth = new AuthHelper(page);
      await auth.loginAsAdmin();

      await page.goto('/admin/overtime');
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: /approved/i }).click();
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: /^all$/i }).click();
      await page.waitForTimeout(1000);

      await expect(page).toHaveURL(/\/admin\/overtime/);
    });
  });

  test.describe('Overtime API', () => {
    test('should list all overtime requests via admin API', async ({ request }) => {
      const headers = { Authorization: `Bearer ${adminToken}` };

      const res = await request.get(`${API_BASE}/admin/overtime`, { headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('should list pending overtime requests via admin API', async ({ request }) => {
      const headers = { Authorization: `Bearer ${adminToken}` };

      const res = await request.get(`${API_BASE}/admin/overtime/pending`, { headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    });
  });
});
