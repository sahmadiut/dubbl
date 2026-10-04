# MON-063 attempt 1 - bank transaction read contracts

## Identity

2026-10-04, Asia/Tehran. Operator codex, implementing assistant; self-review.
Entry HEAD 57ed847, clean master tracking origin/master. User authorized the
next task, commit and push after completion. Controller validate/status/context
selected MON-063; claimed with owner codex. No delegation or independent review.

## Implementation and inspected scope

Read applicable root/.agentic instructions, START_HERE, controller, project/map,
backend role, selected task/parent, MON-011 foundations, ADR-006, manifest,
MON-062 evidence and source migration/API compatibility sections. Inspected bank
schemas, six GET paths, duplicated MCP reads, account/match engines and fixtures.
Actual findings: REST list parsed pagination loosely; duplicate SQL bigint values
were asserted as Numbers without conversion; activity lacked org audit filtering;
nested imports/GL/contact names could cross ownership; match candidates mixed
currency units and treated individual journal lines as separate candidates.

Added bank-transaction-read-wire.ts, bank-transaction-reads.ts and bank-match-reads.ts.
Six GET exports use shared direct-DB read-only repeatable-read services and
jsonResponse. Original match POST and other banking writers are retained for
their assigned contract tasks. MCP read registrations moved to a dedicated
bank-transaction-reads.ts file, registered once in index.ts; six strict described
tools use AuthContext/wrapTool, without HTTP self-calls. Existing list/match names
remain, and activity/account-suggestion/import/duplicate tools are added.

Read money retains signed numeric minor units and adds *Minor strings, including
nullable balances, nested imports/open documents/candidates/payment metadata.
Canonical ISO currency is explicit; USD/JPY/KWD/IRR stored integer 1250 is never
rescaled. Numeric coexistence remains +/-9007199254740991, not full-int64 support.
Read guards reject unsafe stored operands/aggregates and ambiguous audit money.
Opaque JSON retains its own syntax/units and global numeric serialization guards;
known audit money/allocations receive aliases without modifying saved history.
reversedAllocations remains a count and percent remains a percentage.

Stable list/date/ID ordering, strict status and pagination, safe SQL count text
and bigint conversion eliminate NaN/unchecked offsets. Duplicate SQL returns
signed amount/date as text; matching signed date/amount/effective currency
groups use numeric and exact aliases, retaining the 100-pair diagnostic limit.
Imports retain the latest-20 limit. Tenant guards cover parent ownership/deletion,
related import/bank/GL/journal/contact/tax/reconciliation/plain dimensions/transfer
links. Activity filters org/entity and returns sanitized id/name/email only.

Open documents/payments/transfers are same-currency candidates. Payment journals
must be owned; void/deleted journals are not offered. Existing-journal candidates
are restricted to bank currency equaling organization base currency; complete
eligible bank legs sum debit minus credit with bigint. Individual and combined
unsafe values/mixed projected line currency reject. Org-scoped linked-entry
exclusion cannot be influenced by a foreign bank's link. Strict <1%/<5% amount
ratios use bigint, with UTC date windows and deterministic tie ordering. Historical
account suggestions join owned active GL and use exact count/percent rounding.
Original ASCII text matching remains; locale search is later work.

BANK_TRANSACTION_READ_WIRE_CONTRACTS records operation inputs/envelopes, units,
aliases/ranges, errors, authorization, sampling limits and opaque-history policy.
Updated money README/manifest, TEST_MATRIX and generated MONEY_BOUNDARIES source
inventory. No schema edits, migrations of the configured database, stored-unit
repair, IRR flags, builds, dev server or deployment.

## Acceptance mapping

1. Registry operation/money tables and strict described MCP schemas cover every
   read boundary and supported coexistence range. Numeric fields remain present;
   exact consumers use coexisting canonical aliases without dynamic negotiation.
2. Actual migrated PostgreSQL REST exported handlers and real MCP SDK transports
   exercise all six operations, numeric/exact reads, valid/invalid/expired API
   keys, custom roles, missing/foreign/deleted parents and org-header spoofing.
   Fixtures include nested references, opposite signs and currency-scale units.
3. Read-only snapshots plus accounting DB before/after assertions cover successful
   and rejected reads. Unsafe stored transaction/import/document/payment/raw/audit
   values, alias conflicts, unsafe journal aggregates, mixed currency and foreign
   references return errors without ledger/bank/audit mutation. Numeric values and
   exact aliases remain equal, including +/-MAX_SAFE_INTEGER and 5-billion sums.

## Actual verification

Commands ran at D:/Projects/dubbl using installed dependencies/generated sources.
Synthetic PostgreSQL 18 cluster:
D:/Temp/dubbl-mon063-pg-2ff894de663f4a61945c73a447ad675c, loopback port 55473,
trust-auth synthetic dubbl_ci. initdb and hidden pg_ctl startup, explicit
TEST_DATABASE_URL to this cluster only. Harness creates/migrates/drops random
disposable databases. No configured .env credentials/target were read or used.
Provider keys blank. Final psql disposable-database count was 0; pg_ctl fast/wait
shutdown succeeded. Synthetic cluster files remain outside the repository.

| Actual command/procedure | Observed result | Coverage/limit |
|---|---|---|
| Controller validate/status/context/start | Successful, valid 119-task graph; claimed MON-063 | Structural orchestration |
| pnpm test | 185/186; existing currency-rollout subprocess hit its 15-second ETIMEDOUT while checks ran concurrently | Honest failed first full run |
| node --import tsx --test --test-concurrency=1 tests/*.test.ts | Exit 0, 186/186 | Full pure suite sequentially; same startup case passed |
| Final node --import tsx --test tests/bank-transaction-read-wire.test.ts | Exit 0, 3/3 | Final opaque audit projection/pagination/ratio guards |
| node --import tsx --test --test-concurrency=1 tests/integration/bank-transaction-reads.test.ts tests/integration/bank-accounts.test.ts tests/integration/payment-settlements.test.ts | Exit 0, 3/3 | Actual routes/SDK on migrated PostgreSQL, banking/payment regression |
| Final standalone bank-transaction-reads integration reruns | Exit 0, 1/1 | Final added foreign transfer/orphan dimension cases and audit/opaque policy |
| pnpm typecheck; final npx tsc --noEmit | Completed successfully, no TS diagnostics; final command exit 0 | MDX/TypeScript only |
| pnpm lint | Exit 0, 0 errors/148 existing warnings | Whole repository; obsolete touched-source warnings removed |
| Final explicit changed-source/routes/tests npx eslint | Exit 0, clean | All touched runtime and fixture TS files |
| money_inventory.py --write; money_inventory.py | Successful, 410 columns/1493 scanned paths/1219 consumer hashes/23825 occurrences | Source coverage only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, verified actual Drizzle metadata, hashes and lines | Correct documented loader |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed | No legacy allowance increase |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Successful, 0/0 | Prior to authorized commit/push |
| git diff --check | Exit 0 | Harmless LF/CRLF notices only |

Implementation corrections were verified: REST parsed offset initially entered
the strict service schema and rejected; fixed raw query handoff. Two multiline
db identifiers missed during read extraction caused type/runtime errors; replaced
with snapshot tx. Initial touched-source unused imports were removed. Final
integration/pure/type checks passed after these fixes. A bare node inventory
cross-check failed extensionless TS resolution; reran with the script's documented
--import tsx loader successfully. No source or test was weakened to hide failures.

No full build, dev server, Docker, schema generation, configured-DB migration,
HTTP browser/OAuth session, external provider or email test. PostgreSQL 18 local
fixtures do not qualify PostgreSQL 16, clean installs or production. Sampled
suggestions/partial duplicate groups are diagnostics, not exhaustive reconciliation.
Opaque unknown history and arbitrary JSON identifiers are not remediated; no
full-int64, independent accounting/security or production/IRR approval is claimed.

## Review and handoff

Actual implementing-assistant self-review in MON-063-review-1.md. No bounded
task blocker. MON-021 retains combined acceptance and AUD-002 discrepancy.
MON-064 is next: statement/bulk import/profile contracts; MON-065..069 retain
other bank writers. Close MON-063 through controller, commit/push as explicitly
authorized, then stop after this task.
