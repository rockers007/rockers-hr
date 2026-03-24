import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Leave Application — 3-Step Flow', () => {
  let api: ApiHelper;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    adminToken = await api.adminLogin();
  });

  test.describe('Step 1 — Type & Dates', () => {
    test('should display leave type selector with balance info', async ({ page }) => {
      await page.goto('/apply');

      // Leave type pills/cards should be present
      const leaveTypes = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button, .leave-type-selector [role="radio"]',
      );
      await expect(leaveTypes.first()).toBeVisible();
    });

    test('should show duration type options (Full Day / Half Day)', async ({ page }) => {
      await page.goto('/apply');

      await expect(
        page.getByText(/full day/i).or(page.getByRole('radio', { name: /full day/i })),
      ).toBeVisible();
    });

    test('should have date pickers for From and To dates', async ({ page }) => {
      await page.goto('/apply');

      await expect(page.getByLabel(/from date|start date/i)).toBeVisible();
      await expect(page.getByLabel(/to date|end date/i)).toBeVisible();
    });

    test('should show live calculation when dates are selected', async ({ page }) => {
      await page.goto('/apply');

      // Select first leave type
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      // Select dates
      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureDate);

      // Working days calculation should appear
      await expect(page.getByText(/working day/i)).toBeVisible();
    });

    test('should show sandwich leave warning when applicable', async ({ page }) => {
      // This test requires specific dates that trigger sandwich detection
      // We'll mock the calculate endpoint to return sandwich_detected: true
      await page.route('**/api/v1/leave/calculate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              working_days: 2,
              balance_before: 8,
              balance_after: 6,
              sandwich_detected: true,
              sandwich_detail: 'Your leave spans a weekend (Sat-Sun) between two working days.',
              doc_required: false,
            },
          }),
        });
      });

      await page.goto('/apply');

      // Select a leave type and dates
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const friday = api.futureWorkday(5);
      const monday = api.futureWorkday(8);
      await page.getByLabel(/from date|start date/i).fill(friday);
      await page.getByLabel(/to date|end date/i).fill(monday);

      // Sandwich warning should appear
      await expect(page.getByText(/sandwich/i)).toBeVisible();
    });
  });

  test.describe('Step 2 — Reason & Document', () => {
    test('should require reason with minimum 10 characters', async ({ page }) => {
      await page.goto('/apply');

      // Navigate to step 2 (select type, dates, click next)
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureDate);
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Reason field should be visible
      await expect(page.getByLabel(/reason/i)).toBeVisible();

      // Try short reason
      await page.getByLabel(/reason/i).fill('Short');
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Should show validation error
      await expect(page.getByText(/minimum|at least|10/i)).toBeVisible();
    });

    test('should show file upload when document is required', async ({ page }) => {
      // Mock a leave type that requires docs
      await page.route('**/api/v1/leave/calculate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              working_days: 3,
              balance_before: 6,
              balance_after: 3,
              sandwich_detected: false,
              sandwich_detail: null,
              doc_required: true,
            },
          }),
        });
      });

      await page.goto('/apply');

      // Select type and dates
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureDate);
      await page.getByRole('button', { name: /next|continue/i }).click();

      // File upload area should be visible
      await expect(
        page.getByText(/upload|document|attach/i).or(page.locator('input[type="file"]')),
      ).toBeVisible();
    });
  });

  test.describe('Step 3 — Review & Submit', () => {
    test('should show summary of all entered data', async ({ page }) => {
      await page.goto('/apply');

      // Complete Step 1
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureDate);
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Complete Step 2
      await page.getByLabel(/reason/i).fill('Testing leave application E2E flow');
      await page.getByRole('button', { name: /next|continue|review/i }).click();

      // Step 3 should show summary
      await expect(page.getByText(/review|summary/i)).toBeVisible();
      await expect(page.getByText(/testing leave application/i)).toBeVisible();

      // Submit button should be visible
      await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
    });

    test('should successfully submit leave request', async ({ page }) => {
      // Mock the submit endpoint
      await page.route('**/api/v1/leave/requests', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 'new-leave-id',
                status: 'PENDING_L1',
                working_days: 1,
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/apply');

      // Complete all 3 steps
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const futureDate = api.futureWorkday(14);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureDate);
      await page.getByRole('button', { name: /next|continue/i }).click();

      await page.getByLabel(/reason/i).fill('E2E automated test submission');
      await page.getByRole('button', { name: /next|continue|review/i }).click();

      await page.getByRole('button', { name: /submit/i }).click();

      // Should show success feedback
      await expect(page.getByText(/success|submitted|confirmed/i)).toBeVisible();
    });
  });

  test.describe('Validation Errors', () => {
    test('should show insufficient balance error', async ({ page }) => {
      await page.route('**/api/v1/leave/requests', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'INSUFFICIENT_BALANCE',
                message: 'You have 3 days available but requested 5.',
                statusCode: 422,
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/apply');

      // Fill out form and submit (simplified — would trigger the mocked error)
      const firstType = page.locator(
        '[data-testid="leave-type-option"], .leave-type-selector button',
      );
      await firstType.first().click();

      const futureDate = api.futureWorkday(14);
      const futureEnd = api.futureWorkday(28);
      await page.getByLabel(/from date|start date/i).fill(futureDate);
      await page.getByLabel(/to date|end date/i).fill(futureEnd);
      await page.getByRole('button', { name: /next|continue/i }).click();

      await page.getByLabel(/reason/i).fill('Testing insufficient balance');
      await page.getByRole('button', { name: /next|continue|review/i }).click();

      await page.getByRole('button', { name: /submit/i }).click();

      // Should show error
      await expect(page.getByText(/insufficient|balance|available/i)).toBeVisible();
    });
  });
});
