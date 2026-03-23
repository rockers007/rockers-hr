# Admin RBAC & Superset Capabilities

Design for admin roles, permission matrix, and the three admin-as-employee superset capabilities.

---

## Core Principle

> **Admin is a strict superset of the employee role.**

Every action available to an employee on the web/mobile frontend is also available to admin from the admin panel. Admins can register employees, view any employee's full leave details, and submit leave on behalf of any employee — all within the same business rules, all permanently recorded in the audit log.

---

## Default Admin Roles (stored in `master_admin_roles`)

| Role | Scope |
|------|-------|
| **Super Admin** | Full access. Manages all master tables, all admin users, all system config |
| **HR Manager** | Employee management, leave approvals, leave policy (`master_leave_types`), all reports |
| **Leave Admin** | `master_leave_types` configuration only; view leave data and calendar |
| **Reports Admin** | View and export all reports; read-only leave data |

---

## Permission Matrix

| Feature / Permission | Super Admin | HR Manager | Leave Admin | Reports Admin |
|---------------------|:-----------:|:----------:|:-----------:|:-------------:|
| **Master Data** | | | | |
| master_qualifications — View + Edit | ✅ | ✅ | ❌ | ❌ |
| master_genders — View + Edit | ✅ | ❌ | ❌ | ❌ |
| master_role_types — View + Edit | ✅ | ❌ | ❌ | ❌ |
| master_leave_types — View + Edit | ✅ | ✅ | ✅ | ❌ |
| master_leave_durations — View + Edit | ✅ | ❌ | ❌ | ❌ |
| master_departments — View + Edit | ✅ | ✅ | ❌ | ❌ |
| master_file_types — View + Edit | ✅ | ❌ | ❌ | ❌ |
| master_notification_templates — Edit | ✅ | ❌ | ❌ | ❌ |
| master_sla_config — Edit | ✅ | ❌ | ❌ | ❌ |
| master_public_holidays — View + Edit | ✅ | ✅ | ❌ | ❌ |
| master_admin_roles — View + Edit | ✅ | ❌ | ❌ | ❌ |
| **Employee Management** | | | | |
| Employee — View all profiles | ✅ | ✅ | 👁 Read | 👁 Read |
| Employee — Activate / Reject pending | ✅ | ✅ | ❌ | ❌ |
| Employee — Add directly (bypass OAuth) | ✅ | ✅ | ❌ | ❌ |
| Employee — Edit profile fields | ✅ | ✅ | ❌ | ❌ |
| **Leave Management** | | | | |
| Leave — View any employee's details | ✅ | ✅ | 👁 Read | 👁 Read |
| Leave — Approve / Decline (L2) | ✅ | ✅ | ❌ | ❌ |
| Leave — Submit on behalf of employee | ✅ | ✅ | ❌ | ❌ |
| Leave — Cancel on behalf of employee | ✅ | ✅ | ❌ | ❌ |
| Leave — View calendar | ✅ | ✅ | ✅ | ❌ |
| **Reports** | | | | |
| Reports — Generate / View | ✅ | ✅ | ❌ | ✅ |
| Reports — Export CSV + PDF | ✅ | ✅ | ❌ | ✅ |
| **System** | | | | |
| System — Manage admin users | ✅ | ❌ | ❌ | ❌ |
| System — View audit log | ✅ | ✅ | ❌ | ❌ |

**Legend:** ✅ Full access | 👁 Read-only | ❌ No access

---

## Permission Implementation (NestJS)

Permissions are stored as a JSONB array of permission keys in `master_admin_roles.permissions`.

```typescript
// Example permissions array
["master.leave_types.edit", "employees.view", "leave.approve", "reports.view", "reports.export"]

// NestJS guard
@UseGuards(AdminJwtGuard, PermissionsGuard)
@RequirePermissions('leave.approve')
async approveLeave(@Param('id') id: string) { ... }
```

**Permission keys catalogue:**

```
master.qualifications.edit
master.genders.edit
master.role_types.edit
master.leave_types.edit
master.leave_durations.edit
master.departments.edit
master.file_types.edit
master.notification_templates.edit
master.sla_config.edit
master.public_holidays.edit
master.admin_roles.edit

employees.view
employees.activate
employees.add_direct
employees.edit_profile

leave.view_all
leave.approve
leave.submit_on_behalf
leave.cancel_on_behalf
leave.view_calendar

reports.view
reports.export

system.manage_admins
system.view_audit_log
```

---

## Superset Capability 1 — Add / Register Employee Directly

Admin creates an employee account directly from the admin panel without requiring the employee to go through Gmail OAuth self-registration.

**Available to:** Super Admin + HR Manager only.

### Form Fields (Admin Direct Registration)

All standard self-registration fields, plus admin-only fields:

| Field | Notes |
|-------|-------|
| All standard profile fields | Name, phone, DOB, degree, gender, role type, department |
| **Gmail Address** | Admin enters the employee's `@gmail.com`. Employee uses this to log in later. |
| **Joining Date** | ✅ Required. Drives probation end date auto-calculation + leave balance proration. |
| **Reporting Manager** | Assigns `manager_id`. Dropdown shows only users where `is_manager = true AND is_active = true`. |
| **Is Manager** | Toggle — default OFF. When ON, this employee appears in the **Reporting Manager** dropdown for other employees. HR Admin controls this. Employees cannot set their own `is_manager` flag. |
| **Account Status** | `active` (immediate login) or `pending` (employee completes setup on first login) |
| **Admin Notes** | Internal notes; not visible to employee |

### What Happens on Save

1. `users` record created with `is_manager` set per the toggle
2. If `status = active`: leave balances created immediately; welcome email sent
3. If `status = pending`: welcome email sent with instructions to complete profile on first login
4. When employee logs in via Google for the first time: system recognizes the email, skips registration form, and lands on their dashboard
5. Audit log: `action: user.create`, `method: admin_direct`, `actor_id: [admin_uuid]`, `user_id: [new_user_uuid]`

---

## Superset Capability 2 — View Any Employee's Full Leave Details

Admin can open any employee's profile and see everything the employee sees on their own dashboard — read-only.

**Available to:** Super Admin + HR Manager (full). Leave Admin + Reports Admin (read-only).

### Data Visible to Admin

| Data | Description | Access |
|------|-------------|--------|
| Leave Balance | Full balance per leave type for current year (total, used, pending, remaining) | Read-only |
| Leave History | All approved, declined, cancelled leaves with dates, type, duration, submitted-by flag | Read-only |
| Pending Requests | In-progress requests with current approval stage and SLA countdown | Admin can also approve/decline from here |
| Annual Summary | Year-by-year leave usage history across all leave types | Read-only |
| Audit Trail | All admin actions taken on this employee's account | Super Admin + HR Manager only |

### UI — Admin Viewing Employee Detail

- A persistent banner: **"Viewing as Admin — [Employee Name]'s Leave Profile"**
- All data matches exactly what the employee sees on their own dashboard
- "Submit Leave on Behalf" button visible (redirects to Capability 3)

---

## Superset Capability 3 — Submit Leave on Behalf of Employee

Admin submits a leave request for any employee from the admin panel.

**Available to:** Super Admin + HR Manager only.

### Form

Identical to the standard employee leave application form, with two additions:

1. **Purple "On Behalf Of" banner** at the top: *"Submitting on behalf of: [Employee Name] — [Department]"*. Admin cannot accidentally submit under the wrong employee.
2. **Admin Notes field**: Optional. Internal only, not visible to the employee. Documents why admin submitted on behalf (e.g., "Employee called in, no mobile access").

### Business Rules — Identical to Self-Submission

- Balance is checked against the **employee's** actual balance (not the admin's)
- Sandwich leave detection runs
- Probation restrictions apply
- Document requirement applies

### Approval Workflow

- Proceeds through the normal 2-level workflow (Manager → HR)
- The **employee's assigned manager** receives the Level 1 notification
- Employee is notified of submission, approval, and any status change — exactly as if they submitted it themselves
- The request appears in the **employee's own leave history**, labelled: *"Submitted by Admin: [Admin Name]"*

### Google Calendar

If approved at Level 2, the Google Calendar event is created on the employee's Google Calendar as normal.

---

## Audit Log — On-Behalf Actions

All three superset capabilities generate distinct audit log entries that permanently identify the acting admin separately from the affected employee.

| Audit Event | Description | Key Fields |
|-------------|-------------|------------|
| `user.create (admin_direct)` | Admin created employee account directly | `actor_id`, `method: admin_direct`, `entity_id: user_id` |
| `leave.create (on_behalf)` | Admin submitted leave for employee | `actor_id`, `on_behalf_of_user_id`, `leave_request_id` |
| `leave.cancel (on_behalf)` | Admin cancelled leave for employee | `actor_id`, `on_behalf_of_user_id`, `leave_request_id` |
| `user.profile.update` | Admin edited employee profile fields | `actor_id`, `entity_id: user_id`, `before_state JSONB`, `after_state JSONB` |
| `leave.approve (admin)` | Admin approved or declined a request | `actor_id`, `leave_request_id`, `action`, `reason` |
| `user.activate` | Admin activated a pending registration | `actor_id`, `entity_id: user_id` |
| `master.*.create` | Admin created a master data record | `actor_id`, `table_name`, `entity_id`, `after_state JSONB` |
| `master.*.update` | Admin updated a master data record | `actor_id`, `table_name`, `entity_id`, `before_state JSONB`, `after_state JSONB` |
| `master.*.deactivate` | Admin deactivated a master data record | `actor_id`, `table_name`, `entity_id` |

### Audit Log Schema

```sql
audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL,                  -- Admin who performed the action
  action       TEXT NOT NULL,                  -- e.g. "leave.create"
  method       TEXT,                           -- e.g. "on_behalf", "admin_direct"
  entity_type  TEXT NOT NULL,                  -- e.g. "leave_request", "user"
  entity_id    UUID,
  on_behalf_of UUID REFERENCES users(id),      -- Set for on-behalf actions
  before_state JSONB,                          -- Previous state snapshot
  after_state  JSONB,                          -- New state snapshot
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
)
```

**Retention:** Audit log is never deleted. All records are permanent.

---

## Admin UI Structure (Next.js)

```
/admin
  /overview          Dashboard: pending approvals, employee count, SLA stats
  /registrations     Pending HR review queue
  /employees         Employee list + search + filter
  /employees/:id     Employee profile + leave details (Capability 2)
  /employees/:id/leave/new  Submit on behalf (Capability 3)
  /approvals         Pending L2 approvals
  /calendar          Team leave calendar
  /master            Master data hub (gateway to all 11 tables)
  /master/:table     CRUD interface for each master table
  /reports           Monthly / yearly / high-usage / compensation reports
  /audit-log         Audit log viewer (Super Admin + HR Manager)
  /system/admins     Admin user management (Super Admin only)
```

All `/admin/*` routes protected by `AdminJwtGuard`. Permission-based route visibility controlled by the JSONB permissions on the admin's role.
