# LOC-109 attempt 1 - Forecast and financial calendar catalogs

## Identity and scope

2026-10-22 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Clean entry tree at
405d6ba4. Controller validate/status/next selected LOC-109; started with owner
codex. The owner authorized completion and push, then explicitly requested the
preceding GitHub CI failure investigated and fixed with this push. Two existing
local commits, 07006fe4 and 405d6ba4, remain intact and are included in branch
history. No other controller task is started. No subagents, full build,
unrequested dev server, deployment or application DB operations were used.
Stripe remains unchanged under DEC-008.

## Acceptance mapping and implementation

1. Added 39 paired ForecastCalendarReports messages for the two scoped report
   pages: headings, descriptions, horizon options, help, chart series, table
   labels, finite failures, event kinds, weekdays, overflow counts, empty states,
   Today and accessible previous/next month labels. Existing namespaces compare
   equal to entry HEAD, and every added Persian message contains Persian script.
   BackToReports, BrandLoader and currency/select controls retain shared
   ownership. [Scope registry](../registries/FORECAST_CALENDAR_CATALOGS.md)
   records explicit data/date/format/server-title exceptions.
2. Six new tests execute production JSX and checked readers through real
   next-intl/PresentationProvider with controlled page hooks/IO/animation. Both
   languages preserve exact KWD low-order digits, separate signed JPY amounts,
   week/currency selections, clear filter, canonical query/header contracts,
   leap-day selection/toggle, month/year rollover, Today, escaped caller titles,
   overflow, empty/loading/failure behavior, cancelled requests and missing org.
   HTTP, malformed JSON, conflicting money aliases and network failures cannot
   adopt unsafe data or expose raw prose. Chart tooltip callbacks select exact
   bigint carriers by stable dataKey independently of translated display names.
   Existing migrated PostgreSQL suites exercise actual REST, linked registered
   MCP operations and SQL assertions for forecast and calendar operations.
3. Registry/task handoff, this evidence and honest self-review retain independent
   LOC-070/008/002, native terminology, full RTL/date/numeral/browser/output and
   release acceptance. Persian wording is provisional, not native approval.

Routes, week/currency/date queries, organization header, Gregorian month keys
and Sunday-first order, event types/colors/title data, exact readers/aliases,
currency scales and cancellation guards remain. Chart coordinates remain
approximate; tooltips, tables and totals use original integers. Existing
cash_flow_forecast and financial_calendar MCP tools already cover these
operations. No REST/MCP/auth/schema/migration/FX/IRR flag changes were necessary.

## GitHub CI investigation and fix

Inspected the fork explicitly, because gh's implicit repository resolves to
upstream. The latest pushed fork run was
[39676438564](https://github.com/sahmadiut/dubbl/actions/runs/39676438564),
commit c4e10376f22b065c26029e9df4aa2ed89c0d6cde. The GitHub connector's job
summaries and decoded logs show Test job 119487406603 failed only the
general-settings effect test in settings-integration-catalogs.test.ts:91:
expected no errors, actual "Failed to load organization settings". Lint,
typecheck, controller and PostgreSQL jobs succeeded; build/Docker were skipped.

Reproduced that exact failure locally with:
node --import tsx --test --test-name-pattern='actual general-settings effect'
tests/settings-integration-catalogs.test.ts (exit 1).

The production effect now calls setIrrEnabled when organization metadata loads.
Its extracted test callback omitted that setter, raising ReferenceError inside
the success path and invoking the reviewed error fallback. The fix supplies the
missing test boundary and adds assertions for absent/false/true currencyRollout
metadata in both locales. It also checks organization/form adoption happens
only on success, and failed responses adopt no rollout state. No runtime IRR
behavior or readiness/activation gate is modified.

## Actual verification

All commands ran at the repository root.

| Command | Actual result |
|---|---|
| node --import tsx --test tests/settings-integration-catalogs.test.ts | 6/6 pass, zero skips; reproduced failure fixed |
| node --import tsx --test --test-concurrency=1 tests/forecast-calendar-catalogs.test.ts tests/analytical-report-ui.test.ts tests/forecast-fx-wire.test.ts tests/message-catalogs.test.ts | 27/27 pass, zero skips |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | 1,369/1,369 pass, zero skips, exit 0; same full unit file selection as CI with bounded concurrency |
| Explicit loopback TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/forecast-fx.test.ts tests/integration/operational-reports.test.ts | 2/2 pass, zero skips; migrated DBs, actual REST/MCP/SQL |
| pnpm typecheck | Pass, including final CI test fix; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass, 9,179 compatible keys per locale |
| pnpm lint | Pass, zero errors and 24 existing warnings outside owned files |
| pnpm exec eslint on two pages and both owned test files | Final pass with no findings |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final pass, 417 columns and 1,828 consumer hashes/source occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured catalog/inventory comparison | 39 added messages per locale, all existing namespaces unchanged; money classifications unchanged; owned consumer paths only |
| python .agentic/agent.py validate; git diff --check | Pass, 347 structurally valid tasks; whitespace check passes |

PostgreSQL 18 used a unique OS-temp cluster on 127.0.0.1:6489, trust auth,
max_locks_per_transaction=256. Suites created/migrated/dropped random dubbl_ci_*
databases. Final admin query found zero such databases and pg_ctl stopped the
cluster. No application database credentials/data were used.

Initial focused tests exposed three incorrect harness assertions about shared
component href capture and the loader's accessibility markup. Tests now inspect
the actual rendered link and translated aria-label; production components did
not need changes for those test corrections. The full final suite passes.

## Review and handoff

See [self-review](LOC-109-review-1.md). No mounted browser/native linguistic/full
RTL/calendar/numerals, adjacent server title/PDF/XLSX content, hosted replacement
CI, deployment or production qualification is claimed. No human gate is waived.
The owner asked to resolve the preceding CI failure before push; the replacement
hosted run need not finish before handoff. LOC-070/008/002 remain independent.
Next bounded task is LOC-110. Commit/push SHA is reported after controller closure.
