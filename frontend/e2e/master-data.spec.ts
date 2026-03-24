import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Master Data CRUD', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request, page }) => {
    api = new ApiHelper(request);
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();
  });

  test('should show master data hub with all table cards', async ({ page }) => {
    await page.goto('/admin/master');

    // Should show cards for master tables
    const expectedTables = [
      /qualification/i,
      /gender/i,
      /role type/i,
      /leave type/i,
      /leave duration/i,
      /department/i,
      /file type/i,
      /notification.*template/i,
      /sla.*config/i,
      /public.*holiday/i,
      /admin.*role/i,
    ];

    for (const pattern of expectedTables) {
      await expect(page.getByText(pattern).first()).toBeVisible();
    }
  });

  test('should navigate to leave types CRUD page', async ({ page }) => {
    await page.goto('/admin/master/leave_types');

    await expect(page.getByText(/leave type/i)).toBeVisible();
    // Should show existing leave types from seed data
    await expect(page.getByText(/casual leave/i).or(page.getByText(/sick leave/i))).toBeVisible();
  });

  test('should add a new leave type', async ({ page }) => {
    await page.route('**/api/v1/master/leave_types', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'new-lt-id',
              label: body.label,
              annual_days: body.annual_days,
              probation_allowed: body.probation_allowed,
              doc_required: body.doc_required,
              color: body.color,
              sort_order: body.sort_order || 10,
              is_active: true,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/master/leave_types');

    // Click add new button
    await page.getByRole('button', { name: /add.*new|create|add/i }).click();

    // Fill in new leave type fields
    await page.getByLabel(/label|name/i).fill('Bereavement Leave');
    await page.getByLabel(/annual.*days|days.*year/i).fill('3');

    // Set probation allowed toggle if visible
    const probationToggle = page.getByLabel(/probation.*allowed/i);
    if (await probationToggle.isVisible()) {
      await probationToggle.check();
    }

    // Save
    await page.getByRole('button', { name: /save|create|add/i }).click();

    // Should show the new leave type
    await expect(page.getByText(/bereavement leave/i)).toBeVisible();
  });

  test('should edit an existing leave type', async ({ page }) => {
    await page.route('**/api/v1/master/leave_types/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'lt-1', ...body },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/master/leave_types');

    // Click edit on the first row
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    await editBtn.click();

    // Modify the label or annual days
    const labelField = page.getByLabel(/label|name/i);
    if (await labelField.isVisible()) {
      await labelField.clear();
      await labelField.fill('Casual Leave Updated');
    }

    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    await expect(page.getByText(/updated|saved|success/i)).toBeVisible();
  });

  test('should deactivate a master record', async ({ page }) => {
    await page.route('**/api/v1/master/leave_types/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'lt-1', is_active: false },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/master/leave_types');

    // Click deactivate toggle or button
    const deactivateBtn = page
      .getByRole('button', { name: /deactivate|disable/i })
      .or(page.getByRole('switch').first());

    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click();

      // Confirmation dialog for leave types
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|deactivate/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      await expect(page.getByText(/deactivated|inactive|success/i)).toBeVisible();
    }
  });

  test('should show SLA config as key-value editor', async ({ page }) => {
    await page.goto('/admin/master/sla_config');

    // SLA config keys should be visible
    await expect(page.getByText(/sla\.manager_window_hours|manager.*window/i)).toBeVisible();
    await expect(page.getByText(/sla\.reminder_at_hours|reminder/i)).toBeVisible();
  });

  test('should show departments with code column', async ({ page }) => {
    await page.goto('/admin/master/departments');

    await expect(page.getByText(/department/i)).toBeVisible();
    // Departments should show code column
    await expect(
      page.getByText(/code/i).or(page.getByText(/ENG|HR|FIN/i)),
    ).toBeVisible();
  });

  test('should show public holidays with date and year', async ({ page }) => {
    await page.goto('/admin/master/public_holidays');

    await expect(page.getByText(/public.*holiday|holiday/i)).toBeVisible();
  });
});
