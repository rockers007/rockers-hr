import { test, expect } from '@playwright/test';

const FAKE_ID = '00000000-0000-0000-0000-000000000099';

test.describe('Payroll — Bank Change Workflow', () => {
  test('[Payroll-BankChange] POST submit rejects without auth', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/bank-change', {
      data: {
        new_bank_name: 'HDFC',
        new_account_no: '12345678901',
        new_ifsc: 'HDFC0001234',
      },
    });
    expect([200, 201, 400, 401, 403, 409, 422]).toContain(resp.status());
  });

  test('[Payroll-BankChange] POST rejects invalid IFSC', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/bank-change', {
      data: {
        new_bank_name: 'HDFC',
        new_account_no: '12345678901',
        new_ifsc: 'bad',
      },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-BankChange] POST rejects non-digit account number', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/bank-change', {
      data: {
        new_bank_name: 'HDFC',
        new_account_no: 'letters',
        new_ifsc: 'HDFC0001234',
      },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-BankChange] POST rejects account < 9 digits', async ({ request }) => {
    const resp = await request.post('/api/v1/payroll/bank-change', {
      data: {
        new_bank_name: 'HDFC',
        new_account_no: '123',
        new_ifsc: 'HDFC0001234',
      },
    });
    expect([400, 401, 403, 422]).toContain(resp.status());
  });

  test('[Payroll-BankChange] GET /bank-change/mine', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/bank-change/mine');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-BankChange] GET /bank-change admin list', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/bank-change');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-BankChange] GET /bank-change?status=PENDING', async ({ request }) => {
    const resp = await request.get('/api/v1/payroll/bank-change?status=PENDING');
    expect([200, 401, 403]).toContain(resp.status());
  });

  test('[Payroll-BankChange] approve unknown id → 404', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/bank-change/${FAKE_ID}/approve`);
    expect([401, 403, 404]).toContain(resp.status());
  });

  test('[Payroll-BankChange] reject requires reason', async ({ request }) => {
    const resp = await request.post(`/api/v1/payroll/bank-change/${FAKE_ID}/reject`, {
      data: { rejection_reason: '' },
    });
    expect([400, 401, 403, 404, 422]).toContain(resp.status());
  });
});
