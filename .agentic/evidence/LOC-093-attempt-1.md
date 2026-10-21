# LOC-093 attempt 1

## Identity and scope

2026-10-21, Codex, D:\Projects\dubbl, master. Clean tree at entry; this evidence
describes the task diff before its commit. Controller selected LOC-068. Source
inspection found 11 project route TSX files totaling 5,262 lines, plus the
242-line ProjectDrawer. Split through the controller into LOC-093..098 and
selected the first ready child, LOC-093. LOC-068 retains independent acceptance.

## Implementation and acceptance mapping

1. Added 100 paired `Projects` messages (8,153 total leaves per locale) for the
   project list, creation drawer and settings. Loading delegates to the shared
   catalogued loader. Authored copy, finite status/priority/billing labels,
   busy/empty/error states, field prompts, sections and confirmations are
   extracted. Color radios gain translated accessible names. Explicit data,
   machine, numeric and currency exceptions are in
   [PROJECT_LIST_CATALOGS](../registries/PROJECT_LIST_CATALOGS.md).
2. Real JSX/next-intl rendering and callbacks preserve exact cents strings,
   bigint totals above Number.MAX_SAFE_INTEGER, currency suppression, minute
   quantities, canonical dates, nulls, flags, form values, routes, headers and
   existing project events. Checked readers delegate to projectCrmJson and
   reject bad envelopes/money/identity/enums/quantities before list adoption or
   mutation success. Missing organization and storage/read failures release
   busy state. Late list requests are ignored after cleanup. Failed deletion
   no longer displays success, emits projects-changed or navigates away.
3. Registry and controller split/handoff document independent parent and
   remaining child work. Persian script is asserted for all new fa-IR leaves;
   native terminology review and complete RTL qualification remain open.

No REST/MCP/service/schema/migration, authorization, ledger, stored-money,
currency, IRR enablement or Stripe implementation changes. Existing org-scoped
project MCP operations already correspond to these UI operations.

## Verification

All commands ran from D:\Projects\dubbl.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test tests/project-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/project-master-wire.test.ts tests/project-billing-wire.test.ts | 24/24 pass; zero skips |
| node --import tsx --test --test-concurrency=1 tests/message-catalogs.test.ts tests/locale.test.ts tests/payroll-employee-catalogs.test.ts tests/payroll-contractor-catalogs.test.ts | 42/42 pass; zero skips; includes shared creation-drawer regressions |
| Explicit TEST_DATABASE_URL/PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/project-master.test.ts tests/integration/project-billing.test.ts | 2/2 pass; zero skips; real REST, linked registered MCP and independent SQL; 35.326 seconds |
| pnpm typecheck | Pass after correcting an unknown-object spread type in the new test harness |
| pnpm i18n:check | Pass; 8,153 paired keys |
| pnpm exec eslint on the seven changed TS/TSX files | Pass; zero errors/warnings |
| pnpm lint | Pass; zero errors and 26 existing warnings outside the changed files |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Generated inventory and verification pass; 417 schema columns unchanged; 1,797 consumers |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| python .agentic/agent.py validate | Pass; 325 structurally valid tasks |
| git diff --check | Pass |

An isolated PostgreSQL 18 cluster in OS temp listened on 127.0.0.1:6471,
trust authentication, max_locks_per_transaction=256. Fixture databases used
random dubbl_ci_* names and were dropped; final admin query returned zero
remaining fixture databases. pg_ctl stopped the cluster. Application .env/DB
was not used. No credentials were printed or persisted.

The existing master worker now passes successful list/create/update/delete
REST and registered MCP responses through the new readers. Existing SQL-text,
scope/role/auth, invalid input, history, concurrency, audit and atomic rollback
assertions remain. The existing UI money source guard recognizes the project
list's new reader and checks that it still delegates to projectCrmJson; other
consumer requirements remain intact. Money inventory refresh changes only
task-owned paths, consumer hashes and line occurrences; schema metadata is
identical to HEAD.

An initial rendering test exposed a test-harness ESM/CommonJS context mismatch
for the shared table/loader; using their real imported modules fixed it. The
first typecheck including the new tests found an unknown-object spread; an
explicit harness context type fixed it. Final focused checks passed afterward.

## Review and handoff

Codex self-review is recorded separately; no independent or human approval is
claimed. No full build, dev server, browser, full unit/integration suite, native
linguistic review, complete RTL, hosted CI, provider, deployment or production
qualification ran. LOC-094..098 remain unfinished. LOC-068/008/002 retain
independent combined acceptance. Commit/push and remote SHA parity are reported
from Git after controller completion.
