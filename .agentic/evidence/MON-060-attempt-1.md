# MON-060 attempt 1 - expense CRUD contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD 55b1a4c,
clean master tracking origin/master. User requested the next task, with commit
and push after completion. Controller selected MON-060; claimed ownership.
Read root/nested instructions, START_HERE/controller/project/map/backend role,
MON-011 evidence, ADR-006, source migration/API sections, actual schema/REST/MCP/
UI/money/period/auth/audit paths and MON-042/045/048/051/059 handoffs. Self-review
only; no independent human financial/security/production approval.

## Implementation

Added shared expense-wire and expense-crud services for six operations. REST
numeric line amount retains decimal major input; MCP now implements its declared
integer minor input, correcting the former accidental second conversion. Exact
amountExact/amountMinor and mileageRateMinor aliases agree explicitly. Bigint
ratios round positive ties at the explicit currency scale; bigint sums and safe
numeric bridges guard amounts and totals. Stored historical money is never
rescaled. No full-int64 business range or numeric sunset is advertised.

REST handlers and six strict, described MCP tools use these direct DB services.
Existing MCP lifecycle tools remain registered separately for MON-061. New
counts/update/delete tools cover missing parity. Responses preserve numeric
header/item/mileage minor amounts with named *Minor aliases. SQL text status
sum/min/max rejects unsafe individuals/sums and mixed currencies within a status.
Read-only snapshots validate saved line totals, scoped references and user
memberships; public profile projection removes unrestricted authentication fields.
Actual schema has no contact/project dimension, so such inputs reject. No invented
contact/project monetary envelope or schema migration.

Org/claim locks serialize adopted writes. Currency defaults to locked org default
and survives edits. Only unposted draft/rejected claims can edit/delete. Dates,
old/new period and fiscal locks, expense/purchase reference eligibility, uploaded
receipt ownership, tax metadata and safe amounts validate before committing.
Header/line replacement or deletion/soft delete and mandatory audits are atomic;
audits include complete exact header/line snapshots. Existing replacement item
IDs must uniquely belong to the claim and carry omitted metadata. New line IDs
are regenerated, so clients reread after replacement. No ID guesses by position.

Edit UI now submits IDs, saved accounts and amountExact without parseFloat, uses
exact prefill and currency-scaled bigint total preview. Summary cards retain exact
fractional minor units, handle totals above numeric range without Number summing,
use declared status currencies and show Multiple currencies across unlike buckets.
List/count failures are visible instead of false empty/zero financial results.
The generic create drawer's existing mileage math/display, remaining locale/list/
detail formatters and lifecycle posting are explicitly separate consumer work.

Contract registry, API reference, money README, manifest, matrix and lexical/
deprecated-helper inventories are updated. No schema, historical data, production
flags, IRR enablement or deployment change.

## Acceptance mapping

1. EXPENSE_CRUD_WIRE_CONTRACTS enumerates REST/MCP operations/envelopes, legacy
   major versus minor inputs, exact aliases/agreement, currency scales/defaults,
   supported monetary/distance/date/string limits, pagination, errors and retry/
   history policies. Pure fixtures prove USD/JPY/KWD/IRR 1250 preservation,
   rounding, safe-max major/minor agreement and exact editor/summary fractions.
2. Disposable PostgreSQL fixture calls actual REST route handlers using synthetic
   API keys and actual MCP SDK linked transports. Covers all six operations,
   legacy/exact/dual clients, permissions/custom-role manager/read-only behavior,
   invalid/expired keys, API-key tenant override and foreign claims/references.
   Existing lifecycle registrations coexist without duplicate tool names.
3. SQL-text business snapshots prove no committed effects from malformed JSON,
   missing/conflicting/unsupported money, unsafe header/line/mileage/total, bad
   dates, old/new/two-tier/fiscal locks, invalid states and foreign account/tax/
   cost-center/receipt/user/approver/journal history. Create/update/delete final
   audit faults and create/replacement line faults roll back all business effects.
   Concurrent REST edit/MCP delete gives a valid serialized outcome without orphan
   lines; rejected edits, metadata retention and repeated-deletion policy assert.
   Safe-max JSON and SQL-text counts retain exact aliases; mixed-currency/overflow
   count buckets reject. No own-organization GL/payment posting occurs.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18.6 cluster D:/Temp/dubbl-mon060-pg-babf00fc390c45b2abb2d92c3c90b9ce,
loopback port 55470, trust-auth dubbl_ci role. Hidden pg_ctl launcher. Explicit
TEST_DATABASE_URL pointed only to this synthetic cluster; the harness created,
migrated and dropped random disposable databases. Configured .env credentials
and target were not read or used. Provider keys blank in fixture workers.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119 tasks, selected MON-060 | Structure only |
| pnpm test | Exit 0; 180/180 | Pure/unit suite, three expense groups |
| Final node --import tsx --test tests/expense-wire.test.ts | Exit 0; 3/3 | Additional safe-max exact-major assertion |
| node --import tsx --test --test-concurrency=1 tests/integration/expense-crud.test.ts tests/integration/scheduled-payments.test.ts tests/integration/payment-batches.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reversals.test.ts tests/integration/payment-reads.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0; 9/9 | Real handlers/SDK/disposable DB |
| Final node --import tsx --test tests/integration/expense-crud.test.ts | Exit 0; 1/1 | Includes malformed JSON, strict tools and two-tier lock checks |
| pnpm typecheck | Exit 0; MDX/tsc --noEmit | Installed/generated environment; no build |
| pnpm lint, including final full run | Exit 0; 0 errors/155 existing warnings | Full repository |
| pnpm exec eslint on fourteen changed source/fixture paths/globs; final UI/test lint | Exit 0; clean | Changed TS paths |
| money_inventory.py --write; money_inventory.py; verify_money_inventory.mjs | Exit 0; 410 columns/1475 paths/1213 consumer files | Lexical/Drizzle metadata checks, not dataflow qualification |
| verify_legacy_money.mjs | Exit 0; 9 checks | Deprecated-helper gate |
| git diff --check; git fetch origin; rev-list HEAD...origin/master | Exit 0; 0/0 before commit | Commit/push follows tracker closure |
| psql disposable database count; pg_ctl -m fast -w stop | Zero remaining fixture DBs; stop exit 0 | Synthetic cluster retained outside repository |

Initial TypeScript inference failure came from the conditional line-ID schema;
replaced it with explicit strict schema extension. First PostgreSQL setup used
incorrect enum spelling purchases rather than actual purchase; corrected fixture.
Self-review added receipt ownership and complete line audit snapshots, tightened
alias comparison and malformed JSON errors, and fixed UI currency/precision/error
handling. The shell pipe replaced an inserted em-dash placeholder with a question
mark; final source uses a Unicode escape and affected UI lint passes. These are
resolved preliminary failures, not final failing checks. Expected synthetic SQL
faults assert rollback; no provider requests are made.

As with the preceding task's launcher, startup remained attached to the server
until shutdown; its trailing readiness check then returned no response/exit 1.
Independent initial readiness reported accepting connections, all DB suites
passed, zero fixture DBs remained and explicit shutdown passed. No running test
server or failed final DB suite remains.

No build, dev server, Docker, configured-target migration/reset, schema generation,
browser/session/OAuth, live receipt/email/payment provider, deployment or IRR
enablement was run. Tests qualify this bounded CRUD slice, not approval/payment/
tax/FX posting or all external writer concurrency. Generic create-drawer mileage,
old ambiguous MCP records, bank/restore/merge/reference/lock writers, full-int64,
performance and independent financial/security/migration/locale/IRR/release gates
remain assigned work. MON-021 retains combined acceptance.

## Review and handoff

See MON-060-review-1 for implementing-assistant self-review. No bounded slice
blocker. Close controller check/submit/self-review/done, validate staged content,
commit and push as authorized, then stop. Next task MON-061 expense lifecycle.
