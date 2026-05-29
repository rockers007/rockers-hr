---
name: flutter_code_refactor
description: >-
  Whole-file refactor playbook for the Rockers HR Flutter app (mobile/). Trigger
  this skill whenever the user names a Flutter file and asks to "refactor" it —
  e.g. "refactor salary_screen.dart", "salary_screen.dart refactor", "refactor
  this file". Restructures the named file end-to-end into the layered
  architecture below (ui → controller → repo → service), applying standard file
  naming, optimizations (lazy loading, const, builders), and a maximally-readable
  coding pattern. Behaviour-preserving only — never changes API contracts or
  response shapes. Apply only when the user explicitly asks for a refactor.
---

# Flutter Whole-File Refactor

## Trigger & scope

Activate when the user mentions a **target file + "refactor"** (e.g. "refactor
`salary_screen.dart`"). Refactor the **whole** named file: split its mixed
responsibilities across the architecture layers, extracting the controller, repo,
and widget files it implies.

**Hard rule: behaviour-preserving.** Keep the exact same API endpoints, request
bodies, response parsing, and user-visible behaviour. Refactor *structure*, not
*function*. Never invent new endpoints or change response shapes.

## Architecture (layered)

Dependency direction is one-way: **ui → controller → repo → service**. A layer
may only depend on the layer to its right.

| Folder         | Owns                                              | Naming             | Example                    |
| -------------- | ------------------------------------------------- | ------------------ | -------------------------- |
| `config/`      | App-level settings: theme, fonts, sizes, api cfg  | `app_config.dart`  | `AppConfig.apiBaseUrl`     |
| `models/`      | Data parsing (`fromJson`/`toJson`), immutable DTOs| `*_model(s).dart`  | `payroll_models.dart`      |
| `screens/`     | **UI only** — thin, no logic, no API calls        | `*_screen.dart`    | `salary_screen.dart`       |
| `widgets/`     | Shared + per-screen extracted private widgets     | descriptive name   | `salary_summary_card.dart` |
| `controllers/` | Business logic, `extends ChangeNotifier`, ui↔repo | `*_controller.dart`| `salary_controller.dart`   |
| `repo/`        | Data layer: API + local storage                   | `*_repo.dart`      | `payroll_repo.dart`        |
| `services/`    | **App-level infra only** (not domain)             | `*_service.dart`   | `api_service.dart`         |

`services/` is reserved for cross-cutting infrastructure: `api_service.dart`
(singleton HTTP client + `ApiException`), `logging_service.dart` (`showLog`),
secure storage. **Domain data access lives in `repo/`, not `services/`.** When
refactoring, an existing `*_service.dart` that wraps domain API calls (e.g.
`payroll_service.dart`) becomes `*_repo.dart`.

## Standard file naming

- **snake_case** filenames; one public class per file.
- Class name = PascalCase of the filename: `salary_controller.dart` → `SalaryController`.
- Suffixes are mandatory: `_screen`, `_controller`, `_repo`, `_service`,
  `_model`/`_models`. Widgets use a descriptive name (`leave_request_card.dart`),
  no suffix required.
- Private helper widgets (single-file, not shared) are prefixed `_` and may live
  in the same file or an extracted `widgets/` file if large.

## State management pattern

Controllers extend `ChangeNotifier` and are exposed via Provider — matching the
existing `AuthService` / `MasterDataService` pattern. **Do not introduce a new
state library** (no Riverpod/Bloc).

```dart
// controllers/salary_controller.dart
enum ViewStatus { idle, loading, success, error }

class SalaryController extends ChangeNotifier {
  SalaryController(this._repo);
  final PayrollRepo _repo;

  ViewStatus _status = ViewStatus.idle;
  ViewStatus get status => _status;

  String? _error;
  String? get error => _error;

  PayrollSalary? _salary;
  PayrollSalary? get salary => _salary;

  Future<void> load() async {
    _status = ViewStatus.loading;
    notifyListeners();
    try {
      _salary = await _repo.getSalary();
      _status = ViewStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = ViewStatus.error;
    }
    notifyListeners();
  }
}
```

- Controller holds **typed state** (`status` enum + data + `error`) and exposes
  **intent methods** (`load()`, `submit()`). It calls `notifyListeners()` on every
  transition.
- Screen reads state with `context.watch<SalaryController>()` (or `.select(...)`)
  and fires actions with `context.read<SalaryController>()`.
- Register the controller at the screen route, lazily:
  `ChangeNotifierProvider(create: (_) => SalaryController(PayrollRepo()), child: SalaryScreen())`.
- Trigger the first fetch in `initState` (post-frame), never in the constructor.

## Optimization rules

- **Lazy loading:** `ChangeNotifierProvider(..., lazy: true)` (default). Defer the
  first network call to `initState`/first build, not the controller constructor.
- **`const` everywhere possible** — `const` constructors on every static widget to
  shrink the rebuild tree.
- **Lists:** `ListView.builder` / `.separated` (never a mapped `Column` for
  variable-length data). Paginate with `AppConfig.defaultPageSize`.
- **Targeted rebuilds:** prefer `context.select((C c) => c.field)` over
  `context.watch` so only the widget depending on a changed field rebuilds.
- **Dispose** controllers, `TextEditingController`s, and notifiers.
- **Reuse infra:** the singleton `ApiService.instance`; cache master data; don't
  re-instantiate HTTP clients.

## Readability pattern

- **File section order:** imports → enums/state types → public widget →
  private widgets → helper functions.
- **Guard clauses** for loading/error; no deeply nested conditionals.
- **`switch` on the status enum** to choose the screen body
  (idle/loading/success/error), each arm returning a small named widget.
- **Named methods/widgets over deep nesting** — extract any `build` block deeper
  than ~3 levels.
- Use **`showLog(...)`** (`logging_service.dart`) for diagnostics, never `print`.
- **Keep widgets < ~200 lines** — extract a sub-widget into `widgets/` otherwise.

## Refactor procedure

1. **Read** the target file and classify its responsibilities (UI / state / API /
   validation).
2. **Extract API + data access** into `repo/<feature>_repo.dart` (rename an
   existing domain `*_service.dart` here; keep `ApiService`/`ApiException` usage).
3. **Move state + business logic** into `controllers/<feature>_controller.dart`
   (`extends ChangeNotifier`, status enum, intent methods).
4. **Reduce the screen** to a thin widget: Provider-wire the controller, render via
   `watch`/`select`, dispatch via `read`. No API calls, no `_loading`/`_error`
   fields left in the screen.
5. **Extract large UI blocks** into `widgets/`.
6. **Apply** naming + `const` + lazy + `ListView.builder` + `showLog`.
7. **Verify** with `flutter analyze` in `mobile/` — zero new errors/warnings.

## Worked example: `salary_screen.dart`

**Before** — one `StatefulWidget` with `_loading`, `_error`, `_salary`, a `_load()`
that calls `PayrollService.instance.getSalary()` in `initState`, and a `_buildBody`.

**After:**
- `repo/payroll_repo.dart` — `getSalary()` → `PayrollSalary.fromJson(...)` via
  `ApiService.instance.get('/payroll/me/salary')`.
- `controllers/salary_controller.dart` — `SalaryController extends ChangeNotifier`
  holding `status`/`error`/`salary` with `load()`.
- `screens/salary_screen.dart` — thin: `ChangeNotifierProvider` wires the
  controller, `build` does `switch (controller.status)` → loading spinner / error
  view / `SalarySummaryCard`, with `RefreshIndicator(onRefresh: controller.load)`.
- `widgets/salary_summary_card.dart` — extracted `const` presentational widget.

## Guardrails

- Preserve existing `ApiService` / `ApiException` error handling.
- Do **not** add new state-management dependencies.
- Keep snake_case + suffix conventions; one public class per file.
- Don't break Provider wiring in `main.dart` (`AuthService`, `MasterDataService`).
- Behaviour-preserving only — no contract or response-shape changes.
