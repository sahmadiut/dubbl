# LOC-045 attempt 1 - recurring invoice catalogs

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 9c087715f29ed3542c7c4c6de10596f46c773cd7. The only entry change
was LOC-045's existing in-progress/owner/started record. Resumed that task after
live controller validate/status/next; preserved it as part of this task's record.
The user authorized completing and pushing the next task. Only LOC-045 is
completed; LOC-025/007/002 and remaining sibling acceptance stay independent.

Read root and nested controller instructions, entry/controller/project/map,
frontend role, selected/parent task, LOC-006 dependency review, catalog contracts,
relevant strategy headings and actual recurring UI, exact-money helpers,
REST/services/MCP and existing fixtures. Applied the memory controller skill.
No subagents, full build, dev server start, application DB, provider call,
deployment or Stripe changes.

## Implementation and acceptance mapping

1. Added 108 paired `RecurringInvoices` messages, with 4,863 compatible keys per
   locale. Owned list/detail, RecurringDrawer and saved money details use typed
   catalogs, finite status/frequency display and ICU pagination. The
   [scope registry](../registries/RECURRING_INVOICE_CATALOGS.md) records all owned
   copy, exceptions, existing MCP coverage and independent parent/native handoff.
2. Column memoization responds to locale. Read state stores message codes rather
   than old-locale text; locale switches do not trigger network effects. Raw
   server/parser diagnostics cannot become visible failures. Non-array list
   data cannot replace existing rows. Creation requires a nonempty saved ID.
   Status changes require matching returned ID/status, preserve validated
   financial lines and clear the detail with a reload message on an unreadable
   successful update. Failure paths restore busy state.
3. Tests render actual production syntax using real React, next-intl,
   PresentationProvider, DataTable, DatePicker, cards and exact-money helpers.
   State/navigation/portals and shared picker/form boundaries are controlled;
   callback extraction executes original handlers. Both locales cover authored
   guidance/controls, safe hostile values, unknown/prototype-like codes, ICU
   counts, Persian script, exact multi-currency amounts, canonical creation/
   pause/resume/deletion requests, confirmation cancellation, read/pagination/
   preview cancellation, generation guards and HTTP/network/JSON/shape/alias
   failures. A source audit checks owned JSX and display attributes.
4. Financial helpers, services, REST/MCP, schema/migrations, FX and IRR flags
   remain unchanged. Existing disposable REST/MCP/SQL fixtures verify monetary
   generation/persistence, schedule advancement and tenant contracts. Earlier
   namespaces and every other creation drawer match entry HEAD. Inventory schema
   classifications match HEAD; only seven owned consumer entries and two new
   scanned source paths changed.

## Actual verification

All commands ran from D:/Projects/dubbl. The two integration groups ran on
PostgreSQL 18 in a fresh random OS-temporary cluster with trust authentication,
bound only to 127.0.0.1 at an allocated port and explicit TEST_DATABASE_URL.
Fixtures migrated and dropped random dubbl_ci_* databases; the final audit
returned zero remaining fixture databases. pg_ctl stopped the server in finally.
Stopped cluster files remain in the OS temp directory. No application DB access,
PostgreSQL 16 or production qualification is claimed.

| Check | Actual result |
|---|---|
| Final focused catalog/UI-money/wire | Exit 0; 17/17 passed, no skips; 10.922 seconds |
| Full unit/static suite, concurrency 2 | Exit 0; 865/865 passed, no skips; 204.824 seconds |
| Recurring generation and UI-money REST/MCP/SQL | Exit 0; 2/2 groups, no skips; 51.928 seconds |
| pnpm typecheck | Exit 0 |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Changed-file ESLint | Exit 0; zero errors/warnings |
| pnpm i18n:check | Exit 0; 4,863 compatible keys per locale |
| Money inventory generation/verification | Exit 0; 417 columns, 2,246 scanned files, 1,683 consumer hashes and occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Ownership audit | Exit 0; 108 paired messages, Persian script, earlier namespaces and other drawers unchanged |
| Inventory diff audit | Exit 0; schema classifications unchanged, seven owned consumers and two source additions |
| Controller validate | Exit 0; valid 292-task graph |
| Fetch/divergence | Exit 0; HEAD versus origin/master 0 ahead / 0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/recurring-invoice-catalogs.test.ts tests/recurring-invoice-ui-money.test.ts tests/recurring-invoice-wire.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/recurring-invoices.test.ts tests/integration/recurring-invoice-ui-money.test.ts
pnpm typecheck
pnpm lint
node node_modules/eslint/bin/eslint.js <two recurring pages> components/dashboard/recurring-invoice-money-details.tsx components/dashboard/create-drawer.tsx i18n/recurring-invoice-presentation.ts tests/recurring-invoice-catalogs.test.ts
pnpm i18n:check
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

An initial test syntax typo and copied harness component name were corrected.
A malformed-list test exposed clearing the prior error before validating the
array; validation now precedes state adoption. Focused checks then passed, and
the final run also covers independent preview failure handling. No financial
implementation change or product-money regression was needed.

## Review and handoff

Final [self-review](LOC-045-review-1.md) approves this bounded task; no unresolved
finding blocks it. Documentation targets and final diff checks pass. All three
criteria have implementation and verification evidence. Finish controller
disposition before the task-owned commit.
Persian wording remains provisional. Native terminology, mounted browser/RTL,
date/numeral adapters, shared forms, LOC-025/007/002 integration, hosted CI,
providers/deployment and production IRR qualification remain open. Finish the
task-owned commit/push, verify remote SHA/clean tree, report next task and stop.
