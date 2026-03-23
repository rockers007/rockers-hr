# Leave Application & Approval Workflow

Design for leave application, two-level approval, SLA enforcement, balance management, and calendar integration.

---

## Overview

```
Employee submits leave request
          │
          ▼
    [Validation Layer]
    Balance check · Probation check · Date conflict check · Sandwich detection
          │
          ▼
    Status: PENDING_L1
          │
          ▼
    Manager notified (Level 1 — SLA starts)
          │
     ┌────┴────┐
     │         │
  Approve    Decline
     │         │
     ▼         ▼
PENDING_L2  DECLINED
     │
     ▼
HR Final Approval (Level 2)
     │
  ┌──┴──┐
  │     │
Approve Decline
  │     │
  ▼     ▼
APPROVED DECLINED
  │
  ▼
Google Calendar event created
Employee notified: "Fully Approved"

ESCALATED
     │
  ┌──┴──┐
  │     │
Approve Decline
  │     │
  ▼     ▼
APPROVED DECLINED
```

**Key constraints:**
- No carry-over for any leave type. Unused days expire December 31.
- Working days exclude weekends + all `master_public_holidays` for the year.
- Probation period blocks all leave (unless `probation_allowed = true` on the leave type).
- Sandwich leave auto-detected and flagged — employee must confirm before submitting.

---

## Leave Request States

| Status | Description |
|--------|-------------|
| `PENDING_L1` | Submitted; awaiting manager approval |
| `PENDING_L2` | Manager approved; awaiting HR approval |
| `APPROVED` | HR approved; Google Calendar event created |
| `DECLINED` | Declined at either level; reason required |
| `CANCELLED` | Employee cancelled before the leave start date. Allowed from any state. |
| `ESCALATED` | Manager SLA breached; auto-escalated to HR. Transitions to APPROVED or DECLINED when HR acts on it. |

---

## Leave Application Form

### Step 1 — Type & Dates

All dropdowns populated from master tables. No hardcoded values.

```
GET /api/v1/master/leave_types         → Leave type selector (filtered: active + probation check)
GET /api/v1/master/leave_durations     → Duration type (Full Day, First Half, Second Half)
```

| Field | Source | Notes |
|-------|--------|-------|
| Leave Type | `master_leave_types` | Filters out inactive + probation-blocked types if employee is in probation |
| Duration Type | `master_leave_durations` | `day_value` drives balance deduction |
| From Date | Date picker | Excludes past dates |
| To Date | Date picker | Must be ≥ From Date |
| Working Days Calculated | Backend | Excludes weekends + `master_public_holidays` |

### Step 2 — Reason & Document

| Field | Required | Notes |
|-------|----------|-------|
| Reason | ✅ | Free text; minimum 10 characters |
| Supporting Document | Conditional | Required if `doc_required = true` AND `working_days ≥ doc_threshold_days` on the selected leave type |

**Document upload:** Same flow as registration uploads. MIME types from `master_file_types` with context `leave_doc`.

### Step 3 — Review & Submit

Shows a summary: leave type, dates, working days, approval path, balance preview (current → after this request).

---

## Validation Rules (Backend — NestJS)

All validation runs on the backend. Frontend shows the same errors for UX, but backend is the source of truth.

### 1. Probation Check

```
If today < (user.join_date + probation.duration_months months from master_sla_config)
  AND leave_type.probation_allowed = false
→ Reject with: "You are in a probation period and cannot apply for this leave type."
```

### 2. Balance Check

```
available_days = leave_balance.total_days - leave_balance.used_days - leave_balance.pending_days
requested_days = sum of day_value for each working day in the range

If requested_days > available_days
→ Reject with: "Insufficient leave balance. You have {available_days} days available."
```

### 3. Date Conflict Check

```
If any existing leave_request for this user overlaps the requested date range
  AND status IN (PENDING_L1, PENDING_L2, APPROVED)
→ Reject with: "You already have a leave request for overlapping dates."
```

### 4. Working Days Calculation

```
working_days = 0
for each date in [start_date .. end_date]:
  if date is not Saturday or Sunday:
    if date is not in master_public_holidays for this year:
      working_days += duration_type.day_value
```

If `working_days = 0` (e.g., entire range falls on weekends/holidays):
→ Reject with: "No working days in the selected range."

### 5. Sandwich Leave Detection

Sandwich leave occurs when a leave request spans a weekend (or public holiday) that falls between two working days, effectively making the weekend part of the leave period.

**Detection logic:**
```
If start_date is a Monday (or day after a holiday):
  look back to the preceding Friday (or working day)
  if that gap contains only weekends/holidays and the employee has leave on both sides:
    flag as sandwich leave

If end_date is a Friday (or day before a holiday):
  look ahead to the following Monday (or next working day)
  apply same logic
```

When sandwich leave is detected:
- Frontend shows a warning banner: *"Sandwich leave detected: your leave spans [weekend/holiday]. As per company policy, these days may be counted as part of your leave. Please confirm before submitting."*
- Employee must explicitly confirm (checkbox) before submitting.
- The leave request is saved with `sandwich_flag = true`.
- HR Admin sees the flag on the pending approval.

### 6. Document Requirement Check

```
If leave_type.doc_required = true
  AND working_days >= leave_type.doc_threshold_days
  AND no document uploaded
→ Reject with: "A supporting document is required for {leave_type} of {threshold}+ days."
```

---

## Approval Workflow — Level 1 (Manager)

**SLA window:** `sla.manager_window_hours` from `master_sla_config` (default: 5 hours) — **measured in business hours** (`sla.clock_type = business`).

**Business hours definition:**
- Monday–Friday only
- `sla.business_hours_start` → `09:00` (from `master_sla_config`)
- `sla.business_hours_end` → `18:00` (from `master_sla_config`)
- Public holidays excluded (from `master_public_holidays`)

**Example:** A request submitted Friday at 5:00 PM has consumed 1 business hour by end of day. The remaining 4 business hours resume Monday at 9:00 AM — SLA deadline is Monday at 1:00 PM.

**Reminder at:** `sla.reminder_at_hours` (default: 4 business hours)

**Fallback — no manager assigned:** If `user.manager_id IS NULL`, the request skips Level 1 entirely. It is created directly with `status = PENDING_L2` and HR Admin receives the Level 1 notification as the first approver. No SLA reminder is sent for Level 1 in this case.

**Scope enforcement:** The backend validates that the approver (`leave_approvals.approver_id`) matches `user.manager_id` for Level 1 approvals. This is enforced in application code (NestJS guard), not as a database constraint.

**On submission:**
1. `leave_requests` record created
   - If `user.manager_id IS NOT NULL`: `status = PENDING_L1`
   - If `user.manager_id IS NULL`: `status = PENDING_L2` (skip straight to HR)
2. `leave_approvals` record created: `level = 1` (or `level = 2` for no-manager case), `sla_deadline` computed in business hours
3. `leave_balances.pending_days += requested_days`
4. Notification sent to manager (or HR if no manager): `leave.submitted` template
5. Notification sent to employee: confirmation that request is submitted

**On manager approve:**
1. `leave_approvals.action = approved`, `actioned_at = now()`
2. `leave_requests.status = PENDING_L2`
3. New `leave_approvals` record: `level = 2`, HR as approver
4. Notification to employee: `leave.approved.l1`
5. Notification to HR: request awaiting final approval

**On manager decline:**
1. `leave_approvals.action = declined`, `reason` required
2. `leave_requests.status = DECLINED`
3. `leave_balances.pending_days -= requested_days` (released back)
4. Notification to employee: `leave.declined` with reason

---

## SLA Enforcement

The SLA engine runs as a **NestJS scheduled job** (`@nestjs/schedule`) every minute.

**Job logic:**
```
For each leave_approval where:
  level = 1
  action IS NULL (not yet actioned)
  escalated = false

  elapsed = now() - leave_request.created_at

  If elapsed >= sla.reminder_at_hours AND reminder_sent = false:
    Send reminder to manager: sla.reminder template
    Set reminder_sent = true

  If elapsed >= sla.manager_window_hours:
    Set leave_approvals.escalated = true, escalated_at = now()
    Set leave_requests.status = ESCALATED
    Create level-2 approval record directed to HR (bypassing manager)
    Notify HR: sla.escalated template
    Notify employee: "Your request has been escalated to HR"
```

**Fallback approver:** If the employee has no assigned manager (`manager_id IS NULL`), the request skips Level 1 entirely — created directly as `PENDING_L2` and HR Admin receives the first notification. See SLA section above.

---

## Approval Workflow — Level 2 (HR Final)

**On HR approve:**
1. `leave_approvals.action = approved` (level 2)
2. `leave_requests.status = APPROVED`
3. `leave_balances.used_days += requested_days`
4. `leave_balances.pending_days -= requested_days`
5. Google Calendar event created (see Calendar Integration below)
6. Notification to employee: `leave.approved.l2`

**On HR decline:**
1. `leave_approvals.action = declined`, `reason` required
2. `leave_requests.status = DECLINED`
3. `leave_balances.pending_days -= requested_days`
4. Notification to employee: `leave.declined` with reason

---

## Google Calendar Integration

**Triggered at Level 2 (HR final approval) only.** Not triggered at manager approval.

**Scopes required:** `https://www.googleapis.com/auth/calendar.events`

**Event creation:**
```json
{
  "summary": "[Casual Leave] Priya Sharma",         // from master_sla_config: calendar.event_title_format
  "start": { "date": "2025-06-15" },
  "end":   { "date": "2025-06-17" },                // Google Calendar end is exclusive; +1 day
  "description": "Leave approved via Rockers HR. Type: Casual Leave. Duration: 2 working days.",
  "attendees": [{ "email": "priya@gmail.com" }]
}
```

The event is created on the HR team's shared Google Calendar, not on the employee's personal calendar. The employee is added as an attendee so they receive the calendar invite.

**Stored:** `leave_requests.calendar_event_id` for potential future cancellation.

---

## Balance Management

### Structure

```sql
leave_balances (
  id, user_id, leave_type_id, year,
  total_days,    -- Annual allocation (prorated on join)
  used_days,     -- Days in APPROVED requests
  pending_days   -- Days in PENDING_L1 or PENDING_L2 requests
)
```

**Available = total_days - used_days - pending_days**

### Concurrency — Row-Level Locking

All balance mutations (leave submission, approval, cancellation, year-end reset) must use `SELECT FOR UPDATE` on the `leave_balances` row within a single transaction to prevent race conditions.

**Pattern for all balance-mutating operations:**
```sql
BEGIN;
SELECT * FROM leave_balances
WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
FOR UPDATE;
-- validate available balance
-- update pending_days or used_days
COMMIT;
```

This prevents two concurrent requests (e.g., simultaneous leave submission + SLA escalation, or cancellation + approval) from reading stale balance values. The second transaction will block until the first commits.

**Applies to:**
- Leave submission: `pending_days += working_days`
- L2 approval: `used_days += working_days`, `pending_days -= working_days`
- Decline/cancel from PENDING: `pending_days -= working_days`
- Cancel from APPROVED: `used_days -= working_days`
- Year-end reset: `used_days = 0`, `pending_days = 0`

### Year-End Reset

On January 1 each year, a scheduled job:
1. Sets `used_days = 0`, `pending_days = 0` for all `leave_balances` records for the ending year
2. Creates new `leave_balances` rows for the new year for all active employees + all active leave types
3. `total_days` = `master_leave_types.annual_days` (no proration for existing employees, full allocation)

**Expiry reminder:** December `balance.expiry_reminder_day` (default 20th), send `balance.expiry` notification to any employee with unused days > 0.

### Balance Display

Employee sees per leave type:
- Total allocation for year
- Used (in approved leaves)
- Pending (in pending requests)
- Available (total - used - pending)

---

## Leave Cancellation

**Policy (confirmed):** Employees can cancel any leave — PENDING or APPROVED — as long as `start_date > today`. No admin approval step.

### Cancellation Rules

| From State | Allowed? | Condition |
|------------|----------|-----------|
| `PENDING_L1` | ✅ | Always (start_date check irrelevant — not yet approved) |
| `PENDING_L2` | ✅ | Always |
| `APPROVED` | ✅ | Only if `start_date > today` |
| Any state where `start_date <= today` | ❌ | Leave has started or passed; cancel button hidden |

### On Cancellation

1. `leave_requests.status = CANCELLED`, `updated_at = now()`
2. Balance restored:
   - If was `PENDING_L1` or `PENDING_L2`: `leave_balances.pending_days -= working_days`
   - If was `APPROVED`: `leave_balances.used_days -= working_days`
3. If was `APPROVED` and `calendar_event_id IS NOT NULL`: Google Calendar event deleted via API
4. Notification to employee: "Your [Leave Type] request for [dates] has been cancelled."
5. Notification to manager/HR (if was PENDING): "Employee has cancelled their [Leave Type] request."
6. Audit log: `action: leave.cancel`, `actor_id: user_id`, `leave_request_id`

**A cancelled leave cannot be reinstated.** Employee must submit a fresh request.

## Leave History (Employee View)

Employee can see all their leave requests with:
- Leave type, dates, duration, working days
- Submission date
- Current status + approval history (who approved/declined at each level, with timestamps)
- If submitted by admin: labelled "Submitted by Admin: [Admin Name]"
- Reason for any decline

**Cancellation:** Available if `start_date > today`. See Leave Cancellation section above.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/leave/types/eligible` | JWT | Returns leave types eligible for current user (probation filter applied) |
| POST | `/api/v1/leave/calculate` | JWT | Calculates working days and sandwich flag for a date range |
| POST | `/api/v1/leave/requests` | JWT | Submit a leave request |
| GET | `/api/v1/leave/requests` | JWT | List own leave requests (paginated) |
| GET | `/api/v1/leave/requests/:id` | JWT | Get single leave request with full approval history |
| PATCH | `/api/v1/leave/requests/:id/cancel` | JWT | Cancel own request — allowed if start_date > today |
| GET | `/api/v1/leave/balance` | JWT | Get own leave balances for current year |
| GET | `/api/v1/leave/balance/:year` | JWT | Get own leave balances for a specific year |
| GET | `/api/v1/manager/approvals/pending` | Manager JWT | List pending L1 approvals for team |
| POST | `/api/v1/manager/approvals/:id/approve` | Manager JWT | Approve at Level 1 |
| POST | `/api/v1/manager/approvals/:id/decline` | Manager JWT | Decline at Level 1 (reason required) |
| GET | `/api/v1/admin/approvals/pending` | Admin JWT | List pending L2 approvals for HR |
| POST | `/api/v1/admin/approvals/:id/approve` | Admin JWT | Approve at Level 2 |
| POST | `/api/v1/admin/approvals/:id/decline` | Admin JWT | Decline at Level 2 (reason required) |
| GET | `/api/v1/admin/leave/requests` | Admin JWT | View all leave requests (filterable by user, type, status, date) |
| POST | `/api/v1/admin/leave/requests` | Admin JWT | Submit leave on behalf of an employee |
