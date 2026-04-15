# Rockers HR — Implementation Skills & Patterns

This document captures architectural patterns, code conventions, and implementation recipes for the Rockers HR project. Reference before building any new feature.

---

## 1. Project Stack Quick Reference

| Layer | Tech | Port | Start Command |
|-------|------|------|---------------|
| Backend API | NestJS + TypeORM + PostgreSQL | 4000 | `cd backend && npm run start:dev` |
| Frontend | Next.js 15 (App Router) | 3000 | `cd frontend && npm run dev` |
| E2E Tests | Playwright | — | `cd frontend && npx playwright test` |
| DB | PostgreSQL | 5432 | Local or Docker |

---

## 2. Backend Patterns (NestJS)

### 2.1 Route Guard + CurrentUser Decorator

All protected endpoints use `JwtAuthGuard` and `@CurrentUser()`:

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.dto';

@Controller('resource')
@UseGuards(JwtAuthGuard)
export class ResourceController {
  @Post()
  async create(@Body() dto: CreateDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub); // user.sub = userId
  }
}
```

Never use `req.user?.id ?? 'anonymous'` — always inject via `@CurrentUser()`.

### 2.2 Validation Error Pattern (UnprocessableEntityException)

For business rule violations (not schema validation), throw `UnprocessableEntityException` with a structured body:

```typescript
import { UnprocessableEntityException } from '@nestjs/common';

throw new UnprocessableEntityException({
  code: 'RULE_CODE',           // machine-readable, used by frontend
  message: 'Human readable message shown to the user.',
});
```

The frontend catches 4xx responses from `/leave/calculate` and surfaces `error.response.data.message` (or similar) in the `calcError` state.

### 2.3 Validation Must Live in BOTH calculate() and submitRequest()

**Critical pattern**: Any business rule that should show on Step 1 of the leave form MUST be validated inside `calculate()`, not only `submitRequest()`:

- `max_days_per_request` check → inside `calculate()` after working days are computed
- Monthly limit check (e.g., one early leave per month) → inside `calculate()` inside the early-leave branch
- Probation restriction → inside `getEligibleLeaveTypes()` (filter) AND `submitRequest()` (safety net)

`submitRequest()` always re-validates as a safety net, but `calculate()` provides the real-time UX.

### 2.4 Probation Eligibility Filter

The single source of truth is `getEligibleLeaveTypes()` in `leave.service.ts`:

```typescript
// During probation: LWP (by system_key) + Early Leave (by unit === 'hours')
return allTypes.filter((t) => t.system_key === 'LWP' || t.unit === 'hours');
```

Do NOT use `probation_allowed` flag — it proved unreliable across leave types (WFH/Early both had it true). Use `system_key` and `unit` as the discriminators.

### 2.5 TypeORM QueryBuilder for Conditional Counts

```typescript
const count = await this.requestRepo
  .createQueryBuilder('lr')
  .where('lr.user_id = :userId', { userId })
  .andWhere('lr.leave_type_id = :typeId', { typeId: leaveType.id })
  .andWhere('lr.status IN (:...statuses)', { statuses: ['PENDING_L1', 'PENDING_L2', 'APPROVED'] })
  .andWhere('lr.early_leave_date >= :monthStart', { monthStart: monthStartStr })
  .andWhere('lr.early_leave_date < :monthEnd', { monthEnd: monthEndStr })
  .getCount();
```

### 2.6 Master Data API Pattern

All dropdown data is served dynamically. Never hardcode dropdown values in frontend or backend logic.

```
GET /api/v1/master/:table          → active records for a master table
GET /api/v1/master/:table/:id      → single record
POST /api/v1/master/:table         → create
PATCH /api/v1/master/:table/:id    → update
```

Master tables: `master_qualifications`, `master_genders`, `master_leave_types`, `master_leave_durations`, `master_departments`, `master_file_types`, `master_notification_templates`, `master_sla_config`, `master_public_holidays`, `master_admin_roles`, `master_role_types`.

---

## 3. Frontend Patterns (Next.js)

### 3.1 API Client

All requests go through `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

const data = await api.get<ResponseType>('/endpoint');
const result = await api.post<ResponseType>('/endpoint', body);
```

The `api` client automatically attaches the JWT from localStorage and throws on non-2xx.

### 3.2 Auth Store (Zustand)

```typescript
import { useAuthStore } from '@/lib/auth-store';

const { user } = useAuthStore();
// user.is_in_probation  → boolean
// user.is_admin         → boolean
// user.confirmation_date → string | null
// user.name, user.email, etc.
```

`initAuth()` parses the JWT and populates the store. Called once in the root layout.

### 3.3 Multi-Step Form Pattern (Leave Application)

Key states in `apply/page.tsx`:

```typescript
const [step, setStep] = useState(1);           // 1, 2, or 3
const [calcError, setCalcError] = useState(''); // shown on Step 1 as red banner
const [calc, setCalc] = useState<CalcResult | null>(null);
const [calcLoading, setCalcLoading] = useState(false);
```

Step 1 "Next" button disabled condition:
```tsx
disabled={
  calcLoading || !!calcError ||
  !leaveTypeId || !durationTypeId ||
  (isEarlyLeave
    ? (!earlyLeaveDate || !earlyLeaveStartTime || !earlyLeaveEndTime)
    : (!startDate || !endDate || !calc))
}
```

`calcError` is set from the `/leave/calculate` API call inside a `useEffect` that fires whenever key inputs change. Show it as a red banner above the form controls:

```tsx
{calcError && (
  <div className="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
    {calcError}
  </div>
)}
```

Back buttons must clear error: `onClick={() => { setStep(1); setError(''); }}`.

### 3.4 Probation-Aware Dashboard / Apply Page

Both the dashboard and apply page fetch `/leave/types/eligible` to get the filtered list:

```typescript
const eligibleTypes = await api.get<LeaveType[]>('/leave/types/eligible').catch(() => null);

// Dashboard: filter balances
const filteredBalances = eligibleTypes
  ? bal.filter((b) => eligibleTypes.some((et) => et.id === b.leave_type.id))
  : bal;

// Apply page: use eligibleTypes directly as the leave type list
```

Fixing `getEligibleLeaveTypes()` in the backend automatically fixes both surfaces.

### 3.5 S3 Presigned Upload Flow

```typescript
// 1. Get presigned URL from backend
const { upload_url, s3_key } = await api.post<{ upload_url: string; s3_key: string }>(
  '/uploads/presigned',
  { mime_type: file.type, file_size_bytes: file.size, context: 'leave_doc' }
);

// 2. Upload directly to S3 from the browser
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
});

// 3. Store s3_key and send it with the form submission
setDocS3Key(s3_key);
// Later: submit payload includes doc_s3_key: docS3Key
```

Validation: `doc_required && !docS3Key` blocks the Step 2 "Next" button.

### 3.6 UI Component Conventions

- `<Card>` — content container
- `<StatusBadge status={...}>` — leave request status display
- `<EmptyState title="" description="" action={...}>` — empty list placeholder
- `<PageLoader />` — full-page loading spinner
- `<Button variant="secondary" size="sm">` — secondary action
- Probation notice: amber banner `bg-[#fef3c7] border-[#fcd34d]` with warning SVG icon

---

## 4. Playwright E2E Testing Patterns

### 4.1 Mock Auth (JWT Injection)

Google OAuth cannot be automated. Inject a fake but parseable JWT via `addInitScript`:

```typescript
await page.addInitScript(() => {
  function b64url(obj: object) {
    return btoa(JSON.stringify(obj))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    sub: 'mock-emp-id',
    is_active: true,
    is_admin: false,
    email: 'test@gmail.com',
    exp: 9999999999,
  });
  localStorage.setItem('token', `${header}.${payload}.mock_sig`);
});

// Also mock /users/me to return a full user object
await page.route('**/api/v1/users/me', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'mock-emp-id', name: 'Test Employee', ... } }),
  });
});
```

### 4.2 Route Handler Priority (LIFO — Last In First Out)

Playwright applies route handlers in reverse registration order. Avoid conflicts by registering all master routes in ONE handler:

```typescript
// BAD — wildcard registered last overrides specific handlers
await page.route('**/api/v1/master/leave_durations', handler1);
await page.route('**/api/v1/master/**', catchAll);  // overrides handler1!

// GOOD — single handler, inspect URL
await page.route('**/api/v1/master/**', async (route) => {
  const url = route.request().url();
  if (url.includes('/master/leave_durations')) {
    await route.fulfill({ body: JSON.stringify(MOCK_DURATIONS) });
  } else if (url.includes('/master/leave_types')) {
    await route.fulfill({ body: JSON.stringify(MOCK_TYPES) });
  } else {
    await route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) });
  }
});
```

### 4.3 Strict Mode — Multiple Element Matches

When Playwright finds multiple elements for a locator, the test fails in strict mode. Fix with `.first()` or a more specific selector:

```typescript
// BAD
await page.getByText(/supporting document/i).click();

// GOOD
await page.getByText(/supporting document/i).first().click();
// or
await page.locator('[data-testid="doc-upload-label"]').click();
```

### 4.4 Always Add data-testid for Key Elements

Add `data-testid` to interactive elements that tests need to target:

```tsx
// Leave type option buttons
<button data-testid="leave-type-option" ...>

// Duration type buttons
<button data-testid="duration-type-option" ...>

// Form fields
<label htmlFor="from-date">From Date</label>
<input id="from-date" ... />
```

### 4.5 Admin Credentials

- Admin email: `admin@rockers.com`
- Admin password: `admin123`

(Not `superadmin@rockershr.com` / `Admin@1234` — those are stale)

### 4.6 Wait for Navigation After Submit

```typescript
await page.click('[data-testid="submit-btn"]');
await page.waitForURL('**/my-leaves');  // not waitForNavigation()
```

---

## 5. Database / Entity Patterns

### 5.1 Key Discriminator Fields on leave_types

| Field | Purpose |
|-------|---------|
| `system_key` | `'LWP'`, `'CL'`, `'SL'`, `'PL'`, etc. — machine identifier |
| `unit` | `'days'` or `'hours'` — hours = early/short leave |
| `max_days_per_request` | Cap per single request (null = no cap) |
| `probation_allowed` | Legacy — do NOT rely on this for probation logic |
| `requires_document` | Triggers document upload UI on apply page |

### 5.2 Leave Request Status Flow

```
PENDING_L1 → PENDING_L2 → APPROVED
           → DECLINED
PENDING_L2 → DECLINED
APPROVED   → CANCELLED (if start_date > today)
```

---

## 6. ngrok / Environment Setup

When the ngrok URL changes, update TWO places:

1. `backend/.env` — `GOOGLE_CALLBACK_URL` and `FRONTEND_URL`
2. Root `.env` — same two variables

Pattern: `https://<ngrok-subdomain>.ngrok-free.app`

The backend reads `FRONTEND_URL` for CORS. The `GOOGLE_CALLBACK_URL` must match the OAuth redirect URI registered in Google Cloud Console.

---

## 7. Feature Implementation Checklist

When adding a new leave-related validation rule:

- [ ] Add check in `leave.service.ts → calculate()` (Step 1 UX)
- [ ] Add check in `leave.service.ts → submitRequest()` (safety net)
- [ ] Throw `UnprocessableEntityException` with `{ code, message }` shape
- [ ] Verify `calcError` state in `apply/page.tsx` displays it as red banner
- [ ] Verify Next button is disabled when `!!calcError`
- [ ] Add or update Playwright test for the validation

When adding a new leave type restriction for probation:

- [ ] Update `getEligibleLeaveTypes()` filter logic in `leave.service.ts`
- [ ] Update probation check in `submitRequest()` to match
- [ ] Test on both `/dashboard` and `/apply` (both fetch `/leave/types/eligible`)

When adding a new file upload context:

- [ ] Add context string to `PresignedUploadDto` allowed values
- [ ] Add S3 prefix/path logic in `uploads.service.ts`
- [ ] Add UI state: `docFile`, `docS3Key`, `docUploading`, `docError`
- [ ] Block Next/Submit until upload completes when field is required

---

*Rockers HR — SKILLS.md | Implementation reference for all agents and sessions*
