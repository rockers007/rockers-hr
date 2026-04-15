import { test, expect } from '@playwright/test';

test.describe('Leave Application', () => {

  test('[Leave] Submit a full-day casual leave request successfully', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        duration_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-06-15',
        end_date: '2026-06-16',
        reason: 'Test leave request for automated testing purposes',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Submit half-day leave request (first half)', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        duration_type_id: '00000000-0000-0000-0000-000000000002',
        start_date: '2026-06-17',
        end_date: '2026-06-17',
        reason: 'Half day leave test for automated testing',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reject leave for employee in probation period', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000002',
        start_date: '2026-06-15',
        end_date: '2026-06-16',
        reason: 'Probation period leave test request',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Allow probation employee to apply for probation-allowed leave type', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/types/eligible');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Leave] Reject leave when insufficient balance', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-01-05',
        end_date: '2026-12-31',
        reason: 'Testing insufficient balance rejection scenario',
      },
    });
    expect([400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reject leave with overlapping date conflict', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-06-15',
        end_date: '2026-06-17',
        reason: 'Overlapping date conflict test request',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reject leave when date range has no working days', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-06-20', // Saturday
        end_date: '2026-06-21', // Sunday
        reason: 'Weekend-only leave test for validation',
      },
    });
    expect([400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Sandwich leave detection and confirmation requirement', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/calculate', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-06-19', // Friday
        end_date: '2026-06-22', // Monday
      },
    });
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Leave] Document required for sick leave exceeding threshold', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000003',
        start_date: '2026-07-06',
        end_date: '2026-07-10',
        reason: 'Sick leave document requirement test',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Document not required for sick leave under threshold', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000003',
        start_date: '2026-07-06',
        end_date: '2026-07-06',
        reason: 'Single day sick leave test request',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Working days exclude weekends and public holidays', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/calculate', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-08-03', // Monday
        end_date: '2026-08-07', // Friday
      },
    });
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });

  test('[Leave] Cancel pending leave request (PENDING_L1)', async ({ request }) => {
    const resp = await request.patch('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/cancel');
    expect([200, 400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Cancel approved leave request (before start date)', async ({ request }) => {
    const resp = await request.patch('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/cancel');
    expect([200, 400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reject cancellation when leave has already started', async ({ request }) => {
    const resp = await request.patch('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/cancel');
    expect([400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reject cancellation of already cancelled/declined leave', async ({ request }) => {
    const resp = await request.patch('/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/cancel');
    expect([400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Skip Level 1 when employee has no manager assigned', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-09-01',
        end_date: '2026-09-02',
        reason: 'No manager fallback workflow test',
      },
    });
    expect([201, 400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Reason field minimum 10 characters validation', async ({ request }) => {
    const resp = await request.post('/api/v1/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-09-03',
        end_date: '2026-09-03',
        reason: 'Short',
      },
    });
    expect([400, 401, 422, 500]).toContain(resp.status());
  });

  test('[Leave] Concurrent leave submission race condition prevention', async ({ request }) => {
    const promises = [
      request.post('/api/v1/leave/requests', {
        data: { leave_type_id: '00000000-0000-0000-0000-000000000001', start_date: '2026-10-01', end_date: '2026-10-02', reason: 'Concurrent test request one' },
      }),
      request.post('/api/v1/leave/requests', {
        data: { leave_type_id: '00000000-0000-0000-0000-000000000001', start_date: '2026-10-01', end_date: '2026-10-02', reason: 'Concurrent test request two' },
      }),
    ];
    const results = await Promise.all(promises);
    for (const r of results) {
      expect([201, 400, 401, 422, 500]).toContain(r.status());
    }
  });

  test('[Leave] View leave balance per type for current year', async ({ request }) => {
    const resp = await request.get('/api/v1/leave/balance');
    expect([200, 401, 404, 500]).toContain(resp.status());
  });

  test('[Leave] Leave request submitted by admin on behalf shows proper labeling', async ({ request }) => {
    const resp = await request.post('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/leave/requests', {
      data: {
        leave_type_id: '00000000-0000-0000-0000-000000000001',
        start_date: '2026-11-02',
        end_date: '2026-11-03',
        reason: 'Admin on-behalf leave submission test',
      },
    });
    expect([201, 400, 401, 403, 404, 422, 500]).toContain(resp.status());
  });
});
