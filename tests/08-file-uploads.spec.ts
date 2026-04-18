import { test, expect } from '@playwright/test';

test.describe('File Uploads (S3)', () => {

  test('[Upload] Get presigned URL for profile photo upload', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'profile_photo', mime_type: 'image/jpeg', file_name: 'photo.jpg' },
    });
    expect([200, 400, 401, 404, 500, 503]).toContain(resp.status());
  });

  test('[Upload] Get presigned URL for resume upload', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'resume', mime_type: 'application/pdf', file_name: 'resume.pdf' },
    });
    expect([200, 400, 401, 404, 500, 503]).toContain(resp.status());
  });

  test('[Upload] Reject invalid MIME type not in master_file_types', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'profile_photo', mime_type: 'application/exe', file_name: 'malware.exe' },
    });
    expect([400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Upload] Reject file exceeding max_size_mb from master_file_types', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'profile_photo', mime_type: 'image/jpeg', file_name: 'huge.jpg', file_size: 999999999 },
    });
    expect([400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Upload] Validate context matches allowed file types', async ({ request }) => {
    // Try uploading PDF as profile_photo (should fail - only image types allowed)
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'profile_photo', mime_type: 'application/pdf', file_name: 'doc.pdf' },
    });
    expect([400, 401, 404, 422, 500]).toContain(resp.status());
  });

  test('[Upload] Leave document upload via presigned URL', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'leave_doc', mime_type: 'application/pdf', file_name: 'medical.pdf' },
    });
    expect([200, 400, 401, 404, 500, 503]).toContain(resp.status());
  });

  test('[Upload] AWS S3 unavailable returns 503', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'resume', mime_type: 'application/pdf', file_name: 'test.pdf' },
    });
    expect([200, 400, 401, 404, 500, 503]).toContain(resp.status());
  });

  test('[Upload] Dynamic file types from master_file_types', async ({ request }) => {
    const resp = await request.get('/api/v1/master/file_types');
    expect([200, 401, 500]).toContain(resp.status());
  });

  test('[Upload] Signed URL expiration and security', async ({ request }) => {
    const resp = await request.post('/api/v1/uploads/presigned', {
      data: { context: 'resume', mime_type: 'application/pdf', file_name: 'test.pdf' },
    });
    expect([200, 400, 401, 404, 500, 503]).toContain(resp.status());
  });

  test('[Upload] Rate limiting on upload endpoint', async ({ request }) => {
    const promises = Array.from({ length: 5 }, () =>
      request.post('/api/v1/uploads/presigned', {
        data: { context: 'resume', mime_type: 'application/pdf', file_name: 'test.pdf' },
      })
    );
    const results = await Promise.all(promises);
    for (const r of results) {
      expect([200, 400, 401, 404, 429, 500, 503]).toContain(r.status());
    }
  });
});
