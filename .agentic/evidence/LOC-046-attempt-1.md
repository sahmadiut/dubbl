# LOC-046 attempt 1 - revenue schedule catalogs

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 2dfa8538c817c1329a6099993941b310b258872a. Working tree was clean.
The user authorized completing and pushing the next task. Live controller
validate/status/next selected LOC-046, claimed with owner Codex. Only this child
is completed; LOC-025/007/002 and remaining siblings retain independent acceptance.

Read repository/controller instructions, project/map, frontend role, selected
task, parent, LOC-006 dependency review, catalog contract, relevant locale
strategy/configuration sections and actual UI, money formatter, wire/service/MCP
coverage and existing fixtures. Applied the memory controller-task skill.
No subagents, full build, dev server start, application database, deployment,
provider call or Stripe edits.

## Implementation and acceptance mapping

1. Added 90 paired `RevenueSchedules` messages, 4,953 compatible keys per locale.
   List/detail and RevenueScheduleDrawer extract authored guidance, labels,
   options, tooltips, confirmations, outcomes and ICU counts. The
   [scope registry](../registries/REVENUE_SCHEDULE_CATALOGS.md) records ownership,
   explicit data/illustration exceptions, existing MCP coverage and handoff.
2. Typed own-key method/status mappings preserve unknown caller data safely.
   Columns and localized method search follow locale; finite read errors render
   with the current catalog without adding locale-dependent network effects.
   HTTP/network/JSON/shape/money-alias failures cannot adopt malformed schedule
   data or expose raw diagnostics. Creation requires a saved ID. Recognition
   and cancellation await refresh; unreadable updated details clear and request
   reload. Initial/detail and invoice reads honor cancellation. Failure callbacks
   restore busy state and preserve create retry identity.
3. New tests render actual production function syntax with React, next-intl,
   PresentationProvider and real table/cards/date/currency fields; controlled
   boundaries handle state, navigation, portals and selects. Production callback
   extraction tests original handlers for creation/retry, next-entry recognition,
   confirmation cancel/DELETE, read/pagination and action refresh. Both locales
   cover authored copy, unknown/hostile values, Persian script, ICU plural counts,
   exact sums beyond the safe numeric range, canonical payloads and failure modes.
   An AST audit checks all owned JSX/display attributes.
4. Financial helpers, services, REST/MCP, schema/migrations, FX and production-IRR
   flags are unchanged. Fixed-cent USD display, exact input string, bigint
   aggregates, canonical dates/methods, routes, org headers, page size, retry key
   and entry targeting are preserved. Existing migrated fixtures independently
   verify allocation/posting, tenant authorization, locks, retries and concurrency.
   Earlier namespaces and every other drawer equal entry HEAD. The money
   inventory only refreshes seven owned consumers and adds two scanned sources;
   all schema classifications are unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl. Integration used a new random OS-temp
PostgreSQL 18 cluster with trust authentication bound only to 127.0.0.1 on an
allocated port and explicit TEST_DATABASE_URL. The existing fixture migrated and
dropped its random dubbl_ci_* database; the final count was zero. pg_ctl stopped
the cluster in finally. Stopped files remain in OS temp. No application DB,
PostgreSQL 16 or production qualification is claimed.

| Check | Actual result |
|---|---|
| Focused revenue catalog and wire | Exit 0; 13/13 passed, no skips; 5.888 seconds |
| Full unit/static suite, concurrency 2 | Exit 0; 876/876 passed, no skips; 161.798 seconds |
| Revenue REST/MCP/SQL integration | Exit 0; 1/1 group passed, no skips; 23.715 seconds |
| pnpm typecheck | Exit 0 |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Changed-file ESLint | Exit 0; zero errors/warnings |
| pnpm i18n:check | Exit 0; 4,953 compatible keys per locale |
| Money inventory generation/verification | Exit 0; 417 columns, 2,248 scanned files, 1,685 consumer hashes and occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Ownership/inventory audit | Exit 0; earlier namespaces, other drawers and schema classifications unchanged; seven consumer refreshes and two scanned additions |
| Controller validate | Exit 0; valid 292-task graph |
| Fetch/divergence | Exit 0; entry HEAD versus origin/master 0 ahead / 0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/revenue-schedule-catalogs.test.ts tests/revenue-wire.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/revenue-schedules.test.ts
pnpm typecheck
pnpm lint
node node_modules/eslint/bin/eslint.js <two revenue pages> components/dashboard/create-drawer.tsx i18n/revenue-schedule-presentation.ts tests/revenue-schedule-catalogs.test.ts
pnpm i18n:check
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

Initial authoring checks caught text-replacement syntax and ICU contract errors;
these were corrected before final focused/full/static verification. Temporary
cluster initialization first rejected a nonempty data directory because its
initialization log was redirected there; using a separate data subdirectory
resolved it. The final integration ran successfully and the server stopped.

## Review and handoff

Final [self-review](LOC-046-review-1.md) approves this bounded extraction;
no unresolved finding blocks it. All three acceptance criteria have concrete
implementation and verification evidence. Documentation links and final diff
checks must pass before controller disposition and the task-owned commit.

Persian wording remains provisional. Native terminology, mounted browser/RTL,
date/numeral adapters, shared forms, LOC-025/007/002 integration, hosted CI,
providers/deployment and production IRR remain independent. Finish controller
disposition and scoped commit/push, confirm remote SHA and clean tree, report
the next task and stop.
