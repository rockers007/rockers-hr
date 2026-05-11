# API Contracts — NestJS REST

Complete endpoint specifications for all Rockers HR API routes. All endpoints prefixed `/api/v1/`.

---

## General Conventions

### Authentication

All endpoints except `/auth/*` and `/health` require a JWT Bearer token:
```
Authorization: Bearer <jwt_token>
```

### Response Envelope

**Success:**
```json
{
  "data": { ... } | [ ... ],
  "meta": { "total": 100, "page": 1, "limit": 20 }  // present on paginated lists only
}
```

**Error:**
```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "You have 3 days available but requested 5.",
    "statusCode": 422
  }
}
```

### Pagination

Paginated endpoints accept `?page=1&limit=20`. Defaults: page=1, limit=20, max limit=100.

### Soft Deletes

No hard-delete endpoints exist. Deactivation uses `PATCH /:id` with `{ "is_active": false }`.

### Rate Limiting

All API endpoints are rate-limited using `@nestjs/throttler`:

| Scope | Limit | Window | Applies To |
|-------|-------|--------|------------|
| Global | 100 requests | 1 minute | All authenticated endpoints |
| Auth | 10 requests | 1 minute | `/auth/*`, `/admin/auth/*` |
| Uploads | 20 requests | 5 minutes | `POST /uploads/presigned` |
| Notifications | 60 requests | 1 minute | `GET /notifications/*` |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

---

## Auth Endpoints

### `GET /auth/google`
Redirects browser to Google OAuth consent screen.

### `GET /auth/google/callback`
Handles OAuth callback from Google.

**Response on new user (needs registration):**
```json
{ "data": { "status": "registration_required", "token": "<temp_jwt>" } }
```

**Response on existing active user:**
```json
{
  "data": {
    "status": "authenticated",
    "token": "<jwt>",
    "user": { "id": "uuid", "name": "Priya Sharma", "email": "priya@gmail.com", "role": "employee" }
  }
}
```

### `POST /auth/logout`
Clears session. Returns `204 No Content`.

---

## Master Data Endpoints

### `GET /master/:table`
Returns all **active** records for the given master table, sorted by `sort_order`.

**Allowed table values:** `qualifications | genders | role_types | leave_types | leave_durations | departments | file_types | notification_templates | sla_config | public_holidays | admin_roles`

Invalid table name → `400 Bad Request`.

**Response:**
```json
{
  "data": [
    { "id": "uuid", "label": "Casual Leave", "sort_order": 1, "is_active": true, ...table_specific_fields }
  ]
}
```

**`leave_types` extra fields in response:**
```json
{
  "id": "uuid", "label": "Casual Leave", "annual_days": 12,
  "probation_allowed": true, "doc_required": false, "doc_threshold_days": null,
  "carry_over": 0, "color": "#3b82f6", "sort_order": 1, "is_active": true
}
```

**`sla_config` response** (key-value, no label/sort_order):
```json
{
  "data": [
    { "config_key": "sla.manager_window_hours", "config_value": "5", "description": "..." }
  ]
}
```

### `GET /master/:table/all`
Returns ALL records including inactive. **Admin JWT required.**

### `POST /master/:table`
Creates a new master record. **Admin JWT + permission required.**

**Request body (example — leave_types):**
```json
{
  "label": "Bereavement Leave",
  "annual_days": 3,
  "probation_allowed": true,
  "doc_required": false,
  "color": "#6b7280",
  "sort_order": 7
}
```

**Response:** `201 Created` with the created record.

### `PATCH /master/:table/:id`
Updates `label`, `sort_order`, `is_active`, or table-specific fields. **Admin JWT + permission required.**

**Request body (partial update):**
```json
{ "sort_order": 2, "is_active": false }
```

**Response:** `200 OK` with the updated record.

### `DELETE /master/:table/:id`
Soft-delete: sets `is_active = false`. **Admin JWT + permission required.**

**Response:** `200 OK` with `{ "data": { "id": "uuid", "is_active": false } }`.

---

## User / Registration Endpoints

### `POST /users/register`
Submits the profile form after Gmail OAuth. Requires temporary JWT from OAuth callback.

**Request (multipart/form-data or JSON + separate S3 keys):**
```json
{
  "name": "Priya Sharma",
  "phone": "9876543210",
  "dob": "1995-03-15",
  "qualification_id": "uuid",
  "gender_id": "uuid",
  "role_type_id": "uuid",
  "department_id": "uuid",
  "extra_info": "",
  "photo_s3_key": "profiles/uuid/photo.jpg",
  "resume_s3_key": "profiles/uuid/resume.pdf"
}
```

**Response:** `201 Created`
```json
{ "data": { "status": "pending_activation", "message": "Your profile is under HR review." } }
```

### `GET /users/me`
Returns current authenticated user's profile.

**Response:**
```json
{
  "data": {
    "id": "uuid", "name": "Priya Sharma", "email": "priya@gmail.com",
    "phone": "9876543210", "role": "employee",
    "department": { "id": "uuid", "label": "Engineering" },
    "photo_url": "https://s3.../signed-url",
    "manager": { "id": "uuid", "name": "Sanjay Kumar" },
    "join_date": "2024-06-01",
    "confirmation_date": "2024-09-01",
    "is_in_probation": false
  }
}
```

### `POST /uploads/presigned`
Returns a pre-signed S3 PUT URL for direct browser-to-S3 upload.

**Request:**
```json
{ "mime_type": "image/jpeg", "file_size_bytes": 1048576, "context": "profile_photo" }
```

**Validation:** MIME type and file size checked against `master_file_types` for the given context.

**Response:**
```json
{
  "data": {
    "upload_url": "https://s3.amazonaws.com/...",
    "s3_key": "profiles/uuid/photo.jpg",
    "expires_in_seconds": 300
  }
}
```

### `PATCH /users/me/fcm-token`
Registers or updates the FCM device token for push notifications. Called by the Flutter app on each launch.

**Request:**
```json
{ "fcm_token": "fMd8K2x...device-token-string" }
```

**Response:** `200 OK`
```json
{ "data": { "status": "token_updated" } }
```

---

## Leave Endpoints (Employee)

### `GET /leave/types/eligible`
Returns leave types the current user is eligible to apply for.

Filters: active only + probation filter (excludes types where `probation_allowed = false` if user is in probation).

**Response:** Same shape as `GET /master/leave_types` but filtered.

### `POST /leave/calculate`
Calculates working days, balance impact, and sandwich flag for a proposed date range. Does not create a request.

**Request:**
```json
{
  "leave_type_id": "uuid",
  "duration_type_id": "uuid",
  "start_date": "2025-06-15",
  "end_date": "2025-06-16"
}
```

**Response:**
```json
{
  "data": {
    "working_days": 2,
    "balance_before": 8,
    "balance_after": 6,
    "sandwich_detected": false,
    "sandwich_detail": null,
    "doc_required": false
  }
}
```

### `POST /leave/requests`
Submit a leave request.

**Request:**
```json
{
  "leave_type_id": "uuid",
  "duration_type_id": "uuid",
  "start_date": "2025-06-15",
  "end_date": "2025-06-16",
  "reason": "Personal work and family commitments",
  "doc_s3_key": null,
  "sandwich_confirmed": false
}
```

**Validation errors (422):**

| code | when |
|------|------|
| `PROBATION_RESTRICTION` | User in probation, type not allowed |
| `INSUFFICIENT_BALANCE` | Not enough days remaining |
| `DATE_CONFLICT` | Overlaps an existing request |
| `NO_WORKING_DAYS` | Range contains no working days |
| `DOCUMENT_REQUIRED` | Doc required but not uploaded |
| `SANDWICH_CONFIRMATION_REQUIRED` | Sandwich detected, `sandwich_confirmed` must be `true` |

**Response:** `201 Created` with the leave request object.

### `GET /leave/requests`
List current user's leave requests. Paginated.

**Query params:** `?status=PENDING_L1&year=2025&page=1&limit=20`

### `GET /leave/requests/:id`
Get single leave request with full approval history.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "leave_type": { "id": "uuid", "label": "Casual Leave", "color": "#3b82f6" },
    "duration_type": { "label": "Full Day", "day_value": 1.0 },
    "start_date": "2025-06-15", "end_date": "2025-06-16",
    "working_days": 2, "status": "PENDING_L2",
    "sandwich_flag": false,
    "submitted_by_admin": null,
    "can_cancel": true,
    "approvals": [
      {
        "level": 1, "approver": { "name": "Sanjay Kumar" },
        "action": "approved", "actioned_at": "2025-06-14T10:30:00Z"
      },
      {
        "level": 2, "approver": { "name": "HR Team" },
        "action": null, "sla_deadline": "2025-06-15T15:30:00Z",
        "sla_elapsed_business_hours": 2.5
      }
    ]
  }
}
```

`can_cancel` is `true` when `start_date > today` and `status NOT IN ('CANCELLED', 'DECLINED')`. The frontend uses this flag to show or hide the cancel button — never compute it client-side.

### `PATCH /leave/requests/:id/cancel`
Cancel a leave request. Allowed if `start_date > today` and status is not already `CANCELLED` or `DECLINED`.

**No request body required.**

**On success:**
- Status set to `CANCELLED`
- Balance restored: `pending_days` or `used_days` decremented by `working_days`
- If was `APPROVED` and `calendar_event_id` exists: Google Calendar event deleted
- Notifications sent to manager/HR (if request was pending)

**Error responses:**

| code | statusCode | when |
|------|-----------|------|
| `LEAVE_ALREADY_STARTED` | 422 | `start_date <= today` |
| `LEAVE_ALREADY_CANCELLED` | 422 | status is already `CANCELLED` |
| `LEAVE_ALREADY_DECLINED` | 422 | status is `DECLINED` |
| `NOT_FOUND` | 404 | Leave request not found or belongs to another user |

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "status": "CANCELLED",
    "cancelled_at": "2025-06-13T09:00:00Z",
    "balance_restored": { "leave_type": "Casual Leave", "days_returned": 2 }
  }
}
```

### `GET /leave/balance`
Get current user's leave balances for the current year.

**Response:**
```json
{
  "data": [
    {
      "leave_type": { "id": "uuid", "label": "Casual Leave", "color": "#3b82f6" },
      "year": 2025,
      "total_days": 12, "used_days": 4, "pending_days": 2, "available_days": 6
    }
  ]
}
```

---

## Approval Endpoints (Manager — Level 1)

### `GET /manager/approvals/pending`
List pending L1 approvals for the current manager's direct reports.

**Response includes:** employee name, leave type, dates, working days, SLA deadline, SLA remaining.

### `POST /manager/approvals/:id/approve`
Approve at Level 1. No request body required.

**Response:** `200 OK` with updated leave request.

### `POST /manager/approvals/:id/decline`
Decline at Level 1. Reason required.

**Request:** `{ "reason": "Team at full capacity during these dates." }`

---

## Approval Endpoints (Admin — Level 2)

### `GET /admin/approvals/pending`
List all pending L2 approvals (and escalated requests).

### `POST /admin/approvals/:id/approve`
Approve at Level 2. Triggers Google Calendar event creation + employee notification.

### `POST /admin/approvals/:id/decline`
Decline at Level 2. Reason required.

---

## Admin — Employee Management

### `GET /admin/users`
List all employees. Filterable by `department_id`, `role_type_id`, `is_active`, `is_manager`, `search` (name/email).

### `GET /admin/users/managers`
Returns all users where `is_manager = true AND is_active = true`. Used to populate the **Reporting Manager** dropdown on employee creation and profile edit forms. Sorted alphabetically.

**Response:**
```json
{
  "data": [
    { "id": "uuid", "name": "Sanjay Kumar", "department": "Engineering" },
    { "id": "uuid", "name": "Meera Nair",   "department": "HR" }
  ]
}
```

### `GET /admin/users/:id`
Full employee profile including leave summary for current year.

### `POST /admin/users`
Direct admin registration.

**Request:**
```json
{
  "gmail": "newemployee@gmail.com",
  "name": "Rahul Mehta",
  "phone": "9876543211",
  "dob": "1998-01-20",
  "qualification_id": "uuid",
  "gender_id": "uuid",
  "role_type_id": "uuid",
  "department_id": "uuid",
  "manager_id": "uuid",
  "is_manager": false,
  "join_date": "2025-07-01",
  "account_status": "active",
  "admin_notes": "Direct hire, needs immediate access"
}
```

`is_manager`: when `true`, this employee appears in the manager dropdown for other employees. Only HR Admin can set this flag. Default `false`.

### `PATCH /admin/users/:id`
Edit employee profile fields including `is_manager` toggle. Audit log records before/after state JSONB.

**Editable fields:** `name`, `phone`, `department_id`, `manager_id`, `is_manager`, `qualification_id`, `gender_id`.

`is_manager: true` → employee appears in the Reporting Manager dropdown for all other employees.
`is_manager: false` → removed from manager dropdown; existing `manager_id` references on other employees are not automatically cleared (HR must manually reassign).

### `GET /admin/registrations/pending`
List pending HR review registrations.

### `POST /admin/registrations/:id/activate`
Activate a pending registration. Creates leave balances, sends welcome email.

**Request:**
```json
{
  "join_date": "2025-07-01",
  "manager_id": "uuid",
  "is_manager": false
}
```

`is_manager` — HR Admin sets this at activation. Determines whether the employee appears in the Reporting Manager dropdown for future employees.

### `POST /admin/registrations/:id/reject`
Reject a pending registration. Reason required. Sets `is_active = false` (soft-delete). Employee cannot log in.

**Request:** `{ "reason": "Duplicate registration." }`

### `POST /admin/users/:id/leave/requests`
Submit leave request on behalf of an employee (Superset Capability 3).

**Request:** Same as `POST /leave/requests` plus `admin_notes` field.

---

## Notification Endpoints

Push notifications are delivered via FCM for mobile clients. Push piggybacks on the `in_app`/`both` channel — no separate channel configuration needed.

### `GET /notifications`
List in-app notifications for current user. Paginated. Filter: `?is_read=false`.

### `PATCH /notifications/:id/read`
Mark a single notification as read.

### `PATCH /notifications/read-all`
Mark all notifications as read for current user.

### `GET /notifications/count`
Returns unread notification count for the current user. Used by web header bell icon and mobile tab badge. Cached for 30 seconds per user.

**Response:**
```json
{ "data": { "unread": 3 } }
```

---

## Reports Endpoints (Admin)

### `GET /admin/reports/monthly`
Monthly leave report.

**Query params:** `?month=6&year=2025&department_id=uuid`

**Response:**
```json
{
  "data": {
    "period": "June 2025",
    "summary": {
      "total_days": 47, "approved": 38, "declined": 6,
      "approval_rate_pct": 81, "sla_compliance_pct": 87
    },
    "by_type": [
      { "leave_type": "Casual Leave", "color": "#3b82f6", "days": 18 }
    ],
    "by_employee": [
      { "employee_name": "Priya S.", "department": "Engineering",
        "days_by_type": { "Casual Leave": 2, "Sick Leave": 0 } }
    ],
    "sla_performance": {
      "within_sla": 87, "escalated": 8, "breached": 5
    }
  }
}
```

### `GET /admin/reports/yearly`
Yearly leave report.

**Query params:** `?year=2025&department_id=uuid`

### `GET /admin/reports/leave-balance`
Leave balance report — shows employees with remaining/unused leave balance for any leave type.

**Note:** Since the policy is "use all leave or lose it", HR monitors all employees with unused balance so they can be encouraged to use their remaining days before December 31.

**Query params:** `?year=2025&department_id=uuid`

**Response:**
```json
{
  "data": [
    {
      "employee_name": "Ravi M.", "department": "Sales",
      "unused_leaves": [
        { "leave_type": "Casual Leave", "total": 12, "used": 11, "available": 1 },
        { "leave_type": "Paid Leave",   "total": 15, "used":  9, "available": 6 }
      ],
      "total_unused_days": 7
    }
  ]
}
```

### `GET /admin/reports/monthly/export`
**Query params:** `?format=csv|pdf&month=6&year=2025`

### `GET /admin/reports/yearly/export`
**Query params:** `?format=csv|pdf&year=2025`

All export endpoints return: file download with `Content-Disposition: attachment; filename="..."`.

**PDF exports** use `pdfkit` for server-side PDF generation. **CSV exports** use `fast-csv`.

---

## Audit Log Endpoints (Admin)

### `GET /admin/audit-log`
Paginated audit log. Filter: `?actor_id=uuid&entity_type=leave_request&action=leave.create&from=2025-01-01&to=2025-06-30`

**Permission:** Super Admin + HR Manager only.

---

## Health

### `GET /health`
Returns `200 OK` with `{ "status": "ok", "db": "ok" }`. No auth required.

---

## Auth & Registration (v2.0 — admin-invite flow)

See `AUTH_REGISTRATION.md` for full design. Summary endpoints:

### `POST /admin/users/invite` — admin creates + invites
**Auth:** admin JWT with `employees.add_direct` permission.
**Body:** `{ "name": string, "email": string, "emp_number"?: string }`
**201:** `{ "data": { "user": { "id", "name", "email", "emp_number", "is_active": false } } }`
**Errors:** `400 EMAIL_INVALID`, `409 EMAIL_TAKEN`

Creates the user row with `first_login_required=true`, generates a random password, stores its bcrypt hash, generates a 7-day `invite_token`, and dispatches the `user.invited` email template. Audit: `user.invited`.

### `POST /auth/login/email` — employee email + password login
**Body:** `{ "email": string, "password": string }`
**200 OK — profile complete:** `{ "data": { "token", "user", "first_login_required": false } }`
**200 OK — first login:** `{ "data": { "token", "user", "first_login_required": true } }` → frontend routes to `/complete-profile`
**401 INVALID_CREDENTIALS:** wrong email or wrong password (both surface the same message to prevent enumeration).
**403 ACCOUNT_INACTIVE:** account was deactivated after activation.

### `POST /auth/activate-account` — first-login completion
**Auth:** employee JWT from a `first_login_required=true` login.
**Body:** `{ phone, dob, gender_id, qualification_id, department_id, join_date, photo_s3_key?, resume_s3_key?, new_password, confirm_password }`
**200:** `{ "data": { "token": "<new JWT>", "user": { "is_active": true, "first_login_required": false, ... } } }`
**409 ALREADY_ACTIVATED:** `first_login_required=false`.
**422 PASSWORD_TOO_WEAK / PASSWORD_MISMATCH / VALIDATION_FAILED**

Persists profile fields, sets new `password_hash`, flips `is_active=true`, clears invite token, dispatches `user.activated` email, returns refreshed JWT.

### `POST /admin/users/:id/resend-invite`
**Auth:** admin JWT with `employees.add_direct` permission.
**200:** `{ "data": { "sent_at", "expires_at" } }`
**404 USER_NOT_FOUND**, **409 ALREADY_ACTIVE**

Regenerates the random password (invalidating the previous one), refreshes the invite token (7-day expiry), re-dispatches `user.invited`.

### Legacy Gmail OAuth (unchanged)

Kept for employees created under the pre-v2.0 self-registration flow.

- `GET /auth/google` — initiate
- `GET /auth/google/callback` — handle callback

The `/login` page renders a "Continue with Google" secondary link below the email+password form. Google OAuth does NOT apply to users created via `/admin/users/invite` — they must authenticate with the invited password.
