# Semgrep — static security analysis

Set up: 2026-04-27.
Dashboard: https://semgrep.dev/orgs/-/findings (link auto-populates after first
CI run with the org's `SEMGREP_APP_TOKEN`).

---

## What runs where

| Trigger | What | Where to see results |
|---|---|---|
| Push to `main` / `master` / `payroll` / `claude/**` | Full scan, uploads to dashboard | semgrep.dev + GitHub Security tab |
| Pull request | Incremental scan (changed files only) | PR check + GitHub Security tab |
| Weekly cron (Mon 02:30 UTC = 08:00 IST) | Full scan, picks up newly-added rules | Dashboard |
| Manual: `gh workflow run semgrep.yml` | Full scan on demand | Dashboard |
| Local: `pwsh ./scripts/semgrep-local.ps1` | Same scan, written to local files | `semgrep-report.json` / `.sarif` |

The workflow is **report-only** today. To start blocking pull requests on
ERROR-level findings, change `continue-on-error: true` → `false` in
`.github/workflows/semgrep.yml` and add `--severity=ERROR` to the scan
command.

## Required setup (one time)

### 1. Add the Semgrep token as a GitHub repo secret

Go to: **GitHub → repo Settings → Secrets and variables → Actions →
New repository secret**

| Name | Value |
|---|---|
| `SEMGREP_APP_TOKEN` | (the token from https://semgrep.dev/orgs/-/settings/tokens) |

The workflow reads it as `${{ secrets.SEMGREP_APP_TOKEN }}` and never logs
it. **Never commit this value to a `.env` file or check it into the repo.**

### 2. (Optional) Configure your project on Semgrep AppSec Platform

Visit https://semgrep.dev/orgs/-/projects → connect this GitHub repo. Once
connected, you can choose which rulesets the cloud-side policy applies on
top of the rules in `.semgrep/`. The default project policy includes:

- `p/security-audit` — generic security
- `p/owasp-top-ten` — OWASP top 10
- `p/typescript` — TypeScript-specific
- `p/nodejsscan` — Node.js / Express patterns (subset; see suppressions below)
- `p/react` — React-specific (mainly XSS / dangerouslySetInnerHTML)

## Local runs

```powershell
# From repo root, with Docker Desktop running:
pwsh ./scripts/semgrep-local.ps1
```

The script:

- Pulls the latest `semgrep/semgrep` image
- If `SEMGREP_APP_TOKEN` is set in your shell, runs `semgrep ci` and uploads
- Otherwise runs `semgrep scan` with the default ruleset
- Writes `semgrep-report.json` (machine-readable) and `semgrep-report.sarif`
  (open in VS Code with the SARIF extension for inline annotations)

## Custom rules — `.semgrep/rockers-hr.yml`

Project-specific rules that codify the conventions in
[`SECURITY_GUIDELINES.md`](./SECURITY_GUIDELINES.md). Each rule references
the bug class it protects against:

| Rule id | Severity | Catches |
|---|---|---|
| `body-inline-type-bypasses-validation` | ERROR | Inline `@Body() x: { … }` types — they skip ValidationPipe (the `change-password silent-logout` bug class) |
| `s3-key-from-body-without-validation` | ERROR | Persisting a request-body `s3_key` without prefix-checking it (the IDOR class fixed in `registerDocument`) |
| `sql-template-literal` | ERROR | `repo.query(\`… ${input} …\`)` instead of parameterised |
| `return-success-false-on-failure` | WARNING | `return { success: false, error: … }` — the `patchCompanyProfile` shape that sails through ResponseInterceptor |
| `jwt-in-localstorage` | INFO | Tracks SECURITY_TODO P0 #2 — flagging so we don't add new sites |
| `dangerously-set-inner-html` | ERROR | XSS sink in React components |
| `console-log-of-secret-named-var` | WARNING | `console.log(…, password, …)` etc — keeps secrets out of stdout |

To add a rule, edit `.semgrep/rockers-hr.yml` and validate with:

```powershell
docker run --rm -v "${PWD}:/src" -w "//src" semgrep/semgrep:latest `
  semgrep scan --config .semgrep/rockers-hr.yml --validate --metrics=off
```

## Suppressions

### Globally suppressed rules (workflow + local script)

- `ajinabraham.njsscan.database.nosql_find_injection.node_nosqli_injection`
  — assumes Mongoose. We use TypeORM/Postgres. Every match is a false
  positive on `.find({ where: {…} })`.
- `ajinabraham.njsscan.xss.xss_node.express_xss` — same noise on TypeORM
  responses being serialised by NestJS.

If you ever need to add a third-party SQL-NoSQL bridge (we don't today),
revisit those rules.

### Per-line suppressions

Add a `// nosemgrep` or `// nosemgrep: <rule-id>` comment on the offending
line:

```ts
// nosemgrep: rockers-hr.sql-template-literal — table name is a const string
await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN …`);
```

Use sparingly and always with a comment explaining why it's safe. Each
suppression is a contract with the next reviewer.

### Per-file suppressions

Add the file to `.semgrepignore` (gitignore syntax). Already-excluded:
`node_modules/`, `dist/`, `.next/`, mobile build artefacts, test fixtures
(so hardcoded test creds aren't flagged), planning docs.

## First-scan baseline (2026-04-27)

After suppressing the two njsscan false-positive rules, the initial scan
on the `claude/gallant-pike-c9c4a4` branch returned **33 findings**:

| Rule | Severity | Count | Disposition |
|---|---|---|---|
| `body-inline-type-bypasses-validation` | ERROR | 10 | **Real bug class** — fix as part of payroll DTO cleanup. Same root cause as the change-password silent-logout. Tracked in SECURITY_TODO. |
| `sql-template-literal` | ERROR | 5 | 4 in migration `1712000000070` (table names are hardcoded `const` array, safe — will add `// nosemgrep` annotations); 1 in `dump-master-data.ts` to investigate. |
| `jwt-in-localstorage` | INFO | 5 | Already tracked SECURITY_TODO P0 #2. Will go to zero when we move to httpOnly cookies. |
| `return-success-false-on-failure` | WARNING | 4 | Same shape as the `patchCompanyProfile` bug fixed earlier; remaining sites in `me.controller.ts` + `payslips.controller.ts`. Convert to `throw BadRequestException`. |
| `s3-key-from-body-without-validation` | ERROR | 1 | **Same IDOR class as documents** — file `investment-proofs.service.ts:46`. **Fix priority.** |
| `node_username` (njsscan) | WARNING | 2 | Test fixtures — safe to suppress per-line. |
| `node_password` (njsscan) | ERROR | 1 | Test fixture — same. |
| Dockerfile `missing-user` | ERROR | 2 | Containers run as root — production deployment concern. |
| `node_insecure_random_generator` | WARNING | 1 | `Math.random()` somewhere — investigate. |
| `helmet_*` (2) | WARNING / INFO | 2 | False-positives (njsscan can't see our config in `main.ts`). |

Triage in the Semgrep dashboard:

- For each finding, click "Triage" → choose **Ignored / False Positive / Acceptable Risk** with a comment.
- Triaged findings stay archived; new occurrences re-trigger.

Closing all of these is a separate piece of work — they predate this
hardening pass. The Semgrep workflow now ensures **no new occurrences land
without notice**.

## When to add a new rule

If a code review uncovers a class of bug that recurs (the way bare-`@Body()`
types kept appearing across payroll controllers), turn it into a rule under
`.semgrep/rockers-hr.yml`. Future reviewers + Semgrep itself will catch the
next instance for free.

If a rule generates >5 false positives in normal use, either tighten the
pattern, narrow the `paths.include`, or move the rule to severity `INFO`.
Don't leave noisy ERROR rules in place — they erode trust in the whole
report.

## Related docs

- [`SECURITY_GUIDELINES.md`](./SECURITY_GUIDELINES.md) — the conventions
  these rules enforce.
- [`SECURITY_TODO.md`](./SECURITY_TODO.md) — the open hardening backlog;
  some Semgrep findings reference its items.
