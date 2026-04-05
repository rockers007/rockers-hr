// User types
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: { id: string; label: string } | null;
  photo_url: string | null;
  manager: { id: string; name: string } | null;
  join_date: string;
  confirmation_date: string | null;
  is_in_probation: boolean;
  is_manager: boolean;
  resignation_date: string | null;
  last_working_day: string | null;
  employment_status: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  admin_role_id: string;
  is_admin: true;
}

// Master data types
export interface MasterRecord {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface LeaveType extends MasterRecord {
  annual_days: number;
  probation_allowed: boolean;
  doc_required: boolean;
  doc_threshold_days: number | null;
  carry_over: number;
  color: string;
  system_key?: string;
  unit?: string; // 'days' | 'hours'
  accrual_type?: string;
  min_tenure_months?: number;
  max_days_per_request?: number;
  min_advance_days?: number;
  requires_doc_for_future?: boolean;
}

export interface SlaConfigRecord {
  config_key: string;
  config_value: string;
  description: string;
}

// Leave types
export type LeaveStatus = 'PENDING_L1' | 'PENDING_L2' | 'APPROVED' | 'DECLINED' | 'ESCALATED' | 'CANCELLED';

export interface LeaveBalance {
  leave_type: { id: string; label: string; color: string };
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

export interface LeaveApproval {
  level: number;
  approver: { name: string };
  action: 'approved' | 'declined' | null;
  actioned_at: string | null;
  reason?: string;
  sla_deadline?: string;
  sla_elapsed_business_hours?: number;
}

export interface LeaveRequest {
  id: string;
  leave_type: { id: string; label: string; color: string };
  duration_type: { label: string; day_value: number };
  start_date: string;
  end_date: string;
  working_days: number;
  status: LeaveStatus;
  reason: string;
  sandwich_flag: boolean;
  submitted_by_admin: { name: string } | null;
  can_cancel: boolean;
  approvals: LeaveApproval[];
  created_at: string;
}

// Notification
export interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  leave_request_id: string | null;
  created_at: string;
}
