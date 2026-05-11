# Security TODO — Rockers HR

Things the codebase already does well are captured in
[`SECURITY_GUIDELINES.md`](./SECURITY_GUIDELINES.md). This file lists the
gaps that still need to be closed, in rough priority order. Status
reflects the state of the `claude/gallant-pike-c9c4a4` branch as of
2026-04-23.

Rating scale:

| P | Meaning |
|---|---------|
| P0 | Fix before production. Exploitable today. |
| P1 | Fix before production. Defence-in-depth but obvious. |
| P2 | Fix during production hardening. Low current risk. |
| P3 | Nice-to-have / long-term. |

---

## P0 — must-fix before production

### 1. `JWT_SECRET` is a weak, committed-looking value
- **What:** `backend/.env` has `JWT_SECRET=S3D41VS64DV1SD3V14` — short
  and looks like a developer placeholder.
- **Risk:** Anyone with that string can forge admin + employee JWTs and
  log in as anyone. JWT claims are trusted for user id + admin role id.
- **Fix:** Generate a 256-bit random secret
  (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
  store it in the production secret manager (AWS SSM / Secrets Manager),
  never in a committed `.env.example`. Rotate it in dev too.
- **Effort:** 10 min.

### 2. JWT is stored in `localStorage`
- **What:** Frontend keeps `token` in `localStorage`. Any XSS → full
  account takeover, including admin.
- **Risk:** Critical if any XSS ever lands (user-supplied content,
  vulnerable dep, markdown rendering, etc).
- **Fix:** Move to `httpOnly; Secure; SameSite=Lax` cookie issued by the
  backend. Switch the API client to rely on the cookie rather than the
  `Authorization` header. Add a CSRF token route (or use
  `SameSite=Strict` if we can live without cross-origin).
- **Effort:** 1–2 days (both backend + frontend + mobile needs a plan).

### 3. No Content-Security-Policy / security headers
- **What:** No `helmet` or equivalent middleware in `main.ts`.
- **Risk:** Browsers aren't told to block inline scripts, frames, or
  mixed content. Multiplies the blast radius of any XSS.
- **Fix:**
  ```ts
  import helmet from 'helmet';
  app.use(helmet({
    contentSecurityPolicy: { directives: { /* tune */ } },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // for CDN
  }));
  ```
- **Effort:** 30 min + CSP tuning for ngrok + CloudFront.

### 4. `AuditInterceptor` exists but is applied on only one endpoint
- **What:** Grep shows a single `@AuditLog` usage in the entire codebase
  despite the PLAN.md promising audit logging on all write endpoints.
- **Risk:** No forensic trail. Cannot answer "who deleted this row / who
  changed this employee's bank account / who unlocked user X".
- **Fix:** Decorate every mutating admin + employee endpoint:
  auth.controller (login/activate/change-password),
  users-admin.controller (invite/resend/reset/unlock/update),
  profile-extras.controller (family/document CRUD),
  leave + payroll write paths, backup controller, master CRUD.
  Roughly 40–50 endpoints; mechanical change.
- **Effort:** 2–3 hours.

### 5. CSRF protection
- **What:** CORS is configured with `credentials: true`. If we later move
  tokens to cookies (item 2), state-changing endpoints become CSRF
  targets.
- **Risk:** Becomes P0 after item 2. Currently partially mitigated
  because the Bearer header can't be set by a cross-origin form POST.
- **Fix:** Add `@nestjs/csrf` or `csurf` + double-submit cookie pattern
  once sessions move to cookies.
- **Effort:** Half a day when paired with item 2.

---

## P1 — defence in depth, high value

### 6. No HTTPS enforcement / HSTS
- Reverse proxy / load balancer must redirect http → https and set
  `Strict-Transport-Security` for ≥ 1 year with `includeSubDomains`.
- ngrok gives us HTTPS but the production deployment config isn't
  captured anywhere yet.

### 7. No session invalidation on password change
- **What:** After a user changes their password (or admin resets it),
  old JWTs remain valid until they naturally expire (up to 7 days).
- **Fix:** Add a `tokens_valid_from` timestamp column on users + admin_users.
  `JwtStrategy.validate` rejects JWTs issued before that timestamp.
  Bump it on password change / admin reset / admin unlock / admin
  deactivate. That also gives us a real "log me out everywhere" button.
- **Effort:** 2 hours (small migration + 3 lines in JwtStrategy).

### 8. `SMTP_PASS` leaks across scripts
- Diagnostic node scripts in this repo occasionally echo the SMTP
  password (Gmail App Password). In prod we should not ship such scripts
  and should rotate the password if repo access is ever shared.

### 9. Rate-limit every sensitive admin endpoint, not just auth
- `/admin/users/:id/resend-invite`, `/reset-password`, `/unlock`,
  `/admin/backup/trigger` all currently inherit only the default
  100/min throttle. Add a stricter per-route throttle (10/min) so a
  compromised admin token can't mass-trigger actions.

### 10. CORS wildcard for ngrok tunnel subdomain
- S3 bucket CORS allows `https://*.ngrok-free.app`. Fine for dev;
  restrict to the production frontend domain before launch and keep a
  separate dev bucket.

### 11. Password history
- Currently we only reject "new password equals current". An attacker
  who gets a single password hash can swap back and forth between two
  passwords. Store the last N (5) bcrypt hashes per user and reject
  reuse against any of them.
- **Effort:** Small migration + 10 lines. Do when we add MFA.

### 12. Admin bootstrap / password defaults
- Super Admin is seeded with a placeholder password. Production deploy
  checklist must require rotating this on first run and disabling the
  default, or creating admins via a signed invite.
- Add a migration that rejects boot if the seeded default admin
  password hash is unchanged in production.

### 13. Sensitive operations don't require re-auth
- Password change, bank-detail change, 2FA enrollment, payroll release
  should prompt the user to re-enter their password before the
  sensitive action ("step-up auth") to catch stolen-cookie cases.

---

## P2 — harden during production readiness

### 14. No 2FA / MFA
- Add TOTP (Google Authenticator) on at least all admin accounts.
  Employees optional.
- Table: `user_mfa_secrets (user_id, totp_secret, enrolled_at, last_used_at)`.
- Require a 6-digit code on every admin login. Skip for 30 days on a
  trusted device if the user opts in.

### 15. Dependency scanning in CI
- Wire `npm audit --production --audit-level=high` into the CI
  pipeline and fail the build on non-informational findings.
- Pair with Dependabot or Renovate for weekly updates.

### 16. Log shipping + alerting
- Backend currently logs to stdout / file. Ship logs to a central sink
  (CloudWatch / Datadog / Grafana Loki) and alert on:
  - > N 401/403 from same IP in 5 min
  - Account lockouts
  - Bulk invite / password-reset bursts
  - Any 5xx from write endpoints

### 17. File content validation beyond MIME
- Current upload check validates `mime_type` against `master_file_types`
  and enforces size. A malicious client could send a PDF magic-byte
  that's actually JS. Browsers honour `Content-Type`, but the S3 object
  should be scanned (e.g. ClamAV on a post-upload Lambda) before serving
  via CloudFront.

### 18. Private S3 objects only
- Confirm the S3 bucket policy is private (no public read). All reads go
  through backend-issued presigned URLs (5-minute expiry) or a signed
  CloudFront path. Public bucket policy would leak every employee's
  Aadhaar / PAN / resume / payslip.

### 19. Payslip PDF password
- DOB-as-DDMM is weak (≤ 366 combinations for the day-month). Acceptable
  as a "prevent accidental disclosure" measure but advertise clearly;
  don't position as encryption.
- Consider forcing a per-user random password stored encrypted in the
  DB and shown once after download.

### 20. Input length caps on free-text fields
- `current_address`, `permanent_address`, `extra_info` are TEXT columns
  with no server-side length check. Malicious actor could send 10 MB of
  text. Add `@MaxLength(N)` to every free-text DTO field.

### 21. Permission edges on profile-extras
- `MyProfileExtrasController` correctly restricts to `@CurrentUser`.
  Double-check the admin counterpart rejects cross-tenant access
  (admin can view any user, but non-HR-admin roles should not see
  sensitive documents without an `employees.view_documents` permission).

### 22. CSRF on presigned-upload
- Direct S3 PUT is safe because the URL is signed. But the
  `/uploads/presigned` endpoint itself is a POST with Bearer auth; if
  we move to cookie auth (item 2), this becomes a CSRF target because
  an attacker can then pre-seed malicious files under the user's
  account.

---

## P3 — long-term improvements

### 23. WAF / bot protection at the edge
- Cloudflare / AWS WAF rules: block common bot user-agents, rate-limit
  per IP, enforce challenge on signup and login pages.

### 24. Secrets rotation policy
- Document: JWT secret every 90 days, SMTP app password every 180 days,
  AWS IAM keys every 90 days, DB password every 180 days.
- Automate what we can with AWS Secrets Manager rotation.

### 25. IP allow-listing for admin panel
- HR admin usage is typically from the office. Optionally allow only
  the corporate CIDR on `/admin/*` routes.

### 26. Full-disk encryption at rest for DB + S3
- Postgres RDS: enable AWS KMS-backed encryption. S3: bucket default
  encryption (SSE-S3 or SSE-KMS).

### 27. Backup integrity
- `BackupController` uploads `.sql.gz` to S3. Confirm:
  - Backup bucket is separate + versioned + MFA-delete enabled.
  - Restore drill is part of onboarding runbook.

### 28. PII redaction in logs
- Gate: no email, phone, Aadhaar, PAN, or bank account number appears
  in any log. Add a log transformer that redacts known field names.

### 29. Data retention & deletion
- How long do we keep ex-employee data? When an account is marked
  `terminated` or `resigned`, schedule anonymisation after retention
  window (typically 7 years for payroll).

### 30. Mobile app token handling
- Flutter client shouldn't keep the JWT in shared preferences without
  encryption. Use the platform keystore (`flutter_secure_storage`).

---

## Quick wins (half-day or less each)

If we want to ship security improvements quickly, start here — these
are the cheapest items with the highest return:

1. Rotate `JWT_SECRET` to a random 256-bit value (10 min).
2. Add `helmet` middleware (30 min).
3. Add `@MaxLength(...)` to every text field in every DTO (1 hour).
4. Apply `@AuditLog` to all write endpoints (2 hours).
5. Add `@Throttle({ttl:60000,limit:10})` to every admin action endpoint
   that has a real-world side effect — invite / reset / unlock / backup
   trigger / payroll release (1 hour).
6. Add `tokens_valid_from` column + JwtStrategy check for session
   invalidation on password change (2 hours).

Total: ~1 day of work, closes most P0/P1 items.

---

## How this list stays current

- When a P0/P1 item is fixed, move it into `SECURITY_GUIDELINES.md`
  under the relevant section (it becomes a rule we follow going
  forward) and remove from this file.
- When adding a new feature, add any new gaps it creates here rather
  than only in the PR description. The review gate is: can we answer
  every unchecked item in "Before merging anything auth-touching" from
  the guidelines doc? If not, open an item here.
