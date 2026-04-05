import { test, expect } from '@playwright/test';
import { ApiHelper } from './helpers/api';

const MOCK_USER = {
  id: 'mock-emp-id',
  name: 'Test Employee',
  email: 'test@gmail.com',
  role: 'employee',
  employment_status: 'active',
  last_working_day: null,
};

const MOCK_LEAVE_TYPES = [
  { id: 'cl-id', label: 'Casual Leave', color: '#3b82f6', unit: 'days', max_days_per_request: 2, doc_required: false, doc_threshold_days: null },
  { id: 'sl-id', label: 'Sick Leave', color: '#10b981', unit: 'days', max_days_per_request: null, doc_required: false, doc_threshold_days: null },
];

const MOCK_DURATIONS = [
  { id: 'fd-id', label: 'Full Day', day_value: '1.00', is_active: true, sort_order: 1 },
  { id: 'hd-id', label: 'Half Day', day_value: '0.50', is_active: true, sort_order: 2 },
];

const MOCK_BALANCES = [
  { leave_type: { id: 'cl-id', label: 'Casual Leave' }, total_days: 8, used_days: 0, pending_days: 0, available_days: 8 },
  { leave_type: { id: 'sl-id', label: 'Sick Leave' }, total_days: 6, used_days: 0, pending_days: 0, available_days: 6 },
];

const MOCK_CALC_OK = {
  working_days: 1,
  balance_before: 8,
  balance_after: 7,
  sandwich_detected: false,
  sandwich_detail: null,
  doc_required: false,
};

/** Click the first leave type and first duration type (required before dates work) */
async function selectLeaveAndDuration(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="leave-type-option"]').first().click();
  await page.getByText(/full day/i).first().click();
}

/** Set up all API mocks needed for the apply page to load as authenticated employee */
async function setupEmployeeMocks(page: import('@playwright/test').Page) {
  // Inject a mock JWT into localStorage before the page initialises
  // parseJwt() in auth-store.ts just base64-decodes the payload — no signature check
  await page.addInitScript(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = btoa(JSON.stringify({
      sub: 'mock-emp-id',
      is_active: true,
      is_admin: false,
      email: 'test@gmail.com',
      exp: 9999999999,
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    localStorage.setItem('token', `${header}.${payload}.mock_sig`);
  });

  // Wildcard fallback registered FIRST (lowest priority in Playwright's LIFO order)
  await page.route('**/api/v1/master/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/master/leave_durations')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_DURATIONS }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
  });

  // Specific routes registered AFTER (higher priority — LIFO)
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_USER }) }),
  );
  await page.route('**/api/v1/leave/balance', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_BALANCES }) }),
  );
  await page.route('**/api/v1/leave/types/eligible', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_LEAVE_TYPES }) }),
  );
}

test.describe('Leave Application — 3-Step Flow', () => {
  let api: ApiHelper;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    try {
      adminToken = await api.adminLogin();
    } catch {
      adminToken = '';
    }
  });

  test.describe('Step 1 — Type & Dates', () => {
    test('should display leave type selector with balance info', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.goto('/apply');

      // Leave type pills should be visible
      await expect(page.locator('[data-testid="leave-type-option"]').first()).toBeVisible({ timeout: 10000 });
      // Should show balance
      await expect(page.getByText(/casual leave/i)).toBeVisible();
    });

    test('should show duration type options (Full Day / Half Day)', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.goto('/apply');

      await expect(page.getByText(/full day/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/half day/i)).toBeVisible();
    });

    test('should have date pickers for From and To dates', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.goto('/apply');

      await expect(page.getByLabel(/from date/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByLabel(/to date/i)).toBeVisible();
    });

    test('should show live calculation when dates are selected', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );
      await page.goto('/apply');

      await selectLeaveAndDuration(page);

      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);

      await expect(page.getByText(/working day/i)).toBeVisible({ timeout: 10000 });
    });

    test('should show sandwich leave warning when applicable', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              working_days: 2,
              balance_before: 8,
              balance_after: 6,
              sandwich_detected: true,
              sandwich_detail: 'Your leave spans a weekend between two working days.',
              doc_required: false,
            },
          }),
        }),
      );

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const friday = api.futureWorkday(5);
      const monday = api.futureWorkday(8);
      await page.getByLabel(/from date/i).fill(friday);
      await page.getByLabel(/to date/i).fill(monday);

      await expect(page.getByText(/sandwich/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Step 1 — Validation Errors (shown immediately)', () => {
    test('should show CL max 2 days error on Step 1 and block Next button', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'MAX_DAYS_EXCEEDED',
              message: 'Casual Leave allows maximum 2 days per request. You requested 3 days.',
              statusCode: 422,
            },
          }),
        }),
      );

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const startDate = api.futureWorkday(14);
      const endDate = api.futureWorkday(17); // 3+ working days
      await page.getByLabel(/from date/i).fill(startDate);
      await page.getByLabel(/to date/i).fill(endDate);

      // Error must appear on Step 1 immediately
      await expect(page.getByText(/maximum 2 days|casual leave allows/i)).toBeVisible({ timeout: 10000 });

      // Next button must be disabled
      await expect(page.getByRole('button', { name: /^next$/i })).toBeDisabled();
    });

    test('should clear error and enable Next when dates corrected', async ({ page }) => {
      await setupEmployeeMocks(page);
      let callCount = 0;
      await page.route('**/api/v1/leave/calculate', async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { message: 'Casual Leave allows maximum 2 days per request. You requested 3 days.', statusCode: 422 },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: MOCK_CALC_OK }),
          });
        }
      });

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const startDate = api.futureWorkday(14);
      const endDate = api.futureWorkday(17);
      await page.getByLabel(/from date/i).fill(startDate);
      await page.getByLabel(/to date/i).fill(endDate);

      // Error appears
      await expect(page.getByText(/maximum 2 days|casual leave allows/i)).toBeVisible({ timeout: 10000 });

      // Fix: change end date to same as start (1 day)
      await page.getByLabel(/to date/i).fill(startDate);

      // Error clears
      await expect(page.getByText(/maximum 2 days|casual leave allows/i)).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
    });
  });

  test.describe('Step 2 — Reason & Document', () => {
    test('should require reason with minimum 10 characters', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);

      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 2 — reason field
      await expect(page.getByLabel(/reason/i)).toBeVisible({ timeout: 10000 });
      await page.getByLabel(/reason/i).fill('Short');
      await expect(page.getByText(/minimum|at least|10/i)).toBeVisible();

      // Next button should be disabled
      await expect(page.getByRole('button', { name: /^next$/i })).toBeDisabled();
    });

    test('should show file upload when document is required', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_CALC_OK, doc_required: true } }),
        }),
      );

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);

      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      // Document area should be visible on Step 2 (use first() to avoid strict mode violation)
      await expect(page.getByText(/supporting document|upload|attach/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Step 3 — Review & Submit', () => {
    test('should show summary of all entered data', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );

      await page.goto('/apply');

      // Step 1
      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 2
      await page.getByLabel(/reason/i).fill('Testing leave application E2E flow');
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 5000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 3 — summary
      await expect(page.getByText(/review your application/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/testing leave application/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
    });

    test('should successfully submit leave request', async ({ page }) => {
      await setupEmployeeMocks(page);
      // Mock all data needed after redirect to /my-leaves
      await page.route('**/api/v1/leave/requests**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ data: { id: 'new-leave-id', status: 'PENDING_L1', working_days: 1 } }),
          });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }) });
        }
      });
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );
      await page.route('**/api/v1/leave/balance', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_BALANCES }) }),
      );

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      await page.getByLabel(/reason/i).fill('E2E automated test submission');
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 5000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      await page.getByRole('button', { name: /submit/i }).click();

      // After successful submit, app redirects to /my-leaves
      await page.waitForURL('**/my-leaves', { timeout: 15000 });
    });

    test('should clear error banner when clicking Back', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );
      await page.route('**/api/v1/leave/requests', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Some submission error', statusCode: 422 } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      await page.getByLabel(/reason/i).fill('Testing back button clears error');
      await page.getByRole('button', { name: /^next$/i }).click();

      // Submit → get error
      await page.getByRole('button', { name: /submit/i }).click();
      await expect(page.getByText(/some submission error/i)).toBeVisible({ timeout: 10000 });

      // Click Back → error must disappear
      await page.getByRole('button', { name: /^back$/i }).click();
      await expect(page.getByText(/some submission error/i)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Validation Errors', () => {
    test('should show insufficient balance error', async ({ page }) => {
      await setupEmployeeMocks(page);
      await page.route('**/api/v1/leave/calculate', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_CALC_OK }) }),
      );
      await page.route('**/api/v1/leave/requests', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INSUFFICIENT_BALANCE', message: 'You have 3 days available but requested 5.', statusCode: 422 } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/apply');

      await selectLeaveAndDuration(page);
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date/i).fill(futureDate);
      await page.getByLabel(/to date/i).fill(futureDate);
      await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled({ timeout: 10000 });
      await page.getByRole('button', { name: /^next$/i }).click();

      await page.getByLabel(/reason/i).fill('Testing insufficient balance');
      await page.getByRole('button', { name: /^next$/i }).click();

      await page.getByRole('button', { name: /submit/i }).click();

      // Error banner contains the specific message from mock
      await expect(page.locator('.bg-\\[\\#fee2e2\\]')).toBeVisible({ timeout: 10000 });
    });
  });
});
