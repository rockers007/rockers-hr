import { APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

/**
 * API helper for seeding test data and performing backend operations.
 * Each test uses this to create its own isolated data and clean up afterwards.
 */
export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  // ─── Auth ───────────────────────────────────────────────────────────

  /** Log in as an admin and return the JWT token */
  async adminLogin(
    email = 'superadmin@rockershr.com',
    password = process.env.TEST_ADMIN_PASSWORD || 'Admin@1234',
  ): Promise<string> {
    const res = await this.request.post(`${API_BASE}/admin/auth/login`, {
      data: { email, password },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Admin login failed: ${JSON.stringify(body)}`);
    return body.data.token;
  }

  /** Get auth headers for admin requests */
  async adminHeaders(): Promise<Record<string, string>> {
    const token = await this.adminLogin();
    return { Authorization: `Bearer ${token}` };
  }

  // ─── Users ──────────────────────────────────────────────────────────

  /** Create an employee via admin direct registration */
  async createEmployee(
    adminToken: string,
    overrides: Partial<{
      gmail: string;
      name: string;
      phone: string;
      dob: string;
      qualification_id: string;
      gender_id: string;
      role_type_id: string;
      department_id: string;
      manager_id: string;
      is_manager: boolean;
      join_date: string;
      account_status: string;
    }> = {},
  ) {
    const uniqueSuffix = Date.now() + Math.random().toString(36).slice(2, 6);
    const defaults = {
      gmail: `testuser-${uniqueSuffix}@gmail.com`,
      name: `Test User ${uniqueSuffix}`,
      phone: '9876543210',
      dob: '1995-01-15',
      join_date: '2025-01-01',
      account_status: 'active',
      is_manager: false,
    };

    const data = { ...defaults, ...overrides };

    // If no master data IDs provided, fetch them
    if (!data.qualification_id || !data.gender_id || !data.role_type_id) {
      const masterData = await this.fetchMasterIds(adminToken);
      if (!data.qualification_id) data.qualification_id = masterData.qualification_id;
      if (!data.gender_id) data.gender_id = masterData.gender_id;
      if (!data.role_type_id) data.role_type_id = masterData.role_type_id;
      if (!data.department_id) data.department_id = masterData.department_id;
    }

    const res = await this.request.post(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data,
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Create employee failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  /** Create a manager employee */
  async createManager(adminToken: string, overrides: Record<string, unknown> = {}) {
    const masterData = await this.fetchMasterIds(adminToken);
    return this.createEmployee(adminToken, {
      is_manager: true,
      role_type_id: masterData.manager_role_type_id,
      ...overrides,
    });
  }

  // ─── Leave ──────────────────────────────────────────────────────────

  /** Create a leave request via admin on-behalf */
  async createLeaveRequest(
    adminToken: string,
    userId: string,
    overrides: Partial<{
      leave_type_id: string;
      duration_type_id: string;
      start_date: string;
      end_date: string;
      reason: string;
    }> = {},
  ) {
    const masterData = await this.fetchMasterIds(adminToken);
    const futureDate = this.futureWorkday(14);
    const data = {
      leave_type_id: masterData.leave_type_id,
      duration_type_id: masterData.duration_type_id,
      start_date: futureDate,
      end_date: futureDate,
      reason: 'E2E test leave request - automated testing',
      ...overrides,
    };

    const res = await this.request.post(`${API_BASE}/admin/users/${userId}/leave/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { ...data, admin_notes: 'Created by E2E test' },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Create leave request failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  /** Approve a leave request at the given level */
  async approveLeave(token: string, requestId: string, level: 1 | 2) {
    const endpoint =
      level === 1
        ? `${API_BASE}/manager/approvals/${requestId}/approve`
        : `${API_BASE}/admin/approvals/${requestId}/approve`;
    const res = await this.request.post(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Approve leave L${level} failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  // ─── Master Data ────────────────────────────────────────────────────

  /** Fetch first active record IDs for common master tables */
  async fetchMasterIds(token: string) {
    const headers = { Authorization: `Bearer ${token}` };
    const [qualifications, genders, roleTypes, departments, leaveTypes, leaveDurations] =
      await Promise.all([
        this.request.get(`${API_BASE}/master/qualifications`, { headers }).then((r) => r.json()),
        this.request.get(`${API_BASE}/master/genders`, { headers }).then((r) => r.json()),
        this.request.get(`${API_BASE}/master/role_types`, { headers }).then((r) => r.json()),
        this.request.get(`${API_BASE}/master/departments`, { headers }).then((r) => r.json()),
        this.request.get(`${API_BASE}/master/leave_types`, { headers }).then((r) => r.json()),
        this.request.get(`${API_BASE}/master/leave_durations`, { headers }).then((r) => r.json()),
      ]);

    const employeeRole = roleTypes.data?.find(
      (r: { system_key?: string }) => r.system_key === 'employee',
    );
    const managerRole = roleTypes.data?.find(
      (r: { system_key?: string }) => r.system_key === 'manager',
    );

    return {
      qualification_id: qualifications.data?.[0]?.id,
      gender_id: genders.data?.[0]?.id,
      role_type_id: employeeRole?.id || roleTypes.data?.[0]?.id,
      manager_role_type_id: managerRole?.id || roleTypes.data?.[0]?.id,
      department_id: departments.data?.[0]?.id,
      leave_type_id: leaveTypes.data?.[0]?.id,
      duration_type_id: leaveDurations.data?.[0]?.id,
    };
  }

  /** Create a master data record */
  async createMasterRecord(adminToken: string, table: string, data: Record<string, unknown>) {
    const res = await this.request.post(`${API_BASE}/master/${table}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data,
    });
    const body = await res.json();
    if (!res.ok())
      throw new Error(`Create master record (${table}) failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  /** Update a master data record */
  async updateMasterRecord(
    adminToken: string,
    table: string,
    id: string,
    data: Record<string, unknown>,
  ) {
    const res = await this.request.patch(`${API_BASE}/master/${table}/${id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data,
    });
    const body = await res.json();
    if (!res.ok())
      throw new Error(`Update master record (${table}/${id}) failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  // ─── Notifications ──────────────────────────────────────────────────

  /** Get notifications for a user */
  async getNotifications(token: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request.get(`${API_BASE}/notifications?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Get notifications failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  // ─── Reports ────────────────────────────────────────────────────────

  async getMonthlyReport(adminToken: string, month: number, year: number) {
    const res = await this.request.get(
      `${API_BASE}/admin/reports/monthly?month=${month}&year=${year}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const body = await res.json();
    if (!res.ok()) throw new Error(`Get monthly report failed: ${JSON.stringify(body)}`);
    return body.data;
  }

  // ─── Utilities ──────────────────────────────────────────────────────

  /** Get a future working day (skips weekends) as YYYY-MM-DD */
  futureWorkday(daysAhead: number): string {
    const date = new Date();
    let added = 0;
    while (added < daysAhead) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return date.toISOString().split('T')[0];
  }
}
