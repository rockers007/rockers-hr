# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

All project domain documentation is in the `planning/` directory. The authoritative spec is below.

@planning/PLAN.md

---

## Commands

Run from the **repository root** unless noted.

### Full stack (Docker)
```bash
npm run dev          # postgres + backend + frontend via docker-compose
npm run dev:db       # postgres only (background)
npm run clean        # docker-compose down --volumes
```

### Backend only (NestJS — run from `backend/`)
```bash
npm run start:dev    # watch mode
npm run build        # compile to dist/
npm run test         # jest unit tests (src/**/*.spec.ts)
npm run test:watch
npm run test:e2e     # jest --config test/jest-e2e.json
npm run lint         # eslint --fix
npm run migration:run
npm run migration:generate
npm run seed         # ts-node seeds/run-seed.ts
```

Run a single test file:
```bash
npx jest src/leave/leave.service.spec.ts
```

### Frontend only (Next.js — run from `frontend/`)
```bash
npm run dev          # next dev --port 3000
npm run build
npm run lint
npm run test:e2e     # playwright test
npm run test:e2e:ui  # playwright UI mode
npm run test:e2e:headed
```

### Root-level shortcuts
```bash
npm run dev:backend  # cd backend && npm run start:dev
npm run dev:frontend # cd frontend && npm run dev
npm run db:migrate
npm run db:seed
npm run test         # backend unit tests
npm run test:e2e     # frontend playwright tests
npm run lint         # both layers
```

### Mobile (Flutter — run from `mobile/`)
```bash
flutter pub get
flutter run
flutter build apk
flutter build ios
```

---

## Architecture

### Backend (NestJS + PostgreSQL + TypeORM)

Each feature is a self-contained NestJS module under `backend/src/`:
`auth`, `users`, `leave`, `payroll`, `master`, `notifications`, `calendar`, `uploads`, `reports`, `audit`, `chat`, `backup`, `health`.

**Global cross-cutting wiring (configured in `main.ts`):**
- `ResponseInterceptor` — converts all response keys from camelCase → snake_case
- `HttpExceptionFilter` — standardizes error shape: `{ error: { code, message, statusCode } }`
- `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted: true`, DTO transform enabled
- `ThrottlerGuard` — 100 req/min globally

**Database conventions:**
- UUID primary keys; TypeORM entities in `src/<module>/entities/`
- Soft deletes via `deleted_at` column (no hard deletes anywhere)
- Path alias `@/*` maps to `src/*`
- SSL enabled automatically for known production hostnames; controlled via `PGSSL` env var

**Authentication flow:**
- Primary: admin invite → email/password with temporary token
- Legacy fallback: Google OAuth 2.0 for pre-existing Gmail-registered employees
- JWT parsed on the frontend; payload fields: `sub`, `is_admin`, `name`, `email`, `role`, `admin_role_id`
- Custom decorators: `@CurrentUser()`, `@IsAdmin()` in `auth/decorators/`

**Master data pattern:**
- 11 read-only reference tables (`master_*`) — all dropdowns come from here, nothing hardcoded
- Single generic controller+service in `src/master/` keyed by table name
- Seeded at startup via `npm run seed`; frontend caches in `MasterDataProvider`

**Key domain logic locations:**
- Probation check (blocks most leave types): `leave/leave.service.ts` → `isInProbation()`
- Sandwich day detection: `leave/leave.service.ts` (uses `master_public_holidays`)
- Working day calculation: excludes weekends + public holidays
- SLA escalation cron: `notifications/sla.service.ts` (runs every minute via `@nestjs/schedule`)
- Payroll calculation engine: `payroll/engine/`

---

### Frontend (Next.js 15 App Router)

**Route groups:**
- `app/(employee)/` — employee portal (protected)
- `app/(admin)/` — HR admin panel (protected, admin role required)
- `app/login/`, `app/auth/`, `app/register/`, `app/reset-password/`, `app/complete-profile/` — public auth flows

**State management:**
- Zustand store at `src/lib/auth-store.ts` — single source of truth for user, auth state, role
- JWT decoded client-side to hydrate store (no extra API call)
- Master data (dropdowns) in `src/lib/master-data.tsx` context provider — fetched once, reused everywhere

**API client (`src/lib/api.ts`):**
- Centralized fetch wrapper with automatic camelCase ↔ snake_case conversion
- Dispatches `api:inflight` `CustomEvent` on every in-flight request count change
- `TopProgressBar` component subscribes to this event — no per-form wiring needed

**Key conventions:**
- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000`; all `/api/*` paths rewritten via `next.config.ts`
- `output: 'standalone'` in next.config for Docker
- Tailwind CSS v4 (`@tailwindcss/postcss`), Lucide icons
- Playwright E2E tests live in `frontend/e2e/`

---

### Mobile (Flutter)

- Provider (`ChangeNotifierProvider`) for state management
- `AuthGate` widget in `main.dart` controls auth-gated routing
- Global progress overlay using `Stack` + `IgnorePointer` (mirrors web `TopProgressBar` UX)
- JWT stored in `flutter_secure_storage`; Firebase Cloud Messaging for push notifications
- Master data fetched on first launch, refreshed on pull-to-refresh or app resume

---

## LLM Integration

When writing code that calls an LLM, use the `cerebras-inference` skill: LiteLLM via OpenRouter to model `openrouter/openai/gpt-oss-120b` with Cerebras inference. Use Structured Outputs. The `OPENROUTER_API_KEY` is in the root `.env`.

Set `LLM_MOCK=true` to return deterministic mock responses (for tests/CI).

---

## Environment

Copy `.env.example` to `.env` (root) and `.env` files per layer. Key variables:

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Backend TypeORM |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth tokens |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth + Calendar |
| `AWS_*` | S3 file uploads |
| `SMTP_*` | Email notifications |
| `NEXT_PUBLIC_API_URL` | Frontend API base |
| `OPENROUTER_API_KEY` | LLM chat feature |
| `LLM_MOCK` | Mock LLM in tests |
