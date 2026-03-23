# Frontend Design — Web (Next.js) + Mobile (Flutter)

UI layout, component specifications, and interaction design for the employee portal, HR admin panel, and Flutter mobile app.

---

## Design System

### Color Palette

| Purpose | Value |
|---------|-------|
| Primary Brand | `#1e40af` (deep blue) |
| Accent | `#3b82f6` (blue) |
| Success / Approved | `#10b981` (green) |
| Danger / Declined | `#ef4444` (red) |
| Warning / Pending | `#f59e0b` (amber) |
| Escalated | `#8b5cf6` (purple) |
| Neutral Background | `#f8fafc` |
| Card Background | `#ffffff` |
| Border | `#e2e8f0` |
| Text Primary | `#1e293b` |
| Text Secondary | `#64748b` |

### Typography

- **Web:** Inter (Google Font)
- **Mobile:** System default (SF Pro on iOS, Roboto on Android)
- Font scale: 12px caption, 14px body, 16px default, 18px subtitle, 24px heading

### Status Badge Colors

| Status | Background | Text |
|--------|-----------|------|
| PENDING_L1 | `#fef3c7` | `#92400e` |
| PENDING_L2 | `#dbeafe` | `#1e40af` |
| APPROVED | `#d1fae5` | `#065f46` |
| DECLINED | `#fee2e2` | `#991b1b` |
| ESCALATED | `#ede9fe` | `#5b21b6` |
| CANCELLED | `#f1f5f9` | `#475569` |

---

## Web Application — Next.js

### Route Structure

```
/                    → Redirects: employee → /dashboard, admin → /admin/overview, unauthenticated → /login
/login               → Gmail OAuth entry point
/register            → Profile form (post-OAuth, first time only)
/register/pending    → "Under HR review" confirmation page

/dashboard           → Employee home
/apply               → Leave application (3-step flow)
/my-leaves           → Leave history list
/my-leaves/:id       → Single leave detail + approval timeline
/balance             → Leave balance cards
/calendar            → Team leave calendar
/profile             → View/edit own profile
/notifications       → All notifications (web)

/admin/overview              → HR Admin dashboard
/admin/registrations         → Pending HR review queue
/admin/employees             → Employee list + search
/admin/employees/:id         → Employee detail + leave data
/admin/employees/:id/apply   → Submit leave on behalf (Capability 3)
/admin/approvals             → Pending L2 approvals queue
/admin/calendar              → Team leave calendar (admin view)
/admin/master                → Master data hub
/admin/master/:table         → CRUD for each master table
/admin/reports               → Reports dashboard
/admin/reports/monthly       → Monthly report
/admin/reports/yearly        → Yearly report
/admin/reports/high-usage    → High usage alerts
/admin/audit-log             → Audit log viewer
/admin/system/admins         → Admin user management (Super Admin only)
```

**Route protection:**
- `/dashboard/*`, `/apply`, `/my-leaves/*`, `/balance`, etc. → `EmployeeGuard` (active employee JWT)
- `/admin/*` → `AdminGuard` (active admin JWT + `admin_users` record)
- `/admin/system/*` → additionally requires `system.manage_admins` permission

---

## Employee Portal — Key Screens

### 1. Employee Dashboard (`/dashboard`)

**Header:**
- Rockers HR logo + "Hi, [Name] 👋" greeting
- Notification bell with unread count badge
- Profile avatar → profile link

**Leave Balance Cards (top row):**
- One card per active leave type (from `master_leave_types`)
- Shows: leave type name (color-coded), days remaining / total, circular progress
- Data from `GET /leave/balance`

**Quick Apply Button:** Large CTA → `/apply`

**Active Requests Section:**
- Cards for PENDING_L1 and PENDING_L2 requests
- Shows: leave type, dates, days, current status + visual approval timeline (Step 1 ✓, Step 2 ...)
- Click → `/my-leaves/:id`

**Team on Leave Today:**
- List of colleagues currently on approved leave (from the same department)
- Avatar initials, name, leave type, dates

---

### 2. Leave Application (`/apply`) — 3-Step Flow

**Step 1 — Type & Dates:**
- Leave type selector (pill/card style, colored per `master_leave_types.color`)
  - Each shows current balance in brackets: "Casual (8d)"
  - Probation-ineligible types grayed out with tooltip
- Duration type selector: Full Day / First Half / Second Half (from `master_leave_durations`)
- From Date + To Date pickers
- **Live calculation panel** (calls `POST /leave/calculate` on date change):
  - Working days count
  - Balance before → after
  - Approval path (Manager → HR)
  - Sandwich leave warning banner (if detected)

**Step 2 — Reason & Document:**
- Reason textarea (required, min 10 chars)
- File upload area (drag & drop or click): shows if required, accepted types from master, max size
- Sandwich leave confirmation checkbox (visible only if detected in Step 1)

**Step 3 — Review & Submit:**
- Summary card: all details, cannot edit (click "Back" to change)
- Approval path display
- Balance preview: "After approval: X days remaining"
- **Submit button** → `POST /leave/requests`
- Loading state + success/error feedback

---

### 3. Leave History (`/my-leaves`)

**Filter bar:** Status chips (All / Pending / Approved / Declined / Cancelled), Year selector, Leave type filter

**Request list:** Cards with leave type color bar, dates, days, status badge, approval stage

**Single Leave Detail (`/my-leaves/:id`):**
- Full details card
- Approval timeline (vertical stepper):
  - Submitted (timestamp)
  - Level 1 — Manager: (Approved/Declined/Pending/Skipped — No Manager) with name and timestamp
  - Level 2 — HR: (Approved/Declined/Pending) with name and timestamp
- If declined: reason shown in a bordered callout
- If submitted by admin: "Submitted by Admin: [Admin Name]" banner
- If cancelled: "Cancelled on [date]" banner; approval timeline grayed out

**Cancel button:** Shown only when `can_cancel = true` (returned by API — `start_date > today` and status not terminal). Clicking shows a confirmation dialog: *"Are you sure you want to cancel your [Leave Type] leave from [dates]? Your balance will be restored."* — two buttons: Cancel Request (destructive, purple) / Go Back.

---

## HR Admin Panel — Key Screens

### 4. Admin Overview (`/admin/overview`)

**Stats row:** Total Employees, Pending Approvals (with overdue count), Leave Days This Month, SLA Compliance %

**Pending Approvals Table (quick view):**

| Employee | Type | Dates | SLA Remaining | Actions |
|----------|------|-------|--------------|---------|
| Priya S. | Casual | Jun 15–16 | 5h left | ✅ Approve / ✖ Decline |
| Arjun K. | Sick | Jun 12–13 | ⚠️ Overdue | ✅ ✖ |

**Leave Type Summary:** Bar chart of days taken per type this month

---

### 5. Master Data Hub (`/admin/master`)

**Gateway page:** Grid of cards, one per master table. Each card shows:
- Table display name
- Record count (active / total)
- Last updated timestamp
- "Manage" button → `/admin/master/:table`

### Master Table CRUD (`/admin/master/:table`)

**Layout:**
- Page title: "[Table Display Name] — Master Data"
- "+ Add New" button → inline form row at top of table
- Sortable table: Label, Sort Order, Status (Active/Inactive), Actions
- Drag handle for reordering sort_order
- Edit inline: click row → fields become editable
- Deactivate toggle: switches is_active (with confirmation dialog for leave types and role types)

**Leave Types table** has additional columns: Days/yr, Probation Allowed, Doc Required, Color swatch

**SLA Config table:** Key-value editor (key read-only, value editable inline)

---

### 6. Leave Calendar (`/admin/calendar` + `/calendar` for employees)

**Month view by default.** Week view toggle.

**Legend:** Color-coded chips for each leave type (colors from `master_leave_types`)

**Calendar cells:** Show employee names on leave that day. Click → popover with: name, leave type, dates, status (⏳ = pending, colored = approved)

**Filters (admin view only):** Department, Leave Type, Status

---

### 7. Reports (`/admin/reports/monthly`)

**Controls:** Month/Year selector, Department filter, Export buttons (CSV + PDF)

**Summary cards:** Total Days, Approved, Declined, High-Usage flags

**Leave by Type:** Horizontal bar chart (one bar per active leave type, color-coded)

**Monthly Trend Chart:** Line chart, Jan–current month

**SLA Performance:** Donut chart (Within SLA / Escalated / Breached)

**High Usage Table:** Employee, Days Used/Total, Remaining, Flag (Critical/High)

---

## Mobile App — Flutter

### Navigation

Bottom tab bar (5 tabs for employees, 6 for managers):

| Tab | Icon | Screen | Visibility |
|-----|------|--------|------------|
| Home | 🏠 | Employee dashboard | All users |
| Apply | 📤 | Leave application flow | All users |
| Approvals | ✅ | Pending approval queue | `role_type = manager` only |
| History | 📋 | My leave requests | All users |
| Calendar | 📅 | Team calendar | All users |
| Profile | 👤 | Profile + settings | All users |

> The **Approvals** tab is conditionally rendered based on the authenticated user's `role_type`. Employees see a 5-tab bar; managers see a 6-tab bar with the Approvals tab positioned after Apply. The Approvals tab icon shows an unread badge with the count of pending requests requiring action.

---

### Mobile: Home Screen

```
┌─────────────────────────────────────────┐
│  Hi, [Name] 👋           🔔 (badge)    │
│  [Department name]                      │
├─────────────────────────────────────────┤
│  Leave Balance                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  8   │ │  5   │ │  15  │ │  3   │  │
│  │Casual│ │Sick  │ │Paid  │ │Med   │  │
│  │/12   │ │/6    │ │/15   │ │/5    │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  [+ Apply for Leave]                    │
├─────────────────────────────────────────┤
│  Active Request (if any)                │
│  Casual Leave · Pending L1              │
│  Jun 15–16 · 2 days                     │
│  ●──●──○ Submitted → Manager → HR       │
├─────────────────────────────────────────┤
│  Team on Leave Today                    │
│  AK Anjali Kumar  Casual · Jun 10–12   │
│  RM Rajiv Mehta   Sick · Jun 11        │
└─────────────────────────────────────────┘
```

---

### Mobile: Apply Leave (3-step flow)

**Step 1 of 3 — Select Type & Dates:**
- Leave type: horizontal scrollable pill row (colored, shows balance)
- Duration: segmented control (Full Day / First Half / Second Half)
- From Date / To Date: native date pickers
- Working days + balance preview auto-updates

**Step 2 of 3 — Reason & Document:**
- Reason: multi-line text field
- Document: tap to open file picker (from master_file_types context: leave_doc)
- Sandwich warning: amber banner if detected

**Step 3 of 3 — Review & Submit:**
- Summary read-only card
- Approval path steps
- Submit button with loading indicator

---

### Mobile: Notifications

**In-app notification list:** Pull-to-refresh, unread notifications highlighted with blue left border.

Notification tap → navigate to the relevant leave request.

### Push Notifications (FCM)

- On app launch and login: register FCM token via `PATCH /api/v1/users/me/fcm-token`
- FCM handles background and foreground push delivery
- **Foreground:** show in-app banner (snackbar) with notification title and body; tap navigates to the relevant leave request
- **Background:** standard OS notification tray; tap opens the app and navigates to the relevant screen
- **Token refresh:** re-register on `FirebaseMessaging.onTokenRefresh` callback
- Polling (`GET /notifications?is_read=false` every 30s) retained as fallback for devices without Google Play Services

---

### Mobile: Manager Approvals

> This entire section is only visible to users with `role_type = manager`. The Approvals tab and all its screens are conditionally rendered — employees never see them.

**Approvals Tab — Pending Queue:**

```
┌─────────────────────────────────────────┐
│  Pending Approvals              3 total  │
│  ┌─────────────────────────────────────┐ │
│  │  Priya Sharma                       │ │
│  │  Casual Leave · Jun 15–16           │ │
│  │  2 working days                     │ │
│  │  ⏱ SLA: 3h 20m remaining           │ │
│  │                                     │ │
│  │  [✅ Approve]    [✖ Decline]        │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Arjun Kulkarni                     │ │
│  │  Sick Leave · Jun 12–13             │ │
│  │  2 working days                     │ │
│  │  ⚠️ SLA: OVERDUE                    │ │
│  │                                     │ │
│  │  [✅ Approve]    [✖ Decline]        │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Meera Joshi                        │ │
│  │  Paid Leave · Jun 20–24             │ │
│  │  3 working days                     │ │
│  │  ⏱ SLA: 4h 50m remaining           │ │
│  │                                     │ │
│  │  [✅ Approve]    [✖ Decline]        │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Data source:** `GET /api/v1/leave/approvals/pending` — returns only requests where the authenticated manager is the assigned Level 1 approver and status is `PENDING_L1`.

**Each approval card shows:**

| Field | Source |
|-------|--------|
| Employee name | `user.full_name` |
| Leave type | `master_leave_types.label` (color-coded left border on card) |
| Dates | `start_date` – `end_date` formatted |
| Working days | `working_days` (calculated, excludes weekends + public holidays) |
| SLA remaining | Countdown from `master_sla_config.manager_window_hours`; shows "OVERDUE" in red when elapsed |

**Approve action:**
- Tap "Approve" → confirmation bottom sheet: *"Approve [Employee]'s [Leave Type] leave for [dates]?"*
- Confirm → `PATCH /api/v1/leave/requests/:id/approve` with `level: 1`
- Success → card animates out of list, success toast shown
- Request advances to `PENDING_L2` (HR final approval)

**Decline action:**
- Tap "Decline" → bottom sheet with:
  - Read-only summary (employee name, leave type, dates)
  - **Reason textarea** (required, min 10 characters)
  - "Decline Leave" button (destructive red) + "Cancel" link
- Confirm → `PATCH /api/v1/leave/requests/:id/decline` with `level: 1` and `reason` body field
- Success → card animates out of list, declined toast shown

**Card tap (anywhere except action buttons):**
- Navigates to a read-only leave request detail screen showing full details: reason, attached document (if any), approval timeline, and employee's current balance for that leave type.

**Empty state:** *"You're all caught up! No pending approvals."* — illustrated with a checkmark graphic.

**Pull-to-refresh:** Reloads the pending approvals list. SLA countdown timers update in real-time (every 60 seconds via local timer, synced on refresh).

**SLA visual indicators:**
- `> 2h remaining` → green countdown text
- `1h – 2h remaining` → amber countdown text
- `< 1h remaining` → red countdown text with pulsing animation
- `OVERDUE` → red badge, card sorted to top of list

---

## Master Data Loading Strategy

### Web (Next.js)

```typescript
// _app.tsx or layout.tsx — on mount
const MasterDataContext = createContext({});

// Fetch all needed master tables in parallel
const [leaveTypes, genders, qualifications, departments, leaveDurations] =
  await Promise.all([
    fetch('/api/v1/master/leave_types'),
    fetch('/api/v1/master/genders'),
    fetch('/api/v1/master/qualifications'),
    fetch('/api/v1/master/departments'),
    fetch('/api/v1/master/leave_durations'),
  ].map(p => p.then(r => r.json())));

// Cache in React context for the session
// No hardcoded arrays anywhere in components
```

### Flutter

```dart
class MasterDataService {
  static Map<String, List<dynamic>> _cache = {};

  static Future<void> loadAll() async {
    final tables = ['leave_types', 'genders', 'qualifications', 'departments', 'leave_durations'];
    await Future.wait(tables.map((t) => _fetchAndCache(t)));
  }

  static List<dynamic> get(String table) => _cache[table] ?? [];
}

// Called on app launch + pull-to-refresh
await MasterDataService.loadAll();
```

---

## Key UX Interactions

### Price Flash Equivalent — Status Change Feedback

On leave request status change (polled every 30s):
- Brief green/amber highlight on the status badge that fades over 500ms
- Push notification sent via `master_notification_templates` (handled server-side)

### Sandwich Leave Warning

When detected during date selection:
- Amber banner with `⚠️` icon appears above the submit button
- Banner text from the sandwich detection detail returned by `POST /leave/calculate`
- Required checkbox: "I understand that [specific dates] may be counted as part of my leave"
- Submit button disabled until checkbox is checked

### Empty States

- No leave history: illustrated empty state with "Apply for your first leave" CTA
- No team members on leave: "Everyone is in today!" message
- Pending approvals empty: "You're all caught up! No pending approvals."

### Error Handling

- API errors: toast notification at bottom of screen with error message from `error.message`
- Network error: persistent offline banner at top: "You're offline. Some features may not work."
- Balance validation failure: inline error below balance preview (not a toast — stays visible)
