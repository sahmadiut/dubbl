# MON-014 core accounting integration acceptance - attempt 1

## Identity and scope

2026-10-09, Asia/Tehran. Operator: codex (implementing assistant). Repository
D:/Projects/dubbl, master, entry HEAD aab1c45bef75fde7bb7bc521ae742fc8fed3a01a.
Working tree clean at entry. User requested complete and push next task; controller
selected MON-014, the ready integration parent of MON-017 through MON-022. Claimed
through start --owner codex. Exactly this task, no delegation. Changes uncommitted
at evidence creation; commit and authorized push follow controller closure.

Read applicable root/nested instructions, START_HERE/controller/project/map/backend
role, source migration/compatibility sections, ADR-006, task/dependency evidence,
current domain inventories, actual REST/MCP/wire/service/fixtures and relevant
dashboard request bodies. Applied local Dubbl controller task skill. Review is
honestly self-review, without peer/human/accounting or production approval.

## Implementation and findings

- CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md indexes the six complete domain
  inventories and their operations, units, aliases, envelopes, safe ranges,
  errors, scope and qualification boundaries. Updated manifest/test matrix,
  contact/journal registries, money README and lexical source inventory.
- Added core-accounting-integration.test.ts/worker. Actual API-key REST exports
  use hashed keys, memberships/custom roles and misleading tenant headers.
  MCP invokes registerAllTools over real SDK InMemoryTransport, asserts unique
  tool names and described full contact schemas, and exercises all six contact
  operations. Existing correct domain services are reused.
- Eight scenarios cross USD/IRR/JPY/KWD with legacy 1250 and exact 3000000000
  writers. Configuration mileage and contact limits preserve the same raw units;
  manual REST journal writes and exact MCP replacements/read/post preserve
  legacy fixed /100 REST strings versus minor-unit MCP numbers. Invoice/bill
  numeric prices instead use their explicit currency-major adapter.
- Recognition agrees with GL AR/AP and REST contact balances. New bank cash
  settlement, idempotent replay, expense reimbursement/reversal, contact merge
  of saved invoice/bill/payment references and subsequent cash deletion/reversal
  preserve allocation ownership and amounts. Manual reversal leaves bank cash
  zero; AR +value and AP -value are restored. SQL numeric sums verify every
  posted journal is balanced; surviving contact limit is 1250.
- Reproduced unsupported contact creditLimitExact being discarded by SDK raw
  schemas while a name update commits. All six contact tools now register full
  strict schemas; REST create/update are strict too. Existing field descriptions,
  defaults, metadata/nullable differences, business logic and wrapTool stay intact.
- Reproduced unsupported nested journal debitAmountExact being discarded before
  balanced creation. The shared line schema now rejects unknown fields on REST
  and MCP creation/full replacement. Recurring template rate validation projects
  only its three FX fields into that strict adapter. Updated the contact child's
  direct registered-schema fixture to receive full schemas; the new parent's
  real SDK fixture supplies actual transport coverage.

## Acceptance mapping

1. The new core registry plus linked contact and five integration registries
   enumerate every adopted operation/field contract. Minor integers, major
   prices, historical decimal journal output/import, canonical aliases, saved
   quote_per_base FX, quantities/basis points/dates and int64 approval comparison
   versus safe-number document limits are explicit. No generic cents assumption,
   magnitude-driven negotiation or full-int64 promise is introduced.
2. The independent core fixture, five domain-parent suites and all forty child
   operation suites pass against current source on migrated disposable PostgreSQL.
   Actual legacy/exact/dual handlers and SDK tools exercise old/exact clients,
   tenant headers/foreign IDs, denied roles/keys and period locks. Existing domain
   fixtures cover all individual operations, tax/approval, procurement/stock,
   imports/recurrence, saved FX, faults, history and concurrency.
3. SQL-text snapshots cover organization/contact/configuration, documents/lines,
   payments/allocations, bank/expense rows, GL, numbering, locks and non-auth
   audit rows. Unsupported fields, malformed/conflicting/out-of-range aliases
   and denied/locked calls reject unchanged. Distinct numeric/decimal and exact
   aliases retain the units throughout persisted workflows without bigint JSON
   crashes. Child regressions retain safe-max/unsafe-history and fault rollback.

## Verification

All commands from repository root with installed dependencies/existing ignored
generated sources. Separate synthetic trust-auth PostgreSQL 18.6 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon014-pg-1948f806bca64184aadf1af581b6ddb4,
127.0.0.1:55414, UTC, max_locks_per_transaction=256. Explicit TEST_DATABASE_URL
points only there; the harness creates/migrates/drops random dubbl_ci_* databases.
Configured .env/application DB and privileges were untouched. Provider keys blank
in the new worker; IRR_PRODUCTION_ENABLED=false. No secrets or customer data.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0, valid 173-task graph, MON-014 selected | Structural workflow only |
| Final node --import tsx --test --test-concurrency=2 with the ten files below | Exit 0, 10/10 passed, none skipped | Includes independent core, all six domain groups and three journal child suites |
| node --import tsx --test --test-concurrency=2 with the 36 remaining files below | Exit 0, 36/36 passed, none skipped | Together 46 suites including every one of forty child operation suites |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 359/359 passed, none skipped | Full unit/transport suite |
| Final pnpm typecheck | Exit 0, MDX + tsc | After all runtime/fixture changes; no build |
| pnpm exec eslint on eight changed TS files | Exit 0, clean | Includes runtime routes/wire/tools and all changed/new fixtures |
| pnpm lint | Exit 0, zero errors/106 existing warnings | Warnings outside changed files |
| money_inventory.py --write then without --write | Exit 0, 415 columns/1881 paths/1408 consumers/26820 occurrences | Lexical metadata only; schema-column classifications unchanged |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, columns/hashes/source lines verified | Not transitive arithmetic qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks passed | Legacy consumer lint gate |
| git diff --check; controller validate | Exit 0 | Line-ending notices only |
| git fetch origin master; rev-list --left-right --count HEAD...origin/master | Exit 0, baseline 0/0 before commit | Push follows controller completion |
| psql fixture DB count; pg_ctl -m fast -w stop | Count zero; server shutdown exit 0 | Cluster files retained outside repository; path note removed |

Ten files: tests/integration/{core-accounting-integration,contact-wire,
journal-integration,journal-wire,journal-lifecycle-wire,recurring-journal-wire,
receivable-document-integration,payable-procurement-integration,
payment-expense-bank-integration,configuration-integration}.test.ts.

Remaining 36: tests/integration/{invoice-reads,invoice-writes,invoice-lifecycle,
quotes,credits,sales-receipts,recurring-invoices,invoice-bulk,bill-reads,bill-writes,
bill-lifecycle,purchase-orders,purchase-requisitions,debit-notes,goods-receipts,
bill-bulk,procurement-settings,payment-reads,payment-settlements,payment-reversals,
payment-batches,scheduled-payments,expense-crud,expense-lifecycle,bank-accounts,
bank-transaction-reads,bank-imports,bank-categorization,bank-document-matches,
bank-transfers,bank-reconciliations,bank-rules,organization-settings,
tax-rate-contracts,tax-period-contracts,approval-contracts}.test.ts.

Diagnostic attempts are not counted as passes. Initial core runs reproduced both
unsupported-alias writes, then passed those assertions after repairs. Fixture
lock setup initially used nonexistent lockedThrough instead of lockDate, and
expected 403 instead of the established 422 for a locked settlement; corrected
to actual schema/error contracts. An attempted combined documentation patch
rejected its unmatched context atomically and was reapplied correctly. No product
failure was hidden by weakening a financial assertion. Final suites run after all
source changes, including recurring rate projection and added SDK contact coverage.

## Review and handoff

See MON-014-review-1.md for actual implementing-assistant self-review. No bounded
blocker remains. Complete controller criteria/submit/self-review/done, validate,
commit only task-owned paths, push authorized origin/master, verify remote SHA
and clean tree, then stop. Do not begin the next selected task in this request.

No full build, dev server, Docker, schema generation, configured/production
migration/reset, provider, browser/session/OAuth, deployment or IRR gate change.
Fixtures establish handler/SDK compatibility on PostgreSQL18, not PostgreSQL16
or independent financial/security/linguistic/production qualification. Existing
AUD-002 defects, full-int64/historical FX/remediation, universal atomic audit,
configuration/reference races and MON-007/008/010/QA/release gates remain. Manual
header/import and other legacy whitelist policies stay documented. Inventory,
report and public/export/opaque parent tasks retain separate acceptance.
