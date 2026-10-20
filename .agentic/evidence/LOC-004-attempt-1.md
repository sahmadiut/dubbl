# LOC-004 attempt 1

## Identity and authorization

2026-10-20 (Asia/Tehran), coding-assistant/Codex, `D:/Projects/dubbl`,
branch `master`. Clean entry HEAD `72f1076aa494b4b26425bbd01961b9935eac1167`.
Controller validate/status/next selected LOC-004; started as coding-assistant.
The user authorized completing and pushing the next task. Fresh origin/master
fetch confirmed zero ahead/zero behind before disposition. No subagents used.
The controller-task memory skill guided the workflow, checked against current
repository instructions and authoritative controller state.

## Implementation and acceptance mapping

1. Added strict ISO Gregorian date-only adapters and explicit Intl calendar/
   numeral formatters in `i18n/dates.ts`. Shared Calendar selects the installed
   DayPicker 9.14.0 Persian entry point or Gregorian component with the correct
   calendar-specific English/Persian locale. Known dates agree between Intl and
   the installed Jalali date library: 1399/1400 and 1402/1403/1404 New Year,
   leap Esfand 30 and Gregorian February 29. Real rendered day callbacks round-trip
   their Gregorian source coordinates, not a separately implemented calendar.
2. Shared DatePicker uses a UTC date carrier for input, selected grid, output and
   Intl date-only display; host and independent preference timezones cannot shift
   a date-only value. Tests change host TZ across UTC, Los Angeles and Tehran,
   including 2021-03-22's historical Iranian DST boundary. Display tests also use
   Pacific/Kiritimati and Pacific/Pago_Pago user timezones. Language, calendar and
   numerals vary independently. Month dropdowns, day text, selected ARIA labels,
   direction, trigger display and empty/invalid/selection behavior are covered.
3. Existing separate preference UI, REST and registered MCP implementation were
   inspected and reused. Extended its migrated synthetic fixture with 48 real
   journal writes through REST and linked registered `create_entry`, independent
   SQL-text date/amount assertions and preference-change date/timestamp snapshots.
   All returned/stored dates match the ISO Gregorian input. Formatted Persian/
   Gregorian labels, Persian/slash dates and timestamps are rejected without
   journal writes. Exact debit/credit remains 1250 minor units. `formatInstant`
   honors user timezone without mutating the UTC Date serialization; notification
   date labels reuse it with unchanged month/day options and grouping policy.

The [calendar registry](../registries/CALENDAR_PRESENTATION.md) documents the
carrier contract, existing REST/MCP parity, package compatibility and remaining
qualification. No production REST/MCP/service/auth/schema/migration, accounting
calendar, money/FX/IRR or Stripe source changes. No dependency or lockfile change.
All existing DatePicker callers retain the same canonical string interface.

The money inventory refresh changes five owned consumer records and fills an
existing inventory omission for the already committed
`tests/inventory-catalog-integration.test.ts`. The latter's source is unchanged.
New scanned paths include the two new TypeScript files and that pre-existing
test. A parsed comparison against HEAD confirms all 417 schema-column records
are identical. MONEY_COLUMNS has no semantic diff.

## Verification actually completed

All commands ran in `D:/Projects/dubbl` with installed dependencies.

| Command | Actual result | Limit |
|---|---|---|
| `node --import tsx --test tests/calendar.test.ts tests/locale.test.ts` (final repeat) | Exit 0; 14/14 passed, no skips; 9.788 seconds | Six calendar and eight existing locale tests |
| `node --import tsx --test --test-concurrency=4 tests/*.test.ts` | Exit 0; 1,128/1,128 passed, zero skips; 163.073 seconds | Local unit/static/render tests |
| `node --import tsx --test --test-concurrency=1 tests/integration/locale-preferences.test.ts` | Exit 0; 1/1 passed, zero skips; 12.661 seconds including extended worker | Migrated disposable PostgreSQL, real REST/MCP and SQL |
| `pnpm typecheck` (final run) | Exit 0 | fumadocs-mdx and tsc --noEmit; no full build |
| `pnpm exec eslint components/ui/calendar.tsx components/ui/date-picker.tsx i18n/dates.ts i18n/notification-presentation.ts tests/calendar.test.ts tests/integration/locale-preferences-worker.ts` | Exit 0, zero errors/warnings | Owned TypeScript |
| `pnpm lint` | Exit 0, zero errors, 60 existing warnings | Whole repository |
| `pnpm i18n:check` | Exit 0; 7,010 keys per locale | No catalog modifications/native linguistic sign-off |
| `python .agentic/scripts/money_inventory.py --write` then same command without `--write` | Exit 0; 417 columns, 2,376 scanned files, 1,768 consumers | Conservative lexical inventory |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema/hash/source lines verified | Existing inventory verifier |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks | Existing guard scope |
| `git diff --check` | Exit 0 | Whitespace validation |
| `python .agentic/agent.py validate` and local Markdown-link assertions | Exit 0; 305 valid tasks, all new local links resolve | Structural validation, not review authentication |

An initial typecheck exposed the intersection of the two picker locale prop types;
merging the caller's partial locale into the complete calendar-specific locale
resolved it without weakening types. A test-only selected-prop narrowing was
also corrected. Initial controlled-portal testing loaded a separate CommonJS
next-intl context; explicitly sharing the real imported context resolved it.
Final focused, full and type checks above passed after the relevant corrections.
No unrun build or mounted-browser claim is made.

Integration used PostgreSQL 18 in a fresh OS-temp cluster, bound only to
127.0.0.1:6332, trust auth for this isolated loopback fixture and
max_locks_per_transaction=256. Explicit process-scoped TEST_DATABASE_URL and
PG_BIN selected it. The fixture created/migrated/dropped a randomized database;
admin SQL confirmed zero remaining `dubbl_ci_*` databases, and pg_ctl stopped
the cluster in finally. Sanitized logs and the stopped cluster remain in OS temp.
No application database was used. Existing authorization/membership/isolation,
preference reset/audit, migration preservation and malformed preference checks
also passed. The complete integration suite was not rerun.

## Review and limitations

See [honest self-review](LOC-004-review-1.md). Real production picker grids,
DayPicker selection handlers and next-intl/provider run in SSR; the DatePicker
portal boundary is controlled for callback capture. No mounted browser focus,
keyboard, portal positioning, full RTL, native linguistic or release sign-off
is claimed. DEC-005 does not require screenshots. No full build, development
server, Docker, deployment or provider call was run. Hosted CI is not claimed.

## Handoff

Implementation and local verification are complete. Finish controller criterion
checks, self-review disposition and validation; commit only owned source/tests,
inventory/registry/task/evidence, push origin/master, verify remote SHA and clean
tree, report the next controller task and stop. Other LOC/L10N/RTL and fiscal/
statutory calendar work remains independently scoped.
