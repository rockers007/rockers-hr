# Authentication & Registration

Design for admin-invited email + password registration, first-login profile completion, and JWT session management.

> **Version:** v2.0 (invite-based flow replaces employee self-registration via Google OAuth).
> Google OAuth is retained as a fallback for employees who originally registered that way — their accounts keep working untouched. The `/login` page shows email+password primary and a secondary "Continue with Google" link.

---

## Overview

Employees are **invited by an admin** — they cannot self-register. On invite, a welcome email with a login link, username (the employee's email), and a randomly-generated password is sent. First login with that password takes the employee to a profile-completion page where they fill remaining details and set a new password. On submit they become `is_active = true` and are redirected to the dashboard.

```
 Admin adds Employee  ────────►  Invite email fires
  (Name, Emp No, Email)           (link + username + random password)
                                            │
                                            ▼
                                 Employee clicks link / opens /login
                                            │
                                            ▼
                                 Email + Password form
                                            │
                                            ▼
                                 first_login_required = true?
                                    │ YES          │ NO
                                    ▼              ▼
                          Complete Profile     Dashboard
                          (pending fields +      (existing session)
                           new password)
                                    │
                                    ▼
                        is_active = true  +  verification email
                                    │
                                    ▼
                                 Dashboard
```

If the employee is still inactive (hasn't completed first login), the admin user-list UI shows a **Resend Invite** button that regenerates the password, resets the 7-day invite token, and re-sends the welcome email.

---

## Roles in the flow

| Actor | Capability |
|---|---|
| **Admin (HR Manager / Super Admin)** | Adds employee (Name, Emp No, Email); resends invite; sees status |
| **Employee** | Logs in with email + emailed password; completes profile on first login; sets own password |
| **System** | Generates random password, invite token, sends emails, flips `is_active` on activation |

---

## Step 1 — Admin invites employee

**UI:** `/admin/employees` → "Add Employee" button → modal/form.

**Required fields (minimum to invite):**
- `name` — free text, required
- `email` — valid email, must be unique in `users`
- `emp_number` — optional; if omitted admin fills later

Admin clicks **Save**. Backend:

1. Creates a row in `users`:
   - `is_active = false`
   - `first_login_required = true`
   - `registration_method = 'admin_invite'`
   - `password_hash = bcrypt(randomPassword)`
   - `invite_token = crypto.randomUUID()` (opaque)
   - `invite_token_expires_at = now() + 7 days`
   - `role_type_id` defaulting to `employee` system key
2. Dispatches the `user.invited` notification template with tokens:
   - `{{name}}`
   - `{{email}}`
   - `{{plain_password}}` (the pre-hash random one — only referenced in this email, not stored)
   - `{{login_url}}` — `{FRONTEND_URL}/login?invite={invite_token}`
   - `{{expires_in_days}}` — 7

The `login_url` pre-fills the email field on the login form and is a convenience — the invite token itself is only used by the frontend to UX-prefill the email. The actual login remains email+password.

### API

```
POST /api/v1/admin/users/invite
Body: { "name": "Priya Sharma", "email": "priya@gmail.com", "emp_number": "RT-HR-050" }
→ 201 { "data": { "user": { "id":..., "name":..., "email":..., "emp_number":..., "is_active": false } } }
```

Validation:
- `400 EMAIL_INVALID` — malformed
- `409 EMAIL_TAKEN` — another user row already has this email

The endpoint is idempotent **only on the exact same email**: a repeated call with the same email returns 409. To re-send, use the dedicated resend endpoint below.

---

## Step 2 — Employee first login

**UI:** `/login?invite=<token>` (link from email) OR visit `/login` directly and type credentials.

Login form:
- **Email** (pre-filled if invite token is present)
- **Password**
- Secondary: "Continue with Google" link (legacy Google-registered users)

On submit: `POST /api/v1/auth/login/email`

### Response paths

| Scenario | Response |
|---|---|
| Credentials OK and `first_login_required = true` | 200 `{ data: { token, user, first_login_required: true } }` — frontend redirects to `/complete-profile` |
| Credentials OK and `first_login_required = false` and `is_active = true` | 200 same shape with `first_login_required: false` — frontend redirects to `/dashboard` |
| Credentials OK and `is_active = false` and `first_login_required = false` | 403 `ACCOUNT_INACTIVE` — account was deactivated; contact admin |
| Wrong password | 401 `INVALID_CREDENTIALS` |
| No such email | 401 `INVALID_CREDENTIALS` (do not leak whether email exists) |

Issued JWT:

```json
{
  "sub": "user-uuid",
  "email": "employee@gmail.com",
  "role": "employee",
  "name": "Priya Sharma",
  "is_active": false,
  "first_login_required": true,
  "iat": 1234567890,
  "exp": 1235172690
}
```

JWT `exp` = 7 days. Frontend routes the user based on `first_login_required`.

---

## Step 3 — Complete profile + set new password

**UI:** `/complete-profile` — shown automatically after first-login when `first_login_required = true`. This is the same form that previously appeared after Google OAuth registration; it now lives at the email-login flow terminus.

Fields:

| Field | Source | Required |
|---|---|---|
| Phone | user input | yes |
| Date of birth | user input | yes |
| Gender | `/master/genders` | yes |
| Qualification | `/master/qualifications` | yes |
| Department | `/master/departments` | yes |
| Joining date | user input | yes |
| Profile photo | S3 presigned | no |
| Resume | S3 presigned | no |
| **New password** | user input | yes |
| **Confirm password** | must match | yes |

Password rules:
- Min 8 characters
- At least 1 letter + 1 digit
- Max 72 (bcrypt ceiling)
- Must differ from the random invite password

On submit: `POST /api/v1/auth/activate-account` with JWT in the Authorization header.

Server:
1. Verifies JWT, loads user, requires `first_login_required = true` (else 409)
2. Validates password complexity + match
3. Writes all profile fields to `users`
4. Sets `password_hash = bcrypt(new_password)`, `first_login_required = false`, `is_active = true`, `invite_token = null`, `invite_token_expires_at = null`
5. Dispatches `user.activated` notification (email) to the employee
6. Returns a **refreshed JWT** with the new flags + full user payload → frontend replaces the old JWT and redirects to `/dashboard`

### Response

```json
{
  "data": {
    "token": "<new JWT>",
    "user": { "id":..., "is_active": true, "first_login_required": false, ... }
  }
}
```

---

## Step 4 — Resend invite (if employee never activated)

**UI:** `/admin/employees` lists all users. For any row with `is_active = false`, show a "Resend Invite" button.

Clicking it:
- Generates a **new** random password (invalidates the previous one)
- Generates a new `invite_token` with 7-day expiry
- Writes both to the user row
- Re-dispatches the same `user.invited` template

### API

```
POST /api/v1/admin/users/:id/resend-invite
→ 200 { "data": { "sent_at": "2026-...", "expires_at": "2026-..." } }
```

Validation:
- `404 USER_NOT_FOUND`
- `409 ALREADY_ACTIVE` — the user has completed first login; no invite to resend

---

## Legacy: Gmail OAuth (existing users only)

Users created via the previous self-registration flow (`registration_method = 'self'` with Google tokens on record) keep using Google OAuth:

- `GET /api/v1/auth/google` — initiate OAuth
- `GET /api/v1/auth/google/callback` — handle callback; issues JWT if account is active

The `/login` page renders the "Continue with Google" link below the email+password form. For **new** employees created via admin invite, Google OAuth is not part of the flow — they must use email + password. If a Google user hasn't completed their original profile (pending HR activation) they're routed to the legacy `/register` form as before. No migration is run over existing rows.

---

## Database impact

New columns on `users` (migration bundled with this change):

| Column | Type | Notes |
|---|---|---|
| `password_hash` | `varchar(80)` NULL | bcrypt; NULL for pure Google users |
| `invite_token` | `uuid` NULL | opaque identifier; used only for email-link pre-fill |
| `invite_token_expires_at` | `timestamptz` NULL | 7-day default |
| `first_login_required` | `boolean` NOT NULL DEFAULT false | flipped to true at invite, false after `activate-account` |

Existing `registration_method` text column gains a new value: `'admin_invite'`.

---

## Notification templates

Two new rows in `master_notification_templates` (seeded via migration):

### `user.invited`

**Subject:** `You've been invited to Rockers HR`

**Body (HTML):**
> Hi {{name}},
>
> An account has been created for you in Rockers HR. Log in using the details below:
>
> **Link:** {{login_url}}
> **Username:** {{email}}
> **Password:** `{{plain_password}}`
>
> For your security, you'll be asked to set a new password and complete your profile on first login. This invite link expires in {{expires_in_days}} days.
>
> If you didn't expect this email, contact HR.

Channel: `email`

### `user.activated`

**Subject:** `Your Rockers HR account is active`

**Body (HTML):**
> Hi {{name}},
>
> Your account has been verified and activated. You can now log in and start managing your leave.
>
> — Rockers HR

Channel: `email`

---

## Edge cases

| Case | Behaviour |
|---|---|
| Admin invites email that already exists as admin-only account | 409 EMAIL_TAKEN |
| Employee enters wrong password 5× in a row | No lockout in v2.0 (Phase 2 — rate-limiting via existing throttler is 100/min at IP) |
| Invite token expired when employee clicks link | Login still works if they know the password; admin can resend to reset |
| Employee completes profile but password complexity fails | 422 with field-level error; no state change |
| Employee closes the Complete Profile page after first login | Next login returns `first_login_required: true` again; they resume where they left off |
| Admin tries to resend invite to an active user | 409 ALREADY_ACTIVE |
| Google-registered existing user logs in via email+password | 401 INVALID_CREDENTIALS (no `password_hash` set); they must use Google |

---

## Open questions

None — implementation proceeds per the decisions above. If password complexity rules, token expiry, or lockout semantics need tightening (compliance requirement), track them as follow-up items; the schema supports all of these without further migration.
