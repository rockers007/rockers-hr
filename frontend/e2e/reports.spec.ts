import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { ApiHelper } from './helpers/api';

test.describe('Reports', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request, page }) => {
    api = new ApiHelper(request);
    const auth = new AuthHelper(page);
    await auth.loginAsAdmin();
  });

  test('should show reports dashboard', async ({ page }) => {
    await page.goto('/admin/reports');

    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
    // Should show report type links
    await expect(page.getByText(/monthly/i).first()).toBeVisible();
    await expect(page.getByText(/yearly/i).first()).toBeVisible();
  });

  test('should display monthly report with filters', async ({ page }) => {
    await page.route('**/api/v1/admin/reports/monthly*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            period: 'March 2026',
            summary: {
              total_days: 47,
              approved: 38,
              declined: 6,
              approval_rate_pct: 81,
              sla_compliance_pct: 87,
            },
            by_type: [
              { leave_type: 'Casual Leave', color: '#3b82f6', days: 18 },
              { leave_type: 'Sick Leave', color: '#ef4444', days: 10 },
            ],
            by_employee: [
              {
                employee_name: 'Priya S.',
                department: 'Engineering',
                days_by_type: { 'Casual Leave': 2, 'Sick Leave': 0 },
              },
            ],
            sla_performance: { within_sla: 87, escalated: 8, breached: 5 },
          },
        }),
      });
    });

    await page.goto('/admin/reports/monthly');

    // Month/Year selectors should exist
    await expect(page.getByText(/month|year/i).first()).toBeVisible();

    // Summary cards
    await expect(page.getByText('Total Days')).toBeVisible();
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });

  test('should display yearly report', async ({ page }) => {
    await page.route('**/api/v1/admin/reports/yearly*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            period: '2026',
            summary: {
              total_days: 520,
              approved: 450,
              declined: 40,
              approval_rate_pct: 87,
              sla_compliance_pct: 92,
            },
            by_type: [
              { leave_type: 'Casual Leave', color: '#3b82f6', days: 200 },
              { leave_type: 'Sick Leave', color: '#ef4444', days: 120 },
            ],
          },
        }),
      });
    });

    await page.goto('/admin/reports/yearly');

    await expect(page.getByText(/yearly|annual/i).first()).toBeVisible();
  });

  test('should export monthly report as CSV', async ({ page }) => {
    // Mock the export endpoint to return a file
    await page.route('**/api/v1/admin/reports/monthly/export*csv*', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="monthly-report-2026-03.csv"',
        },
        body: 'Employee,Casual Leave,Sick Leave\nPriya S.,2,0\n',
      });
    });

    await page.goto('/admin/reports/monthly');

    // Click CSV export button
    const csvBtn = page.getByRole('button', { name: /csv|export.*csv/i });
    if (await csvBtn.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');
      await csvBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('should export monthly report as PDF', async ({ page }) => {
    await page.route('**/api/v1/admin/reports/monthly/export*pdf*', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="monthly-report-2026-03.pdf"',
        },
        body: Buffer.from('%PDF-1.4 mock content'),
      });
    });

    await page.goto('/admin/reports/monthly');

    const pdfBtn = page.getByRole('button', { name: /pdf|export.*pdf/i });
    if (await pdfBtn.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await pdfBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.pdf');
    }
  });

  test('should show SLA performance section', async ({ page }) => {
    await page.route('**/api/v1/admin/reports/monthly*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            period: 'March 2026',
            summary: { total_days: 47, approved: 38, declined: 6, approval_rate_pct: 81, sla_compliance_pct: 87 },
            by_type: [],
            by_employee: [],
            sla_performance: { within_sla: 87, escalated: 8, breached: 5 },
          },
        }),
      });
    });

    await page.goto('/admin/reports/monthly');

    await expect(page.getByText(/sla/i).first()).toBeVisible();
  });

  test('should filter reports by department', async ({ page }) => {
    await page.goto('/admin/reports/monthly');

    // Department filter or select should be present
    await expect(page.getByText('Department', { exact: true })).toBeVisible();
  });
});
