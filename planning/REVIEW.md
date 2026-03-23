# Documentation Review — Rockers HR Leave Management System

**Reviewer:** Claude (AI Agent)
**Date:** 2026-03-23
**Docs Reviewed:** PLAN.md, MASTER_DATA.md, AUTH_REGISTRATION.md, LEAVE_WORKFLOW.md, ADMIN_RBAC.md, DATABASE_SCHEMA.md, API_CONTRACTS.md, NOTIFICATIONS.md, FRONTEND_DESIGN.md, OPEN_QUESTIONS.md

---

## Critical Issues (Must Fix Before Development)

### 1. ~~Credentials Exposed in PLAN.md~~ RESOLVED

**Resolution:** Credentials removed from PLAN.md. Placeholder values now in place. **Reminder:** Rotate all previously exposed credentials (they remain in git history).

---

### 2. ~~Circular Foreign Key Dependency Between `users` and `admin_users`~~ RESOLVED

**User confirmed:** `admin_users` is for admin login only; `users` is for employees (mobile/frontend).

**Resolution:** `created_by` nullable on all master tables (NULL for seed data). Bootstrapping order and seed script updated in DATABASE_SCHEMA.md.

---

### 3. ~~`master_leave_types` Uses `name` Instead of `label`~~ RESOLVED

**Resolution:** Renamed `name` → `label` across DATABASE_SCHEMA.md, MASTER_DATA.md, API_CONTRACTS.md, OPEN_QUESTIONS.md.

---

### 4. ~~`master_file_types` Missing `label` and `sort_order`~~ RESOLVED

### 5. ~~`master_sla_config` Schema Inconsistency~~ RESOLVED

**Resolution (both):** "Base Schema Exceptions" subsection added to MASTER_DATA.md documenting the 3 divergent tables.

---

## Inconsistencies Across Documents

### 6. ~~SLA Engine Elapsed Calculation~~ RESOLVED

**User confirmed:** Use pre-computed deadlines.

**Resolution:** Updated across:
- DATABASE_SCHEMA.md — Added `reminder_deadline TIMESTAMPTZ` column to `leave_approvals`
- NOTIFICATIONS.md — Rewrote SLA engine to use two simple queries (`WHERE reminder_deadline <= now()` and `WHERE sla_deadline <= now()`) instead of per-minute business-hours recalculation

---

### 7. ~~Notification `event_key` Mismatch~~ RESOLVED

**User confirmed:** Use separate role-suffixed event_keys.

**Resolution:** Multi-recipient events now use suffixed keys across:
- MASTER_DATA.md — Event catalogue table updated (13 event_keys, up from 9)
- NOTIFICATIONS.md — All event sections updated with `.employee`, `.manager`, `.hr` suffixes
- DATABASE_SCHEMA.md — `event_key UNIQUE` constraint unchanged (works with suffixed keys)

Affected keys: `leave.submitted.*`, `leave.approved.l1.*`, `sla.escalated.*`, `registration.pending.*`

---

### 8. ~~`submitted_by` / `cancelled_by` FK Inconsistency~~ RESOLVED

**User confirmed:** `submitted_by` always references `users(id)`. Add `cancelled_by_usertype` column to distinguish admin vs user cancellation.

**Resolution:** Updated DATABASE_SCHEMA.md:
- `submitted_by` FK changed from `admin_users(id)` → `users(id)`
- Added `cancelled_by_usertype TEXT CHECK (cancelled_by_usertype IN ('user', 'admin'))`

---

### 9. ~~High Usage Report Name is Misleading~~ RESOLVED

**User confirmed:** Report shows remaining/balance leave only.

**Resolution:** Renamed to "Leave Balance Report" in:
- API_CONTRACTS.md — `GET /admin/reports/high-usage` → `GET /admin/reports/leave-balance`
- PLAN.md — Section 12 reports table updated

---

### 10. ~~`users.updated_at` Column Missing~~ RESOLVED

**Resolution:** `updated_at` added to `users` table in DATABASE_SCHEMA.md.

---

### 11. ~~Auth Callback Method Inconsistency~~ RESOLVED

**Resolution:** Changed `POST` to `GET` in AUTH_REGISTRATION.md.

---

## Design Gaps & Missing Specifications

### 12. ~~No Level 2 SLA for HR Approvals~~ RESOLVED

**User confirmed:** Two-level flow is correct (L1 manager, L2 admin). No additional L2 SLA needed — HR is the final authority.

**Resolution:** No doc changes needed. Confirmed as designed.

---

### 13. ~~ESCALATED State Ambiguity~~ RESOLVED

**Resolution:** `ESCALATED → APPROVED/DECLINED` transitions added to LEAVE_WORKFLOW.md.

---

### 14. ~~Admin Users Authentication Flow Undefined~~ RESOLVED

**Resolution:** Admin auth section added to AUTH_REGISTRATION.md + DATABASE_SCHEMA.md.

---

### 15. ~~Manager Approval Scope Not Enforced in Schema~~ RESOLVED

**User confirmed:** Approver must be the employee's actual manager, enforced in app code.

**Resolution:** Added scope enforcement note to LEAVE_WORKFLOW.md Level 1 section: "The backend validates that `leave_approvals.approver_id` matches `user.manager_id` for Level 1 approvals. Enforced in NestJS guard, not as a database constraint."

---

### 16. ~~No Specification for DRAFT Status~~ RESOLVED

**User confirmed:** Remove DRAFT from the enum.

**Resolution:**
- DATABASE_SCHEMA.md — Removed `'DRAFT'` from `leave_requests.status` CHECK constraint
- LEAVE_WORKFLOW.md — Removed DRAFT row from status table

---

### 17. ~~Timezone Handling Undefined~~ RESOLVED

**Resolution:** `sla.timezone = Asia/Kolkata` added to MASTER_DATA.md + DATABASE_SCHEMA.md.

---

### 18. ~~Compensation Report vs. High Usage Report Overlap~~ RESOLVED

**User confirmed:** Keep only the High Usage Report (now renamed Leave Balance Report). Remove Compensation Report entirely.

**Resolution:**
- API_CONTRACTS.md — Removed `GET /admin/reports/compensation` and its export endpoint
- PLAN.md — Removed Compensation Eligibility from reports table and MVP scope

---

### 19. ~~Leave Balance Constraint May Block Legitimate Scenarios~~ RESOLVED

**User confirmed:** Admin can edit `annual_days` mid-year.

**Resolution:** Removed `CHECK (used_days + pending_days <= total_days)` from `leave_balances` in DATABASE_SCHEMA.md. Balance validation enforced in application code instead.

---

### 20. ~~No Password/Credential Recovery Flow~~ RESOLVED

**Resolution:** Accepted limitation for Phase 1.

---

## Minor Issues & Suggestions

### 21. ~~`master_public_holidays.updated_at` Missing~~ RESOLVED

**Resolution:** `updated_at` column added to DATABASE_SCHEMA.md.

---

### 22. ~~Notification Count Endpoint Missing from API_CONTRACTS.md~~ RESOLVED

**Resolution:** `GET /notifications/count` added to API_CONTRACTS.md.

---

### 23. ~~`leave_balances` CHECK Constraint — Pending Days After Cancellation~~ RESOLVED

**User confirmed:** Cancelled leave balance must be restored (already documented). Race condition handled via row-level locking.

**Resolution:**
- LEAVE_WORKFLOW.md — Added "Concurrency — Row-Level Locking" section with `SELECT FOR UPDATE` pattern for all 5 balance-mutating operations
- OPEN_QUESTIONS.md — Extended race condition section with cancellation/approval serialization details

---

### 24. ~~Mobile App — Manager/Admin Flows Undefined~~ RESOLVED

**Resolution:** Manager approval flows added to FRONTEND_DESIGN.md.

---

### 25. ~~`DELETE /leave/requests/:id` Should Be `PATCH`, Not `DELETE`~~ RESOLVED

**User confirmed:** Use PATCH with status CANCELLED, no DELETE.

**Resolution:**
- API_CONTRACTS.md — Changed to `PATCH /leave/requests/:id/cancel`
- LEAVE_WORKFLOW.md — Updated API endpoint table

---

### 26. ~~Report PDF Generation Library Unspecified~~ RESOLVED

**User confirmed:** Use `pdfkit`.

**Resolution:** API_CONTRACTS.md updated: "PDF exports use `pdfkit` for server-side PDF generation."

---

### 27. ~~`master_departments.code` Should Be UNIQUE~~ RESOLVED

**Resolution:** `UNIQUE` constraint added in DATABASE_SCHEMA.md.

---

### 28. ~~No Rate Limiting Specified~~ RESOLVED

**User confirmed:** Use industry-standard rate limiting.

**Resolution:** Added "Rate Limiting" section to API_CONTRACTS.md using `@nestjs/throttler`:
- Global: 100 req/min
- Auth: 10 req/min
- Uploads: 20 req/5min
- Notifications: 60 req/min

---

### 29. ~~`leave_requests.cancelled_by` Should Allow Admin Reference~~ RESOLVED

**Resolution:** `cancelled_by_usertype` column added to DATABASE_SCHEMA.md (merged with Issue #8).

---

### 30. ~~Mobile Push Notifications Not Addressed~~ RESOLVED

**User confirmed:** Use FCM (Firebase Cloud Messaging) in Phase 1.

**Resolution:** FCM push notifications added across 7 files:
- PLAN.md — Added to tech stack + Phase 1 scope
- DATABASE_SCHEMA.md — `users.fcm_token`, `notifications.push_sent` + `push_sent_at`
- NOTIFICATIONS.md — Full "Push Notifications (FCM)" section with dispatch flow, token registration, config, fallback
- API_CONTRACTS.md — `PATCH /users/me/fcm-token` endpoint
- FRONTEND_DESIGN.md — Mobile FCM section (foreground/background, token refresh)
- MASTER_DATA.md — Note that push piggybacks on `in_app`/`both` channel

---

## Summary

| Severity | Total | Resolved | Open |
|----------|-------|----------|------|
| Critical (must fix before dev) | 5 | **5** | **0** |
| Inconsistencies across docs | 6 | **6** | **0** |
| Design gaps / missing specs | 9 | **9** | **0** |
| Minor issues / suggestions | 10 | **10** | **0** |
| **Total** | **30** | **30** | **0** |

### All 30 issues resolved. Documentation is ready for development.

### Files modified across all review passes:
| File | Changes Applied |
|------|----------------|
| DATABASE_SCHEMA.md | `created_by` nullable, `users.updated_at`, `users.fcm_token`, `admin_users.password_hash`, `master_leave_types.name→label`, `master_departments.code UNIQUE`, `master_public_holidays.updated_at`, `sla.timezone`, `leave_approvals.reminder_deadline`, `submitted_by→users(id)`, `cancelled_by_usertype`, DRAFT removed, balance CHECK removed, `notifications.push_sent/push_sent_at`, bootstrapping rewrite |
| MASTER_DATA.md | Base Schema Exceptions, `sla.timezone`, `name→label`, event_keys with role suffixes, FCM channel note |
| AUTH_REGISTRATION.md | Admin auth flow, `POST→GET` callback fix |
| LEAVE_WORKFLOW.md | ESCALATED transitions, DRAFT removed, `DELETE→PATCH` cancel, manager scope note, `SELECT FOR UPDATE` concurrency section |
| API_CONTRACTS.md | `name→label`, notification count endpoint, `DELETE→PATCH` cancel, report rename + compensation removal, pdfkit, rate limiting, `PATCH /users/me/fcm-token` |
| NOTIFICATIONS.md | SLA engine deadline-based rewrite, event_keys with role suffixes, FCM push notifications section |
| FRONTEND_DESIGN.md | Mobile manager approval tab, FCM push notifications |
| PLAN.md | Credentials removed, report rename + compensation removal, FCM in tech stack + MVP scope |
| OPEN_QUESTIONS.md | `lt.name→lt.label`, balance race condition SELECT FOR UPDATE details |
