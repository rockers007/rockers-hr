# Open Questions & Pre-Development Review

**Date:** March 2026
**Status:** ✅ All 6 questions resolved — confirmed by HRBhrugisha V. Decisions propagated into `LEAVE_WORKFLOW.md`, `NOTIFICATIONS.md`, `AUTH_REGISTRATION.md`, `DATABASE_SCHEMA.md`, and `API_CONTRACTS.md`.

---

## Resolved Questions — Decisions & Impact

### Q1 — SLA Clock Type ✅ RESOLVED
**Decision:** Business hours only (not 24-hour calendar clock).

**Definition of business hours:**
- Monday–Friday, 9:00 AM – 6:00 PM
- Public holidays excluded (using `master_public_holidays` for the year)
- `master_sla_config: sla.clock_type = business`

**Impact on SLA engine:**
- The SLA job must calculate elapsed business hours, not wall-clock hours.
- A request submitted at 5:00 PM on a Friday has only 1 business hour consumed before the weekend. The 5-hour window resumes Monday at 9:00 AM.
- Business hours start/end times added to `master_sla_config` as `sla.business_hours_start` (default `09:00`) and `sla.business_hours_end` (default `18:00`).

See updated `NOTIFICATIONS.md` for the revised SLA engine algorithm.

---

### Q2 — Fallback Approver for Escalation ✅ RESOLVED
**Decision:** Escalate directly to HR Admin. Additionally, the employee creation form (both self-registration and admin direct) must include a **"Is Manager" checkbox** — this designates the employee as eligible to be selected as a manager for other employees.

**Two changes required:**

1. **`users` table:** Add `is_manager BOOLEAN NOT NULL DEFAULT false`. This flag is set via the employee's profile, visible only to HR Admin.

2. **Registration form:** HR Admin sees an "Is Manager" toggle when activating or directly adding an employee. The `manager_id` field on other employees only shows users where `is_manager = true`.

3. **Fallback rule:** If `leave_request.user.manager_id IS NULL`, the SLA engine skips Level 1 entirely — the request goes directly to `PENDING_L2` and HR is notified as the first approver.

See updated `DATABASE_SCHEMA.md` and `LEAVE_WORKFLOW.md`.

---

### Q3 — Leave Cancellation Policy ✅ RESOLVED
**Decision:**
- Employees **can cancel any leave** — PENDING or APPROVED — as long as the **leave start date has not yet passed** (i.e., `start_date > today`).
- No admin approval step required for cancellation.
- On cancellation of an APPROVED leave: the Google Calendar event is deleted via the Calendar API.
- Balance is fully restored: `used_days -= working_days` (if APPROVED) or `pending_days -= working_days` (if PENDING).
- A cancelled leave cannot be reinstated — employee must submit a new request.

**New state transition added:**
```
PENDING_L1 → CANCELLED   (employee cancels before manager acts)
PENDING_L2 → CANCELLED   (employee cancels before HR acts)
APPROVED   → CANCELLED   (employee cancels before start_date)
```

**Cannot cancel:** Leaves where `start_date <= today`. The cancel button is hidden/disabled in this case.

See updated `LEAVE_WORKFLOW.md` and `API_CONTRACTS.md`.

---

### Q4 — Compensation Eligibility Threshold ✅ RESOLVED
**Decision:** An employee is flagged as **compensation eligible** if they have **any unused leave balance remaining at year-end** — i.e., `available_days > 0` for any leave type as of December 31.

The policy is "use all leave or it is gone" — employees with any unused days are flagged so HR can decide on year-end remuneration treatment. The report shows every such employee with a per-type breakdown of unused days.

**Report logic:**
```sql
SELECT u.name, lt.label as leave_type,
       lb.total_days - lb.used_days - lb.pending_days as unused_days
FROM leave_balances lb
JOIN users u ON u.id = lb.user_id
JOIN master_leave_types lt ON lt.id = lb.leave_type_id
WHERE lb.year = EXTRACT(YEAR FROM now())
  AND (lb.total_days - lb.used_days - lb.pending_days) > 0
  AND u.is_active = true
ORDER BY u.name, lt.sort_order;
```

See updated `API_CONTRACTS.md` — reports endpoint response shape updated.

---

### Q5 — Audit Log Library Selection ✅ RESOLVED
**Decision:** `nestjs-audit-logger`

**Installation:** `npm install nestjs-audit-logger`

**Integration approach:** Wire as a NestJS module in `AppModule`. Configure to write to the existing `audit_log` PostgreSQL table (custom adapter — the library supports custom storage backends). All write operations on business tables and master tables are automatically intercepted.

**Key config:**
```typescript
AuditLoggerModule.forRoot({
  storage: PostgresAuditStorage,   // custom adapter wrapping TypeORM repo
  excludeRoutes: ['GET'],          // read operations not logged
  captureBody: true,               // before/after JSONB state
  captureIp: true,
})
```

See updated `DATABASE_SCHEMA.md` for the confirmed `audit_log` table schema.

---

### Q6 — Calendar Event Title Format ✅ RESOLVED (low priority)
**Decision:** Use the format already in `master_sla_config`:

```
[{{leave_type}}] {{employee_name}}
```

Example: `[Casual Leave] Priya Sharma`

No change needed. Confirmed as-is.

---

## Architecture Observations

### ✅ Things That Are Well-Designed

**100% dynamic master data** — The decision to make every dropdown a runtime database fetch is architecturally sound and differentiates this system from typical HR tools. The single generic NestJS master controller pattern (`/master/:table`) is elegant and maintainable.

**Admin superset model** — The explicit "admin is a strict superset of employee" principle, with on-behalf actions always routed through the same business rule layer, means no separate code paths for admin vs. employee actions. Fewer bugs, simpler testing.

**Probation as a time-window rule** — Storing `confirmation_date` on the user and computing probation status at request time (rather than a flag that must be manually flipped) means probation auto-expires correctly with no cron job or manual action needed.

**Carry-over always zero enforced at schema level** — The `CHECK (carry_over = 0)` constraint in `master_leave_types` is the right call. It makes the global policy machine-enforced, not just convention.

**Soft deletes everywhere** — Essential for an HR system where historical integrity matters. The design correctly uses `is_active` instead of `DELETE` on all tables.

---

### ⚠️ Things That Need Attention Before Coding

**1. Balance race condition under concurrent submissions**

If two leave requests for the same employee are submitted simultaneously, both may pass the balance check before either commits. Solution: use a PostgreSQL `SELECT FOR UPDATE` on the `leave_balances` row during the balance check + insert transaction.

```sql
BEGIN;
SELECT * FROM leave_balances
WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
FOR UPDATE;
-- check available_days
UPDATE leave_balances SET pending_days = pending_days + $4 WHERE ...;
INSERT INTO leave_requests ...;
COMMIT;
```

This must be implemented in the first version of `LeaveService.createRequest()`.

**This pattern also applies to cancellation and approval flows:**
- Cancellation restores balance: `pending_days -= working_days` (if PENDING) or `used_days -= working_days` (if APPROVED)
- If the SLA escalation job and a cancellation target the same request simultaneously, `SELECT FOR UPDATE` ensures they serialize correctly
- All balance-mutating operations in `LeaveService` must wrap the read + update in a single transaction with row-level locking

---

**2. Master data cache invalidation on frontend**

The spec says "cache locally for the session." This creates a UX problem: if an admin deactivates a leave type mid-day, employees already in-session still see it in their dropdown until they refresh.

**Recommended approach:**
- Cache with a 5-minute TTL (not forever-for-session)
- On admin CRUD operations on master tables: the backend sets a cache-busting header or bumps a `master_data_version` key in `master_sla_config`
- Frontend checks version on each API call; if version changed, re-fetch master data

This is a medium-complexity addition. If not implemented in Phase 1, document clearly that a hard page refresh resolves stale dropdowns.

---

**3. Google OAuth token storage for Calendar API**

The Calendar API requires an OAuth access token with `calendar.events` scope — different from the user login token. This token needs to be stored (refresh token for long-lived access).

**Design question:** Whose Google Calendar receives the event?
- If it is an HR-managed Google Calendar: one set of credentials, stored server-side in env vars or Secrets Manager.
- If it is the employee's personal calendar: each employee must grant calendar permission (a second OAuth step), and their refresh token must be stored in the `users` table.

**Recommended (simpler):** HR-owned shared Google Calendar. One set of server-side credentials. Employee is added as an attendee (they get a calendar invite). No per-user token storage.

Confirm this interpretation before building the calendar integration.

---

**4. File upload: direct S3 vs. server-proxied**

The design specifies pre-signed S3 URLs (direct browser-to-S3 upload). This is the correct approach for scalability. However, the NestJS server still needs to validate MIME type and size **before** issuing the pre-signed URL — it cannot trust the browser to enforce these.

The NestJS endpoint `POST /uploads/presigned` must:
1. Accept `{ mime_type, file_size_bytes, context }`
2. Query `master_file_types` for the context
3. Validate mime_type is in the allowed list for that context
4. Validate file_size_bytes ≤ max_size_mb × 1024 × 1024
5. Only if valid → issue pre-signed URL
6. Never trust a second upload URL from the client for a different MIME type

This is straightforward but must be built first, before any upload UI.

---

**5. Annual balance proration formula**

When an employee joins mid-year, balances are prorated. The formula in `AUTH_REGISTRATION.md` is:

```
prorated_days = annual_days × (months_remaining_in_year / 12)
```

Edge cases to clarify:
- Is it months remaining as of join date (Jan 1 = 12, Dec 1 = 1)?
- Or remaining working months (excluding current month if joining mid-month)?
- Rounding: nearest 0.5 or round down?

Recommend: months remaining from the **start of the next full month** after join date, rounded to nearest 0.5. Confirm with HR before implementing `balance.create` in the user activation flow.

---

## Testing Strategy

### Unit Tests (NestJS)

- Master data service: generic CRUD for all 11 tables, table allowlist validation
- Leave service: working-days calculation, sandwich detection, balance check, all validation rules
- SLA engine: reminder timing, escalation timing, config reads at runtime
- Notification service: token rendering, template not found gracefully, channel routing

### Integration Tests

- Full leave submission → L1 approval → L2 approval → calendar event sequence
- SLA escalation: submit → wait past window → verify escalation fires
- Admin on-behalf: submit + verify audit log has `on_behalf_of_user_id` set
- Master data: deactivate leave type → verify it no longer appears in `/master/leave_types`

### E2E Tests (Playwright or Cypress)

- Employee registration flow (Gmail OAuth mock → form → pending → activation)
- Leave application 3-step form (sandwich detection, document upload, submit)
- Manager approval panel (approve + decline with reason)
- Admin master data CRUD (add leave type → verify in employee dropdown)
- Report generation and CSV export

---

## Action Items for Sprint 0

| Owner | Action | Priority |
|-------|--------|----------|
| Rakesh | Set up NestJS project with PostgreSQL connection, TypeORM, JWT auth scaffolding | P0 |
| Rakesh | Implement master data module (generic CRUD for all 11 tables) | P0 |
| Rakesh | Seed all master tables with default values | P0 |
| Rakesh | Implement `POST /uploads/presigned` with `master_file_types` validation | P1 |
| Rakesh | Decide on audit log approach (custom interceptor recommended) | P1 |
| Rakesh | Set up Next.js project with route structure + MasterDataContext | P1 |
| HRBhrugisha | Confirm Q1 (SLA clock type) and Q3 (leave cancellation policy) | Before Sprint 2 |
| HRBhrugisha | Confirm Q2 (fallback approver) | Before Sprint 3 |
| HRBhrugisha | Confirm Q4 (compensation threshold) | Before Sprint 5 |
| Both | Confirm Google Calendar approach (shared HR calendar vs. employee calendars) | Before Sprint 4 |
| Both | Confirm balance proration formula for mid-year joiners | Before Sprint 1 |
