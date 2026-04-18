# PAYROLL_RBAC.md

**Scope:** Role-based access control for the payroll module. Layered on top of the existing leave module RBAC defined in `ADMIN_RBAC.md`.
**Version:** v2.3

Cross-refs:
- Existing roles → `ADMIN_RBAC.md` (leave module)
- Endpoints protected by these permissions → `PAYROLL_API_CONTRACTS.md`
- Audit event catalog → `PAYROLL_DATABASE_SCHEMA.md` §11

---

## 1. Roles Inventory (Inherited + Extended)

The payroll module does **not** introduce new roles. It reuses and extends the existing role set. Every user has exactly one role.

| Role | Existing in Leave? | Payroll scope |
| --- | --- | --- |
| `SUPER_ADMIN` | Yes | Full payroll access, plus exclusive rights (master config, ESIC toggle, bank file approval) |
| `HR_MANAGER` | Yes | Can run full payroll lifecycle; cannot edit master tables or approve bank transfer file |
| `REPORTS_ADMIN` | Yes | Read-only access to payroll reports; no payroll run mutations |
| `EMPLOYEE` | Yes (default) | Self-service only: own payslips, own YTD, own investment proofs, own bank change request |

> **v2.3 (Review item I6) — Role naming reconciliation:**
> - Leave module's `HR Admin` = Payroll module's `HR_MANAGER`. Same role, same DB row — the payroll docs use the enum code (`HR_MANAGER`) while the leave BRD uses the display name ("HR Admin").
> - Leave module's `Manager` = a user with `is_manager = true`. This is NOT a separate role for payroll purposes — managers have `EMPLOYEE`-level payroll access only.
> - Leave module's `Leave Admin` has **zero payroll permissions**. Leave Admin can only manage `master_leave_types` and read leave data — no payroll visibility.

Leave-module roles `LEAVE_APPROVER`, `MANAGER`, and `LEAVE_ADMIN` are **not** granted any payroll permissions by default. A manager approving leave does not thereby gain payroll visibility.

## 2. Payroll Permissions Catalog

Permissions use the format `payroll.<resource>.<action>`. Each is a distinct check — no transitive grants.

### 2.1 Configuration & Master Data Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.salary.view` | View an employee's salary config | ✅ | ✅ | ❌ | self only |
| `payroll.salary.edit` | Set/edit employee gross + incentives | ✅ | ✅ | ❌ | ❌ |
| `payroll.master.components.edit` | Change salary component % (Basic 50, HRA 20...) | ✅ | ❌ | ❌ | ❌ |
| `payroll.master.statutory.edit` | Change PF cap, PT amount, OT rates | ✅ | ❌ | ❌ | ❌ |
| `payroll.master.esic.toggle` | Activate/deactivate ESIC module | ✅ | ❌ | ❌ | ❌ |
| `payroll.master.bank_format.edit` | Configure bank file format templates | ✅ | ❌ | ❌ | ❌ |
| `payroll.master.company.edit` | Edit company profile (address, footer, logo) | ✅ | ❌ | ❌ | ❌ |

### 2.2 Payroll Run Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.run.view` | View any payroll run and its items | ✅ | ✅ | ✅ (read-only) | ❌ |
| `payroll.run.create` | Create new run (Step 1) | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.import` | Trigger leave/OT import (Step 2) | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.calculate` | Trigger calculation (Step 3) | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.edit_items` | Edit individual employee line in Review (Step 4) — incentive, TDS, loan, sal deduction, security return | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.add_bonus` | Add bonus/one-time entries *(Phase 2 — seeded but not enforced in MVP; see Review G4)* | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.lock` | Lock payroll (Step 5a) — irreversible | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.release` | Release payslips (Step 5b) | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.cancel` | Cancel a run (pre-lock only) | ✅ | ✅ | ❌ | ❌ |
| `payroll.run.reimport` | Discard current data and re-import | ✅ | ✅ | ❌ | ❌ |

### 2.3 Payslip Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.payslip.view_any` | View any employee's payslip PDF | ✅ | ✅ | ❌ | ❌ |
| `payroll.payslip.view_own` | View own payslip | ✅ | ✅ | ✅ | ✅ |
| `payroll.payslip.preview` | Preview unreleased (watermarked) payslip | ✅ | ✅ | ❌ | ❌ |
| `payroll.payslip.retry_email` | Manually retry email delivery | ✅ | ✅ | ❌ | ❌ |

### 2.4 Bank Transfer File Permissions *(Super Admin only per D14)*

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.bank_file.preview` | Preview bank transfer file contents | ✅ | ✅ (read-only) | ❌ | ❌ |
| `payroll.bank_file.approve` | **Approve** bank transfer file for generation | ✅ | ❌ | ❌ | ❌ |
| `payroll.bank_file.generate` | Generate + download the actual file | ✅ | ❌ | ❌ | ❌ |

**Why:** The bank transfer file moves real money. Separating approval from payroll release (even for Super Admin + HR Manager) creates an additional checkpoint. D14 specifies **admin approval mandatory** — and since this action has the largest blast radius in the whole system, it is restricted to the most senior role only.

### 2.5 Employee Bank Change Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.bank_change.submit` | Submit a bank detail change request | ❌ | ❌ | ❌ | ✅ (own only) |
| `payroll.bank_change.view_any` | View any employee's bank change requests | ✅ | ✅ | ❌ | ❌ |
| `payroll.bank_change.approve` | Approve bank change | ✅ | ✅ | ❌ | ❌ |
| `payroll.bank_change.reject` | Reject bank change with reason | ✅ | ✅ | ❌ | ❌ |

### 2.6 Investment Proof Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.investment_proof.upload` | Upload own proof | ❌ | ❌ | ❌ | ✅ |
| `payroll.investment_proof.view_own` | View own uploaded proofs | ✅ | ✅ | ✅ | ✅ |
| `payroll.investment_proof.view_any` | View any employee's proofs | ✅ | ✅ | ❌ | ❌ |
| `payroll.investment_proof.delete_own` | Remove own proof | ❌ | ❌ | ❌ | ✅ |

### 2.7 Reports Permissions

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.report.salary_register` | Salary Register report | ✅ | ✅ | ✅ | ❌ |
| `payroll.report.department_cost` | Department Cost report | ✅ | ✅ | ✅ | ❌ |
| `payroll.report.payroll_summary` | Payroll Summary (M/Q/Y) | ✅ | ✅ | ✅ | ❌ |
| `payroll.report.compliance` | Compliance report | ✅ | ✅ | ✅ | ❌ |
| `payroll.report.export_csv` | Export report as CSV | ✅ | ✅ | ✅ | ❌ |
| `payroll.report.export_pdf` | Export report as PDF | ✅ | ✅ | ✅ | ❌ |

### 2.8 Employee Self-Service Permissions (`/me` endpoints)

| Permission | Description | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.me.salary.view` | View own current salary structure | ✅ | ✅ | ✅ | ✅ |
| `payroll.me.payslips.list` | List own past payslips | ✅ | ✅ | ✅ | ✅ |
| `payroll.me.payslips.download` | Download own payslip PDF | ✅ | ✅ | ✅ | ✅ |
| `payroll.me.ytd.view` | View own YTD totals | ✅ | ✅ | ✅ | ✅ |
| `payroll.me.ot_tracker.view` | View own OT hours summary | ✅ | ✅ | ✅ | ✅ |

## 3. Full Permission → Role Matrix (Consolidated)

The 10 **consolidated** payroll permissions from BRD §8 map to finer-grained permissions above as follows:

| BRD Permission | Fine-grained perms | SUPER_ADMIN | HR_MANAGER | REPORTS_ADMIN |
| --- | --- | --- | --- | --- |
| Set/edit employee gross and incentives | `payroll.salary.edit` | ✅ | ✅ | ❌ |
| Run payroll (all 5 steps) | `run.create`, `run.import`, `run.calculate`, `run.edit_items` | ✅ | ✅ | ❌ |
| Lock and release payroll | `run.lock`, `run.release` | ✅ | ✅ | ❌ |
| Add bonus / manual TDS / loan entries | `run.add_bonus`, `run.edit_items` | ✅ | ✅ | ❌ |
| Configure salary component percentages | `master.components.edit` | ✅ | ❌ | ❌ |
| Activate/deactivate ESIC module | `master.esic.toggle` | ✅ | ❌ | ❌ |
| Generate and export all reports | `report.*`, `report.export_csv`, `report.export_pdf` | ✅ | ✅ | ✅ |
| View any employee payslip | `payslip.view_any` | ✅ | ✅ | ❌ |
| Approve bank detail changes | `bank_change.approve`, `.reject` | ✅ | ✅ | ❌ |
| View compliance report | `report.compliance` | ✅ | ✅ | ✅ |
| **+ Bank transfer file approval (D14)** | `bank_file.approve`, `.generate` | ✅ | ❌ | ❌ |

## 4. Permission Enforcement

### 4.1 Backend — NestJS Guards

Every payroll controller method is annotated with a permission decorator:

```typescript
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
@RequirePermission('payroll.run.lock')
@Post('runs/:runId/lock')
async lockRun(@Param('runId') runId: string, @User() user: AuthUser) { ... }
```

The `PayrollPermissionGuard`:
1. Reads the required permission from the decorator.
2. Looks up the user's role.
3. Checks the role→permission matrix (stored as a JSON map in code, generated from this file).
4. For `*_own` and `me.*` permissions, also verifies `user.id` matches the resource owner.
5. Logs the access decision to the audit log (even denials for security monitoring).

### 4.2 Frontend — UI Gating

The permission matrix is exposed via `GET /api/v1/me/permissions` (shared with leave module). The frontend gates buttons, menu items, and nav entries using this set. Gating is a UX convenience — the server is always the source of truth.

### 4.3 Scope Checks (Self vs. Any)

For permissions like `payslip.view_own` vs `payslip.view_any`, the API routes are distinct (`/me/payslips` vs `/payslips/:userId`). Self-only endpoints derive `user_id` from JWT, not from URL, to prevent IDOR.

## 5. Audit Event Catalog

Every permission check that results in a mutation writes an audit event via `nestjs-audit-logger`. Read operations are logged only if admin-reading-another-employee (sensitive read).

| Event | Triggered by | Actor | Target |
| --- | --- | --- | --- |
| `payroll.salary.config_updated` | Admin edits employee salary | admin_id | user_id |
| `payroll.run.created` | Step 1 | admin_id | run_id |
| `payroll.run.imported` | Step 2 | admin_id | run_id |
| `payroll.run.calculated` | Step 3 | admin_id | run_id |
| `payroll.run.snapshot_overridden` | Step 2b snapshot override *(v2.3)* | admin_id | run_id + user_id |
| `payroll.run.item_edited` | Step 4 individual edit | admin_id | run_id + user_id |
| `payroll.run.locked` | Step 5a | admin_id | run_id |
| `payroll.run.released` | Step 5b | admin_id | run_id |
| `payroll.run.cancelled` | Cancel | admin_id | run_id |
| `payroll.payslip.sent` | Payslip email sent | system (or admin on retry) | run_id + user_id |
| `payroll.payslip.retried` | Manual retry | admin_id | run_id + user_id |
| `payroll.payslip.viewed_by_admin` | Admin views an employee's payslip (sensitive read) | admin_id | user_id |
| `payroll.bank_change.submitted` | Employee submits | user_id | user_id |
| `payroll.bank_change.approved` | Admin approves | admin_id | bank_change_id |
| `payroll.bank_change.rejected` | Admin rejects | admin_id | bank_change_id |
| `payroll.bank_file.approved` | Bank file approval (D14) | super_admin_id | run_id |
| `payroll.bank_file.downloaded` | Bank file generated/downloaded | super_admin_id | run_id |
| `payroll.master.component_updated` | Salary components changed | super_admin_id | (master table) |
| `payroll.master.statutory_updated` | Statutory config changed | super_admin_id | (master table) |
| `payroll.master.esic_toggled` | ESIC activation flip | super_admin_id | (master table) |
| `payroll.investment_proof.uploaded` | Employee uploads proof | user_id | user_id |
| `payroll.report.generated` | Report run (any type) | actor_id | report_type + filters |
| `payroll.report.exported` | Report exported (CSV/PDF) | actor_id | report_type + format |

All events include `ip_address`, `user_agent`, `timestamp`, and `request_id` (for tracing).

## 6. Role Assignment Rules

- A user's role is set by a Super Admin from the User Management screen (exists in leave module).
- Role changes are audited with event `user.role_changed` (event already exists in leave module).
- When a user is demoted (e.g., HR Manager → Employee), any active payroll run they are driving is **not** interrupted — the run continues, but subsequent actions require another user with the right role.
- When a user is promoted to HR Manager or Super Admin, they gain permissions immediately on next token refresh.

## 7. Separation of Duties — Recommended Operational Practice

These are **recommendations** for the client, not enforced by software:

1. **Payroll release vs. bank file approval** — ideally performed by two different people. The system allows a single Super Admin to do both, but the two distinct actions with two audit events make it visible if the same person performs both.
2. **Master component changes** — should be batched and approved out-of-band (e.g., board resolution) before Super Admin applies them. The system logs the change, so an after-the-fact audit can trace back.
3. **ESIC activation** — this is a significant compliance event. Super Admin should coordinate with legal/compliance team before toggling. The confirmation phrase (`payroll.master.esic.toggle`) is a speed bump, not an approval.

## 8. What's Not in RBAC (Out of Scope)

- Time-based permissions (e.g., "HR Manager can edit run only during working hours") — not implemented.
- Delegation (e.g., "HR Manager delegates to another HR Manager for a week") — not implemented.
- Department-scoped payroll (e.g., "HR Manager X can only run payroll for Engineering department") — all HR Managers see all departments in MVP.

These can be added post-MVP without RBAC schema change — only the matrix expands.

## 9. Migration / Seeding

On first deploy:

1. Existing `SUPER_ADMIN` users automatically gain all payroll permissions.
2. Existing `HR_MANAGER` users automatically gain HR Manager payroll permissions.
3. `REPORTS_ADMIN` role (if not already present in leave module) is created and assigned to any user currently flagged as reports-only; else no one has this role until Super Admin assigns it.
4. All `EMPLOYEE` users gain `/me` permissions automatically.

---

*End of PAYROLL_RBAC.md. Next: PAYROLL_NOTIFICATIONS.md — email templates.*
