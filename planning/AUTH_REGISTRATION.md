# Authentication & Registration

Design for Gmail OAuth registration, session management, and the HR activation workflow.

---

## Overview

Authentication is Google OAuth 2.0 only. Any standard `@gmail.com` account is accepted — no domain whitelist, no Google Workspace requirement. Security is enforced at the **HR activation step**: every new registration is manually reviewed and activated by HR Admin before the employee can access the system.

```
User visits app
      │
      ▼
Google OAuth (any @gmail.com)
      │
      ▼
Profile Form (all dropdowns from master tables)
      │
      ▼
File Uploads (photo + resume)
      │
      ▼
Pending HR Review
      │
      ▼
HR Activates → Welcome Email → Account Live
```

---

## Step 1 — Gmail OAuth

- User clicks **Continue with Google** on the login/register page
- Standard Google OAuth 2.0 authorization code flow
- Scopes requested: `openid`, `email`, `profile`
- Callback URL: `GET /api/v1/auth/google/callback`
- After callback:
  - If email already exists in `users` → log in and issue JWT
  - If email does not exist → redirect to registration profile form

**No domain restriction.** `@gmail.com` only (not Google Workspace `@company.com`). The NestJS guard validates that the email ends in `@gmail.com`.

### JWT Session

After successful activation + login:
```json
{
  "sub": "user-uuid",
  "email": "employee@gmail.com",
  "role": "employee",
  "name": "Priya Sharma",
  "is_active": true,
  "iat": 1234567890,
  "exp": 1235172690
}
```

JWT expiry: 7 days (from `JWT_EXPIRES_IN` env var). Refresh token not implemented in Phase 1.

---

## Step 2 — Profile Form

All dropdown options are fetched from master tables at form load. **No option is hardcoded.**

```
GET /api/v1/master/qualifications   → Highest Degree dropdown
GET /api/v1/master/genders          → Gender dropdown
GET /api/v1/master/role_types       → Role Type dropdown
GET /api/v1/master/departments      → Department dropdown (optional field)
```

### Form Fields

| Field | Type | Required | Source |
|-------|------|----------|--------|
| Full Name | Text | ✅ | Free text |
| Gmail Address | Email | ✅ | Locked — pre-filled from OAuth, read-only |
| Phone Number | Text | ✅ | Free text |
| Date of Birth | Date | ✅ | Date picker |
| Highest Degree | Select | ✅ | `master_qualifications` |
| Degree Specify | Text | Conditional | Visible only when "Other" selected |
| Gender | Select | ✅ | `master_genders` |
| Role Type | Select | ✅ | `master_role_types` |
| Department | Select | ❌ | `master_departments` (optional) |
| Extra Info | Textarea | ❌ | Free text — any additional info |

**Gmail field is read-only.** It is pre-filled from the OAuth response and cannot be edited.

### Validation Rules

- Phone: 10-digit Indian mobile number format (or international with +)
- Date of Birth: must be 18+ years ago
- All required dropdowns must have a selection before form submit

---

## Step 3 — File Uploads

**Allowed file types** fetched from `master_file_types` at runtime — not hardcoded.

```
GET /api/v1/master/file_types?context=profile_photo  → for photo upload validation
GET /api/v1/master/file_types?context=resume         → for resume upload validation
```

| Upload | Required | Allowed Types | Max Size |
|--------|----------|--------------|---------|
| Profile Photo | ✅ Mandatory | image/jpeg, image/png (from master) | 2 MB (from master) |
| Resume / CV | ❌ Optional | application/pdf, .doc, .docx (from master) | 5 MB (from master) |

**S3 upload flow:**
1. Frontend requests a pre-signed S3 PUT URL: `POST /api/v1/uploads/presigned`
2. Backend validates MIME type and size against `master_file_types`
3. Returns pre-signed URL + `s3_key`
4. Frontend uploads directly to S3
5. Frontend confirms upload by sending `s3_key` in the profile form submission

---

## Step 4 — HR Review (Pending Registrations)

After form submission, the user's record is created in the `users` table with `is_active = false`.

- Notification sent to HR Admin: `registration.pending` template from `master_notification_templates`
- Employee receives: "Your profile is under HR review" confirmation page
- HR Admin sees the registration in **Pending Registrations** panel in the admin UI
- HR can view: full profile details, uploaded photo, resume download link (signed S3 URL)

### What Happens on Activation

HR Admin clicks **Activate** on the pending registration:

1. `users.is_active` set to `true`
2. `users.join_date` set to today's date (or HR can override)
3. **`users.is_manager`** — HR Admin sees a toggle: "This employee can be assigned as manager for others." Default: off. Setting this to true makes the employee appear in the manager dropdown on other employees' profiles.
4. `users.confirmation_date` auto-calculated: `join_date + probation.duration_months`
5. Leave balance rows created automatically in `leave_balances` for all active `master_leave_types` for the current year — prorated based on join date
6. Welcome email sent using `registration.activated` template from `master_notification_templates`
7. In-app notification created
8. Audit log: `action: user.activate`, `actor_id: [admin_uuid]`, `entity_id: [user_uuid]`

### Leave Balance Proration on Join

If employee joins mid-year, balances are prorated:
```
prorated_days = annual_days × (months_remaining_in_year / 12)
```
Rounded to nearest 0.5. Stored in `leave_balances.total_days`.

---

## Admin Direct Registration (Bypassing OAuth)

HR Admin or Super Admin can create an employee account directly from the admin panel — without requiring the employee to go through the Gmail OAuth self-registration flow.

**Use cases:** bulk onboarding, employees needing immediate access, correcting a registration.

**Additional admin-only fields:**
| Field | Notes |
|-------|-------|
| Joining Date | Drives probation end date auto-calculation and leave balance proration |
| Reporting Manager | Assigns manager_id for approval workflow |
| Account Status | `active` (immediate login) or `pending` (welcome email, employee completes setup) |

**Flow:**
1. Admin fills in all profile fields + joining date + reporting manager
2. Admin can upload photo/resume or leave blank for employee to fill after first login
3. On save: user record created, leave balances auto-created, welcome email sent
4. Employee uses Gmail OAuth to first login — system recognizes the email and skips registration form
5. Audit log: `action: user.create`, `method: admin_direct`

---

## Admin Authentication (Separate Login)

Admin users do **not** log in via Gmail OAuth. There is a dedicated admin login page with email + password authentication.

### Why Separate?

- Employee accounts are tied to Gmail OAuth — admins need independent credentials
- The first Super Admin must exist before any HR workflow can run, so it is seeded at deployment time
- Admin credentials are managed internally, not dependent on Google

### First Super Admin (Seed)

The initial Super Admin account is created via a database migration/seed script during deployment:

```ts
// seed: creates first Super Admin
{
  email: 'superadmin@rockershr.com',   // configurable via env
  password_hash: bcrypt('...'),         // from SUPER_ADMIN_PASSWORD env var
  full_name: 'Super Admin',
  role: 'super_admin',
  is_active: true
}
```

After deployment, this Super Admin can create additional admin accounts (HR Admin, Leave Admin, Reports Admin) from the admin panel.

### Admin Login Flow

```
Admin visits /admin/login
        │
        ▼
Enters email + password
        │
        ▼
POST /api/v1/admin/auth/login
        │
        ▼
Backend verifies password_hash (bcrypt)
        │
        ▼
Issues Admin JWT → redirect to /admin/dashboard
```

**Login page:** `/admin/login` — a standalone page, visually distinct from the employee Gmail OAuth login.

### Admin JWT Payload

```json
{
  "sub": "admin-user-uuid",
  "email": "hr@rockershr.com",
  "role": "hr_admin",
  "admin_role_id": "uuid-of-master_admin_roles-row",
  "is_admin": true,
  "name": "HR Manager",
  "iat": 1234567890,
  "exp": 1235172690
}
```

The `is_admin: true` flag and `role` field distinguish admin JWTs from employee JWTs. All `/admin/*` API routes validate the `is_admin` claim.

### Admin Credentials Storage

The `admin_users` table must include a `password_hash` column for email + password authentication:

| Column | Type | Notes |
|--------|------|-------|
| `password_hash` | `TEXT NOT NULL` | bcrypt hash (cost factor 12) |

Passwords are never stored in plaintext. The backend uses `bcrypt` for hashing and comparison.

### Password Rules (Phase 1)

- Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit
- No password reset in Phase 1 — Super Admin resets other admin passwords from the admin panel
- Account locks after 5 consecutive failed login attempts (unlocked by Super Admin)

---

## Session & Security

- JWT stored in HTTP-only cookie (not localStorage)
- CSRF protection on all state-changing endpoints
- Google OAuth state parameter validated to prevent CSRF on OAuth callback
- All `/admin/*` routes require `is_admin: true` claim in JWT + active `admin_users` record with valid `password_hash`
- Inactive users (`is_active: false`) are rejected at the JWT validation middleware even with a valid token
- Re-validation: on each request, `is_active` is confirmed from DB (cached for 60s to avoid DB hit per request)

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/auth/google` | None | Redirects to Google OAuth consent |
| GET | `/api/v1/auth/google/callback` | None | Handles OAuth callback, issues JWT |
| POST | `/api/v1/auth/logout` | JWT | Clears session cookie |
| POST | `/api/v1/users/register` | JWT (partial) | Submits profile form after OAuth |
| POST | `/api/v1/uploads/presigned` | JWT | Returns pre-signed S3 URL for upload |
| GET | `/api/v1/users/me` | JWT | Returns current user profile |
| PATCH | `/api/v1/users/me` | JWT | Updates own profile (limited fields) |
| GET | `/api/v1/admin/registrations/pending` | Admin JWT | Lists pending registrations for HR |
| POST | `/api/v1/admin/registrations/:id/activate` | Admin JWT | Activates a pending registration |
| POST | `/api/v1/admin/registrations/:id/reject` | Admin JWT | Rejects a pending registration |
| POST | `/api/v1/admin/auth/login` | None | Admin email + password login, issues Admin JWT |
| POST | `/api/v1/admin/auth/logout` | Admin JWT | Clears admin session cookie |
| POST | `/api/v1/admin/users` | Admin JWT | Direct admin registration of an employee |
