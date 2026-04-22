# Rockers HR — HR Management System

## Project Specification

---

## 1. Vision

Rockers HR HR Management System is a full-stack HR platform for managing employee leave end-to-end — from admin-invite registration (email + password) through two-level approval, SLA enforcement, Google Calendar sync, and admin analytics. Google OAuth is retained as a fallback for employees who registered under the legacy self-signup flow, but new employees are invited by an admin. It is built on a **100% dynamic, zero-hardcoded architecture**: every dropdown, every policy value, and every notification template lives in a PostgreSQL master table managed by HR admins. No leave type, no department, no gender option is ever baked into source code.

The system runs on three surfaces: a Next.js web app (employee portal + HR admin panel), a Flutter mobile app (iOS & Android), and a shared NestJS REST API.

---

## 2. Core Principle

> **Nothing is hardcoded anywhere.**

Every dropdown value, every selection list, and every configurable option is stored in a PostgreSQL master table and served via `/master/:table` API endpoints at runtime. This applies to: leave types, qualification options, gender options, employee role types, leave duration types, departments, file-type allowlists, notification templates, SLA windows, and public holidays.

Adding a new leave type, a new department, or changing an SLA window requires **zero developer involvement** — the HR Admin or Super Admin does it directly from the admin panel.

---

## 3. User Roles

| Role | Description |
|------|-------------|
| **Employee** | Applies for leave, tracks balance, views history, receives notifications |
| **Manager** | All employee capabilities + approves/declines team leave requests (Level 1) |
| **HR Admin** | Final approver (Level 2), manages all master data, generates reports |
| **Super Admin** | Full system access including system-level master tables and admin user management |
| **Leave Admin** | `master_leave_types` config only; read-only leave data |
| **Reports Admin** | View and export all reports; read-only |

> Admin roles are additive. Every action an employee can do, an admin can do — plus more. See `ADMIN_RBAC.md`.

---

## 4. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Web Frontend + Admin Panel | Next.js (React) | Role-gated routes split employee portal from HR admin panel |
| Mobile App | Flutter | iOS + Android from a single codebase |
| API Backend | NestJS (Node.js) | REST API; all master data via `/master/:table` endpoints |
| Database | PostgreSQL | All structured data including all 11 master tables |
| File Storage | AWS S3 | Allowed file types driven by `master_file_types` at runtime |
| Email | SMTP | Templates stored in `master_notification_templates` |
| Push Notifications | Firebase Cloud Messaging (FCM) | Mobile push via `firebase-admin` SDK; FCM token registered on app launch |
| Authentication | Admin-invite + email/password (primary, v2.0); Google OAuth 2.0 (legacy fallback for pre-existing Google users) | See `AUTH_REGISTRATION.md` |
| Calendar Integration | Google Calendar API | Read/Write; triggered at Level 2 (HR final) approval only |
| Audit Log | Open-source library | Rakesh to select; logs all write operations |

---

## 5. Directory Structure

```
rockers-hr/
├── frontend/                  # Next.js TypeScript project
│   ├── app/
│   │   ├── (employee)/        # Employee portal routes
│   │   └── (admin)/           # HR admin panel routes
│   └── components/
├── mobile/                    # Flutter project (iOS + Android)
│   └── lib/
│       ├── screens/
│       └── services/
├── backend/                   # NestJS project
│   └── src/
│       ├── master/            # Generic master data CRUD module
│       ├── auth/              # Google OAuth + JWT
│       ├── users/             # Employee registration + management
│       ├── leave/             # Leave requests + approvals
│       ├── notifications/     # Email + in-app notifications
│       ├── calendar/          # Google Calendar integration
│       ├── reports/           # Report generation (CSV + PDF)
│       └── audit/             # Audit log integration
├── planning/                  # This folder — agent shared contract
│   ├── PLAN.md                # This document
│   ├── MASTER_DATA.md         # All 11 master tables + API pattern
│   ├── AUTH_REGISTRATION.md   # Admin-invite + email/password (primary); Gmail OAuth (legacy)
│   ├── LEAVE_WORKFLOW.md      # Leave application + 2-level approval
│   ├── ADMIN_RBAC.md          # Admin roles + superset capabilities
│   ├── DATABASE_SCHEMA.md     # Full PostgreSQL schema
│   ├── API_CONTRACTS.md       # All endpoint specs + request/response shapes
│   ├── NOTIFICATIONS.md       # SLA engine + notification system
│   └── FRONTEND_DESIGN.md     # UI layout + component specs (web + mobile)
├── docker-compose.yml
├── .env.example
└── .gitignore
```

### Key Boundaries

- **`frontend/`** is a self-contained Next.js project. It never hardcodes dropdown values. All lists are fetched from `/master/:table` at page/app load. Role-gated routes: `/admin/*` requires an admin session.
- **`mobile/`** is a self-contained Flutter project. Master data is fetched on first launch and refreshed on pull-to-refresh or app resume.
- **`backend/`** owns all business logic. The master module is a generic NestJS module that handles all 11 tables with a single controller+service — the table name is a route parameter.
- **`planning/`** is the shared contract for all agents. No agent modifies another agent's assigned files.

---

## 6. Environment Variables

```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/rockers_hr

# Google OAuth 2.0
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=equity-next-demo
AWS_REGION=us-east-1
AWS_CLOUDFRONT_URL=https://dpki8af9tn90l.cloudfront.net/ 

# SMTP Email
SMTP_HOST=sh205.hostgator.in
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Rockers HR <hr.rockersinfo@gmail.com>"

# Google Calendar API
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# App
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_PORT=4000
```

### Behavior

- If `DATABASE_URL` is absent → app fails at startup with a clear error.
- If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are absent → OAuth login fails; error shown on login page.
- If `AWS_*` vars are absent → file upload endpoints return 503 with a clear message.
- If `SMTP_*` vars are absent → notifications are queued but not sent; logged as warnings.

---

## 7. Master Data Architecture (Summary)

Eleven master tables drive the entire application. All follow the same base schema: `id (UUID)`, `label`, `sort_order`, `is_active`, `created_by`, `created_at`, `updated_at`.

| Table | Controls |
|-------|---------|
| `master_qualifications` | Degree dropdown on registration |
| `master_genders` | Gender dropdown on registration |
| `master_role_types` | Role dropdown; drives permission system |
| `master_leave_types` | All leave categories, day allocations, policies |
| `master_leave_durations` | Full Day / Half Day; controls balance deduction |
| `master_departments` | Department field on profiles + report filters |
| `master_file_types` | All upload validation — MIME types + max size |
| `master_notification_templates` | All email + in-app content with token replacement |
| `master_sla_config` | SLA windows, reminder thresholds, probation duration |
| `master_public_holidays` | Working-day calculation + sandwich leave detection |
| `master_admin_roles` | Admin panel RBAC permission matrix |

> See `MASTER_DATA.md` for complete field specifications, seed values, and API patterns.

---

## 8. Leave Workflow (Summary)

```
Employee submits leave
        │
        ▼
Level 1 — Manager (SLA: 5h window from master_sla_config)
        │     │
        │     └── SLA reminder at 4h → auto-escalation to HR at 5h
        ▼
Level 2 — HR Final Approval
        │
        ▼
Google Calendar event created (Level 2 only)
+ Employee notification sent
```

**Key rules:**
- No carry-over for any leave type — unused leave expires December 31, resets January 1.
- Sandwich leave auto-detected using `master_public_holidays`.
- Probation period (default 3 months from `master_sla_config`) blocks leave applications.
- Working days exclude weekends + all dates in `master_public_holidays` for the year.

> See `LEAVE_WORKFLOW.md` for the complete state machine, validation rules, and edge cases.

---

## 9. API Design Principles

- All endpoints prefixed `/api/v1/`
- Master data: `GET /api/v1/master/:table` → returns active records for dropdown population
- Authentication: JWT Bearer token on all protected routes
- File uploads: multipart/form-data; validation against `master_file_types` at runtime
- All responses: `{ data, meta?, error? }` envelope
- Soft deletes only — no hard deletes on any table

> See `API_CONTRACTS.md` for every endpoint, request shape, and response shape.

---

## 10. Admin Superset

Admins are a strict superset of employees. Every employee action is also available to admins from the admin panel:

1. **Add/register employee directly** — without Gmail self-registration
2. **View any employee's full leave details and balances** — identical to the employee's own view
3. **Submit leave on behalf of any employee** — same business rules, full audit trail

> See `ADMIN_RBAC.md` for the complete permission matrix and on-behalf audit log specification.

---

## 11. Notifications & SLA

- All notification content lives in `master_notification_templates` with token placeholders (`{{employee_name}}`, `{{leave_type}}`, `{{dates}}`, etc.)
- Channels: Email (SMTP) + In-app (PostgreSQL-backed `notifications` table)
- SLA engine runs as a background job; checks pending approvals every minute
- Reminder sent at `sla.reminder_at_hours` (default 4h); escalation at `sla.manager_window_hours` (default 5h)

> See `NOTIFICATIONS.md` for the full event catalogue, token reference, and SLA engine design.

---
## 12. LLM Integration

When writing code to make calls to LLMs, use cerebras-inference skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. Structured Outputs should be used to interpret the results.

There is an OPENROUTER_API_KEY in the .env file in the project root.

### How It Works

When the user sends a chat message, the backend:

1. User can ask question related platfrom.
2. Constructs a prompt with a system message, portfolio context, conversation history, and the user's new message
3. Calls the LLM via LiteLLM → OpenRouter, requesting structured output, using the cerebras-inference skill
4. Parses the complete structured JSON response
5. Stores the message and executed actions in `chat_messages`
6. Returns the complete JSON response to the frontend (no token-by-token streaming — Cerebras inference is fast enough that a loading indicator is sufficient)

### Structured Output Schema

The LLM is instructed to respond with JSON matching this schema:

```json
{
  "message": "Your conversational response to the user"
}
```

- `message` (required): The conversational text shown to the user

### Auto-Execution

the error is included in the chat response so the LLM can inform the user.

### System Prompt Guidance

The LLM should be prompted as "Rockers - HR, an AI  assistant" with instructions to:
- Ask question related platform.
- Be concise and data-driven in responses
- Always respond with valid structured JSON

### LLM Mock Mode

When `LLM_MOCK=true`, the backend returns deterministic mock responses instead of calling OpenRouter. This enables:
- Fast, free, reproducible E2E tests
- Development without an API key
- CI/CD pipelines

---
## 13. Reports

| Report | Scope | Export |
|--------|-------|--------|
| Monthly Report | Leave days by type, approval rates, SLA compliance | CSV + PDF |
| Yearly Report | Annual trends, per-employee summary | CSV + PDF |
| Leave Balance Report | Employees with remaining unused leave balance | CSV |

---

## 14. MVP Scope

### ✅ Phase 1 — In Scope

- 100% dynamic master data (all 11 tables) managed via admin panel
- Gmail OAuth registration (any `@gmail.com`) — all dropdowns from master tables
- Employee profile with photo + resume upload to AWS S3
- HR Admin registration activation panel
- Leave application — all types, full day + half day
- Sandwich leave auto-detection
- Two-level approval workflow (Manager → HR) with SLA enforcement
- SLA auto-escalation and reminder notifications
- Google Calendar sync at Level 2 only
- SMTP email + in-app notifications using master templates
- FCM push notifications for Flutter mobile app
- HR Admin RBAC with 4 default roles
- Admin superset capabilities (direct add, view, submit on behalf)
- AWS S3 for all files, signed URLs, runtime MIME validation
- Open-source audit log for all write operations
- Monthly + yearly reports, CSV + PDF export
- Public holidays management

### ❌ Phase 2 — Out of Scope

- Payroll system integration
- SMS notifications
- Advanced analytics and custom report builder
- Multi-timezone and multi-language support
- Third-party API access layer
- Year-end remuneration calculation engine

---

## 15. Resolved Decisions (v1.6 → v1.7)

All open questions confirmed by HRBhrugisha V. Propagated into domain docs.

| Decision | Resolution |
|----------|-----------|
| SLA clock | **Business hours** — Mon–Fri, 09:00–18:00, public holidays excluded. Two new `master_sla_config` keys added: `sla.business_hours_start`, `sla.business_hours_end` |
| Fallback approver | **Direct to HR** when `manager_id IS NULL`. New `is_manager` flag on `users` table — HR Admin sets it on activation/edit to control who appears in the manager dropdown |
| Leave cancellation | **Yes — any leave** (PENDING or APPROVED) cancellable while `start_date > today`. No admin step. Calendar event deleted. Balance fully restored. |
| Compensation threshold | **Any unused balance > 0** = compensation eligible. Policy: use all leave or it expires. Report flags every employee with any remaining days at year-end. |
| Audit log library | **`nestjs-audit-logger`** with custom PostgreSQL storage adapter. |
| Calendar event title | **`[{{leave_type}}] {{employee_name}}`** confirmed as-is. |

---

## 16. Action Items

| Owner | Action | Status |
|-------|--------|--------|
| Rakesh Patel | Build NestJS master data module (generic CRUD for all 11 tables) + seed all master tables | Priority 1 — Start now |
| Rakesh Patel | Wire `nestjs-audit-logger` from day 1 — must be in place before any write endpoints | Priority 1 |
| Rakesh Patel | Build `POST /uploads/presigned` with `master_file_types` runtime validation | Priority 1 |
| Rakesh Patel | Implement SLA engine with business-hours elapsed calculation | Priority 2 |
| Rakesh Patel | Implement leave cancellation with Calendar event deletion | Priority 2 |
| Rakesh Patel | Build Next.js + Flutter master data API integration (runtime dropdown fetching) | Priority 2 |
| Rakesh Patel | Set up AWS S3 with `master_file_types`-driven validation | Priority 3 |
| Rakesh Patel | Build compensation eligibility report (`available_days > 0` threshold) | Priority 4 |
| HRBhrugisha V | After admin panel built: seed `master_qualifications`, `master_departments`, `master_leave_types` with real values | Post-dev |
| HRBhrugisha V | Seed `master_public_holidays` for current + next year before SLA engine goes live | Before launch |

---

*Rockers HR — HR Management System v1.7 | Updated from v1.6 BRD + confirmed decisions | Rakesh Patel & HRBhrugisha V*
