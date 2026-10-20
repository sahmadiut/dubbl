# LOC-079 attempt 1 - payroll overview and navigation catalogs

Date: 2026-10-20. Implementer: Codex. Review kind: self; no independent human
or native terminology approval is claimed.

## Selection and bounded implementation

Entry was a clean `master` tree. Controller validate/status/next selected
LOC-067. Source inspection found 27 payroll route TSX files totaling 10,917
lines plus EmployeeDrawer/ContractorDrawer. Created LOC-079..092 and used the
controller `split` operation to queue LOC-067 for independent integration.
The controller selected LOC-079, which was started by `codex`. This attempt
completes only that overview/navigation child; all other children and parents
retain their own acceptance. Updated task index and source coverage.

Added 44 paired `PayrollOverview` messages for the root overview, navigation,
empty setup, summaries, status and feedback. Full catalogs contain 7,054 keys
per locale. Loading delegates to the existing catalogued BrandLoader. See
[scope, source split and exceptions](../registries/PAYROLL_OVERVIEW_CATALOGS.md).

The overview reader reuses `payrollJson` exact-money validation, adds HTTP and
required envelope/display-field checks and finite run statuses. Gregorian
date-only period strings, canonical aliases, nullable historical currencies
and signed correction totals retain meaning. Read results are adopted together
only after both lists validate. Missing org/storage, HTTP, JSON, record and
network errors produce translated finite feedback; cleanup suppresses late
setters. No raw error prose becomes a translated message or visible string.

No shared money helper, payroll calculation, REST/MCP/service, authorization,
schema/migration, statutory rule, posting, FX/IRR or Stripe source was changed.
Existing `list_payroll_employees` and `list_payroll_runs` provide MCP parity for
these reads. Money inventory regeneration records only source/hash drift.

## Actual verification

All commands ran from `D:\Projects\dubbl` using installed dependencies.

| Check | Observed result |
|---|---|
| Focused production JSX/render/behavior suite | 11/11 pass, no skips; final repeat after test type correction also passes |
| Full `pnpm test` unit/static suite | 1,139/1,139 pass, no skips; 96.067 seconds |
| Migrated payroll master/run fixture files | 3/3 pass, no skips; 69.508 seconds |
| `pnpm typecheck` | Final exit 0 |
| `pnpm i18n:check` | Exit 0; 7,054 compatible keys per locale |
| Owned-source/test ESLint | Exit 0, zero errors and warnings |
| Full `pnpm lint` | Exit 0; zero errors, 59 warnings outside owned files |
| Money inventory regeneration and verification | Exit 0; 417 columns, 1,770 consumer hashes and all occurrence/source lines |
| Legacy money guard | Exit 0; nine regression checks |
| Controller validation, owned Markdown links, diff check | Pass before completion/commit |

```text
node --import tsx --test tests/payroll-overview-catalogs.test.ts
pnpm test
node --import tsx --test --test-concurrency=1 tests/integration/payroll-master.test.ts tests/integration/payroll-runs.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint "app/(dashboard)/payroll/page.tsx" "app/(dashboard)/payroll/layout.tsx" i18n/payroll-overview-presentation.ts tests/payroll-overview-catalogs.test.ts tests/integration/payroll-master-worker.ts tests/integration/payroll-runs-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Rendering uses production JSX, real next-intl/PresentationProvider, real shared
navigation and controls with controlled hooks/IO. Covers both locales, every
run status, setup/employee-only/populated/loading/error states, document title,
large exact cents, unlike-currency groups, chart shares, canonical routes,
drawer identity, detail tab hiding, Persian script and authored-copy coverage.
Effect tests verify atomic adoption, finite errors, no-org/storage handling,
headers and suppression of late responses after cleanup. Reader tests cover
required/malformed fields, HTTP/JSON/envelopes, dates, canonical alias mismatch,
safe range, nonnegative salary and signed correction totals.

Existing integration workers now check actual REST and linked registered MCP
employee/run lists with the overview reader. Independent SQL checks and the
existing tenant/permission, cents, withholding, FX, lifecycle, posting, atomic
rollback and historical migration assertions remain in those fixtures.

Integration used a fresh PostgreSQL 18 cluster in OS temp, bound only to
127.0.0.1:6439 with process-scoped `TEST_DATABASE_URL`/`PG_BIN`, local trust and
max_locks_per_transaction=256. Each fixture migrated and dropped a randomized
database. Admin SQL confirmed zero `dubbl_ci_*` databases afterward; pg_ctl
stopped the cluster in finally. Sanitized logs/stopped cluster artifacts remain
in OS temp. No application DB was used.

Initial new-test checks found an extra parenthesis, a BrandLoader CJS/ESM
context mismatch in the harness, a children-prop lint violation and an overload
call needing narrowed test literals. Corrected these; final focused tests,
typecheck and owned lint pass. Removed the pre-existing unused `grossPct`
local from the owned page; rendered share calculations remain unchanged.

## Handoff and limits

See [Codex self-review](LOC-079-review-1.md). Persian wording remains provisional.
LOC-067/008/002, native terminology, complete numeral/calendar/RTL, mounted
browser/keyboard/output, hosted CI, deployment and release acceptance remain
independent. The overview retains existing pagination/summary period and
legacy two-decimal cents presentation; this extraction does not qualify new
statutory behavior. No full build, dev server, application DB, provider request,
Docker, deployment or dedicated Stripe work ran. Finish scoped commit/push,
verify remote SHA and clean tree, report the live next task and stop.
