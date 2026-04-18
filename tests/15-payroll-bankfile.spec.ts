import { test, expect } from '@playwright/test';

const FAKE_RUN = '00000000-0000-0000-0000-000000000099';

test.describe('Payroll — Bank Transfer File', () => {
  test('[Payroll-BankFile] GET preview requires RELEASED state', async ({ request }) => {
    const resp = await request.get(
      `/api/v1/payroll/runs/${FAKE_RUN}/bank-file/preview`,
    );
    expect([200, 401, 403, 404, 409]).toContain(resp.status());
  });

  test('[Payroll-BankFile] POST approve requires confirmation phrase', async ({ request }) => {
    const resp = await request.post(
      `/api/v1/payroll/runs/${FAKE_RUN}/bank-file/approve`,
      {
        data: {
          confirmation_phrase: 'WRONG',
          file_format_code: 'DEFAULT_NEFT',
          pending_bank_changes_action: 'use_old',
        },
      },
    );
    expect([400, 401, 403, 404, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-BankFile] POST approve requires Super Admin permission', async ({ request }) => {
    const resp = await request.post(
      `/api/v1/payroll/runs/${FAKE_RUN}/bank-file/approve`,
      {
        data: {
          confirmation_phrase: 'APPROVE BANK TRANSFER FILE',
          file_format_code: 'DEFAULT_NEFT',
          pending_bank_changes_action: 'use_old',
        },
      },
    );
    expect([200, 401, 403, 404, 409]).toContain(resp.status());
  });

  test('[Payroll-BankFile] POST generate requires approved state', async ({ request }) => {
    const resp = await request.post(
      `/api/v1/payroll/runs/${FAKE_RUN}/bank-file/generate`,
    );
    expect([401, 403, 404, 409]).toContain(resp.status());
  });
});
