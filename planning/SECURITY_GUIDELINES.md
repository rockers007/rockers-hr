# Security Guidelines — Rockers HR

Rules I follow when writing or changing code in this project. Applies to
both the NestJS backend and the Next.js frontend.

Updated: 2026-04-23

---

## 1. Authentication & Authorization

### 1.1 Passwords
- Hash with `bcrypt`, cost ≥ 10. Never store plaintext. Never return a hash.
- Enforce minimum length (8) + at least one letter + one digit at both the
  DTO validator and the service layer.
- Generated passwords (invites / resets) use a 12-char mixed alphabet that
  omits visually ambiguous characters (`0/O`, `1/l/I`).
- Password-change endpoints always verify the current password with
  `bcrypt.compare` before accepting a new one.
- New password must differ from the current one (enforced via another
  `bcrypt.compare`).
- Invite / reset flows force `first_login_required = true` so the user
  must pick their own password on next login.

### 1.2 JWT
- Sign tokens with the `JWT_SECRET` env var. Never hard-code.
- Keep `JWT_EXPIRES_IN` ≤ 7 days. Re-issue on activation / password change.
- Do not put sensitive data (passwords, secrets) in the JWT payload.
- Re-validate the user in `JwtStrategy.validate` on every request — don't
  trust claims blindly. Re-check `is_active` and role membership from the
  database.
- Admin tokens carry `is_admin: true` + `admin_role_id` and are handled
  separately from employee tokens.

### 1.3 Account lockout (see `LOGIN_MAX_FAILED_ATTEMPTS`)
- 5 consecutive wrong-password attempts → lock for 2 hours.
- Applies to both employee email login and admin login.
- Response status = 423 Locked, with `locked_until` ISO timestamp.
- Admin unlock endpoint releases the lockout early — scoped to
  `employees.add_direct` permission.
- Counter clears on any successful login.

### 1.4 Authorization
- **No endpoint relies on the frontend to enforce access.** Every sensitive
  route has either:
  - `JwtAuthGuard` (employee), or
  - `AdminJwtGuard + PermissionsGuard + @AdminPermissions(...)` (admin).
- Admin permission names come from `master_admin_roles` — don't invent
  new ones, add them as seed data.
- The `SELF_ALLOWED_FIELDS` allowlist in `UsersService` is the single
  source of truth for what an employee can update about themselves. Any
  field not in that list is admin-only. Additions require a review.

---

## 2. Input validation

### 2.1 DTOs
- Every `@Body()` must pass through a class-validator DTO.
- Global `ValidationPipe` is configured with `whitelist: true` and
  `forbidNonWhitelisted: true` — this means the server rejects any
  property not declared in the DTO. Keep it that way.
- Use `@IsEmail`, `@IsUUID`, `@IsDateString`, `@IsInt`, `@Min`, `@Max`,
  `@Matches`, etc. Prefer the strictest decorator available.
- For dates that must be in the past (DOB), validate at both the frontend
  (`validateDob()`) and the service layer (`assertPastDate()`).

### 2.2 SQL injection
- Always use TypeORM's parameterized `.query($1, [...])`, QueryBuilder, or
  repository methods. Never interpolate user input into SQL strings.
- The repository migrations use `queryRunner.query()` with parameterized
  values — do the same in new migrations.

### 2.3 XSS
- Never render user-controlled HTML without sanitization. React escapes
  text nodes by default — don't opt out via `dangerouslySetInnerHTML`.
- Notification templates use `{{token}}` placeholders rendered with a
  plain string replacer. If we ever persist user-supplied HTML, route it
  through a sanitizer first.

### 2.4 Path traversal
- S3 keys are built server-side as `{context}/{userId}/{uuid}{ext}`.
  Never accept a client-supplied s3_key for write; clients only send a
  context and receive a presigned URL.

---

## 3. File uploads

- Uploads go through `POST /uploads/presigned` which validates the
  `mime_type + context` pair against `master_file_types`. Never bypass.
- Enforce a max size from the master table (per context). Server rejects
  oversized files before presigning.
- File uploads are direct to S3 via presigned PUT — the backend never
  touches bytes. Still, the master-table validation happens before the
  presigned URL is issued, so malicious content-types can't even get a
  URL.
- S3 bucket CORS is restricted to known origins (localhost dev +
  `https://*.ngrok-free.app` for ngrok tunnels, production domain later).
- `AllowedMethods` on the bucket is limited to `PUT, GET, HEAD` — no
  `DELETE` from browsers.

---

## 4. Secrets & configuration

- Never commit `.env`. Both `.env` at root and `backend/.env` are in
  `.gitignore`. Do not invent new env files outside those paths.
- Never log secrets or the full `.env`. When redacting in command output,
  mask at minimum the values of: `*_SECRET`, `*_KEY`, `*_PASS`, `*_TOKEN`.
- The backend has two `.env` files (root + `backend/.env`) — keep the
  SMTP, AWS, DATABASE sections identical between them.
- Never change `JWT_SECRET`, admin passwords, or `SMTP_*` without
  explicit user approval. Document the change in a commit message.

---

## 5. Email (SMTP)

- SMTP credentials live in `SMTP_*` env vars. Code reads them at boot via
  `NotificationsService.initSmtp()`.
- All outbound mail content comes from `master_notification_templates` —
  never hard-code email HTML in the service layer.
- When a `From:` address is from a domain you don't control (e.g.
  `@gmail.com` through SendGrid) expect spam filtering. Production use
  requires Domain Authentication.

---

## 6. CORS, headers, transport

- CORS origin is a single env var (`FRONTEND_URL`) with
  `credentials: true`. Wildcard (`*`) is never used.
- The HTTP exception filter wraps responses in `{ data | error }` —
  never leak stack traces to clients.
- Swagger is enabled only when `NODE_ENV !== 'production'`.

---

## 7. Rate limiting

- `ThrottlerModule` applies 100 req/min globally.
- Login, activation, and password endpoints have stricter per-route
  throttles (`@Throttle({ default: { ttl: 60000, limit: 10 } })`) to slow
  down brute-force attempts before account lockout kicks in.
- When adding a new sensitive endpoint (admin trigger, password reset,
  invite), copy the 10/min throttle.

---

## 8. Audit logging

- `AuditService` + `AuditInterceptor` + `@AuditLog()` decorator exist.
- Decorate every write endpoint that touches sensitive state: auth,
  user/admin CRUD, leave approvals, payroll runs, bank-detail changes,
  password resets, unlocks.
- Include: actor id, entity touched, diff (before → after), IP, user
  agent. The interceptor captures most of this automatically; service
  code should only need to log the *reason* when one is provided by the
  admin UI (e.g. resignation, termination).

---

## 9. Data minimization & privacy

- Never return fields the caller shouldn't see. `getProfile()` maps a
  `User` entity to an explicit response shape — don't leak
  `password_hash`, `invite_token`, `google_refresh_token`, or
  `fcm_token` from any user endpoint.
- Admin list endpoints sanitize the same way via `publicUser()` and
  shaped responses.
- Presigned URLs expire (default 5 min) and are only issued to the
  user who owns the resource. Admins use a separate signed-URL path.

---

## 10. Error messages

- Invalid-credentials responses are generic on first attempts
  (`INVALID_CREDENTIALS`), but after the lockout threshold we surface
  the lock status to help legitimate users. Accept that trade-off.
- Never echo SQL, stack traces, or internal keys in error payloads.
- File-upload errors say "file type X not allowed" — that's fine because
  the allowlist is public-facing anyway.

---

## 11. Code-change hygiene

- New migrations are idempotent: `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`,
  `DROP CONSTRAINT IF EXISTS`. Tested by running twice.
- When editing a service that writes to the DB, ask: is there a
  corresponding `@AuditLog`? If not, add one.
- Don't remove existing validation. Don't loosen an allowlist without
  explicit approval.
- Flag every security-relevant change in the commit body.

---

## 12. Don't-do list

- Don't disable `forbidNonWhitelisted` on the global ValidationPipe.
- Don't store passwords, tokens, or PII in logs.
- Don't use `raw` query strings from user input.
- Don't run SQL in production with a superuser DB role — use a
  least-privilege app role.
- Don't commit test credentials, even "temporary" ones.
- Don't bypass a guard with `// @ts-expect-error` or by passing `req.user`
  directly — use `@CurrentUser()`.
- Don't add a new public endpoint without adding a throttle and auth.

---

## 13. Before merging anything auth-touching

Checklist:

- [ ] New endpoint has a guard (JWT / Admin / Permissions).
- [ ] DTO uses strict validators.
- [ ] No user-supplied value is concatenated into SQL.
- [ ] Sensitive action decorated with `@AuditLog`.
- [ ] Rate limit applied if the endpoint is public-ish.
- [ ] Response shape excludes `password_hash`, tokens, FCM IDs.
- [ ] Migration tested up + down.
- [ ] Manual test with a non-admin account confirms the permission check
      actually rejects.

---
