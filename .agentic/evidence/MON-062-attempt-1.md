# MON-062 attempt 1 - bank account contracts

## Identity

2026-10-04, Asia/Tehran. Operator: codex (implementing assistant), self-review.
Entry HEAD 3dbbdb7238adbe6acd8f7cab84bf7445bb024f71, clean master tracking
origin/master. User requested the next task and commit/push when fully complete.
Controller validate/status/context selected MON-062; claimed with owner codex.
One bounded task; no delegated or fabricated independent review.

## Implementation and source inspection

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task and parent handoffs, MON-011 foundations, ADR-006, manifest,
source migration/API compatibility requirements and actual banking source. Bank
CRUD had independent schemas, unchecked signed numeric inputs, detached audit,
and GL links without ownership/type/currency checks. validate-balance cast sums
to int32. MCP had only a separate legacy numeric alert setter for this slice,
not bank CRUD/validation tools. Alert messages divided by 100 and used dollars
for every currency.

Added bank-account-wire.ts strict schemas and bank-accounts.ts shared services.
REST list/create/detail/update/delete/validate now use jsonResponse; new PATCH
balance-alert matches the retained MCP alert operation. Seven bank-accounts
MCP tools use direct DB/AuthContext/wrapTool and strict described schemas;
index registration and removal of the previous setter prevent duplicate names.
No REST self-calls. The documented manage:bank-rules permission for alerts is
preserved, while bank CRUD uses manage:banking.

Numeric signed balance/threshold units retain safe +/-9007199254740991 values;
canonical balanceMinor/thresholdMinor aliases must agree. All read money adds
matching *Minor strings, preserving null thresholds and nullable diagnostics.
Strict UUID/metadata/currency checks and range guards fail without committed
effects. Omitted PATCH fields retain values, not creation defaults. SQL text
sum/min/max/count plus bigint conversion reject unsafe operands, cancellation,
aggregates and differences; no int32 overflow or Number precision loss. Foreign
GL/import ownership and currency mismatch reject before disclosure. Read snapshots
use repeatable-read transactions and deterministic statement ordering.

Bank writes serialize on organization/target rows; bank row, auto-created/link
GL and awaited audit commit together. GL references must be owned, matching,
active/undeleted and unclaimed (including deleted bank claims). Standard GL reuse
now also requires compatible type/currency/activity. Existing statement/import/
payment/GL line history blocks currency/type/link changes, including opening
GL. Currency changes additionally require old/new zero balances and zero/null
threshold. Empty accounts can obtain a new compatible GL. Soft deletion retains
history. No posted history is rewritten.

Statement balance edits preserve the existing nonposting meaning; opening GL is
set separately through opening-balances. This slice has no dated ledger mutation
or period bypass. MON-022 owns opening GL contracts; the AUD-002 bank/API-vs-GL
discrepancy remains financial qualification, not asserted fixed here. Reads do
not claim statement isBalanced means GL or transactionSum equality.

Low-balance job SQL projects money as text; exact toMajorDecimal formats currency
scales and full stored int64 without float division. Invalid saved currency skips
only that account. Existing recipients/preferences, best-effort notification and
sequential daily deduplication remain. No external email/provider call in fixtures.

Registry BANK_ACCOUNT_WIRE_CONTRACTS.md records all seven operations, inputs,
outputs, units, aliases/ranges, classified failures, history/authorization rules,
and limits. Updated money README/manifest, test matrix and machine inventory.
No schema edits, migrations, unit rescaling or IRR flag enablement.

## Acceptance mapping

1. Registry, schema descriptions and SDK schema assertions document every
   operation and money field. CRUD/diagnostic range is safe numeric coexistence;
   canonical int64 syntax is parsed but unsupported magnitudes reject. Job's
   text-only message path separately supports full stored int64. USD/JPY/KWD/IRR
   fixtures keep stored integer 1250 unchanged.
2. Pure bank fixture and actual REST exported handlers/MCP SDK transports cover
   legacy numeric and exact aliases, live PostgreSQL, API keys (invalid/expired),
   custom read-only role, missing/foreign/deleted accounts, supplied org-header
   spoofing, foreign GL/import references and plan/currency limits.
3. Snapshot assertions cover rejected syntax/range/reference/history/role inputs.
   Real SQL audit trigger failures prove rollback of create, update, delete and
   alerts in REST/MCP after mutation work. Concurrent account allocation/explicit
   GL claims/deletion verify serialization. Numeric values and aliases remain
   lossless, including 5-billion aggregate; unsafe stored operands/sums/differences
   and thresholds reject. No bigint JSON crash or implicit unit repair.

## Actual verification

Commands ran at D:/Projects/dubbl, installed dependencies/generated sources.
Synthetic PostgreSQL 18 cluster:
D:/Temp/dubbl-mon062-pg-65f99f185022413fa08ccd469b0276bc, loopback 55472,
trust-auth dubbl_ci. Created with initdb; pg_ctl startup hidden, explicit
TEST_DATABASE_URL to this cluster only. Harness created/migrated/dropped randomly
named disposable databases. No .env target/credentials were read or used.
Worker provider keys blank, except a synthetic Stripe key temporarily enables
local plan checks without any provider request. Final psql count of disposable
databases was zero; pg_ctl fast/wait shutdown succeeded. Cluster remains outside
repository as synthetic test infrastructure.

| Actual command/procedure | Result | Scope / limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 119-task graph, MON-062 claimed | Orchestration, not financial proof |
| pnpm test | Exit 0, 183/183 | Full pure suite including new bank group |
| Final node --import tsx --test tests/bank-accounts.test.ts | Exit 0, 1/1 | Final schema/currency guard source |
| node --import tsx --test --test-concurrency=1 tests/integration/bank-accounts.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reversals.test.ts | Exit 0, 3/3 | Real REST/SDK on migrated disposable PostgreSQL |
| Expanded bank integration standalone final rerun | Exit 0, 1/1 | Additional range, tenant, legacy MCP and full-int64 alert cases |
| pnpm typecheck; final npx tsc --noEmit | Exit 0 | MDX/TypeScript, no build/dev |
| pnpm lint | Exit 0, 0 errors/155 existing warnings | Whole repository |
| Final explicit changed-source/routes/tests npx eslint | Exit 0, clean | Earlier broader bank-directory lint had two unchanged duplicates-route warnings |
| money_inventory.py --write; money_inventory.py; verify_money_inventory.mjs | Exit 0; 410 columns, 1486 scanned paths, 1216 consumer hashes; final 23763 occurrences | Source inventory, not runtime dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks | No increased legacy allowance |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0/0 at fetch | Before user-authorized commit/push |
| Final git diff --check | Exit 0 | Prior trailing blank lines corrected; harmless LF/CRLF notices |

Fixture failures corrected: empty alert body was validated before foreign-parent
lookup, so auth/isolation fixtures now supply a valid threshold; plan-denial
fixture initially ran in unlimited self-hosted mode, then enables only synthetic
local plan checks. Source review removed Zod partial creation defaults from PATCH,
made input descriptions explicit, classified unsafe aggregate totals before
int64 conversion, rejected foreign imports, and guarded saved currency. Final
fixtures/typecheck/affected lint/inventory pass after these changes. Expected
synthetic audit errors are silenced only around the explicit fault tests and
restored in finally; assertions still require unchanged full DB snapshots.

No full build, dev server, Docker, schema generation, configured-DB migration,
deployment, HTTP browser/OAuth session, provider or email delivery test was run.
Local PostgreSQL 18 and installed environment do not qualify PostgreSQL 16,
clean installation, independent accounting/security or production/IRR rollout.
Generic bank/configuration writers and concurrent scheduled notification delivery
remain their assigned work; no exactly-once job guarantee is introduced.

## Review and handoff

Actual implementing-assistant self-review: MON-062-review-1.md. No bounded-slice
blocker. MON-021 retains combined payment/expense/banking acceptance and existing
AUD-002 financial discrepancy. Next MON-063 bank transaction reads. Close the
controller, commit/push as the user requested, then stop after this task.
