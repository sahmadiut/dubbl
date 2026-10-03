# MON-055 attempt 1 - payment read contracts

## Identity and bounded scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD a9ba797, clean
master tree. User requested the next task and commit/push after full completion.
Controller selected MON-021. Read root/nested instructions, START_HERE/controller,
project/repository map, backend role, MON-011 evidence, ADR-006, source migration/
API compatibility, carrier handoffs and actual payment/expense/bank source.
Self-review only; no independent human/accounting or deployment approval.

Verified independent payment read, settlement/reversal, batch/schedule, expense
CRUD/claims and bank account/read/import/coding/matching/transfer/reconciliation/
rule workflows. Split per controller into MON-055 through MON-069 with MON-011
prerequisites; MON-021 retains every original criterion and combined integration.
Updated task index/source coverage, validated the 119-task graph, and implemented
only the first child, MON-055. This is not completion of the whole MON-021 parent.

## Implementation

Shared payment-read-wire and payment-reads services replace duplicated REST/MCP
list/detail readers. Numeric payment/allocation money gains exact amountMinor;
contact creditLimit and detail bank balances/threshold gain matching nullable
aliases. Reused publicMoneyDto/contactDto and guarded shared JSON/wrapTool.
Existing envelopes, units, signed/zero amounts, currencies, dates and metadata
remain intact; list does not expose the bank expansion. No FX or cash sum is added.

Both reads use repeatable-read read-only transactions. List rows/count share
a snapshot, with stable createdAt/id ordering. Shared described schemas validate
UUIDs, direction and bounded page/limit before queries. REST now rejects invalid/
fractional/out-of-range pagination instead of silently clamping/truncating it.
Captured organization context scopes all results; custom read-only roles retain
read access. MCP detail now returns a classified 404 for missing/deleted IDs.

Guard expanded contact/bank tenants and saved monetary ranges. Allocations have
no tenant column: batch-check invoice/bill/credit_note/debit_note/prepayment IDs
against actual organization-owned tables. Unknown types/missing/foreign IDs fail
422 before response. Review additionally found exposed scalar journal/statement
IDs with no tenant FK constraint; both now verify organization ownership (bank
transactions through their bank accounts). Same-tenant inactive/deleted related
history remains readable. Noncash carrier allocations are kept separate, without
reclassifying them or doubling them into cash. Creation/reversal writers remain
assigned to children, with shared carrier/FX/lock handoffs retained.

Changed application paths: lib/api/payment-read-wire.ts, payment-reads.ts,
app/api/v1/payments/route.ts, [id]/route.ts and lib/mcp/tools/payments.ts.
Added three pure groups plus actual PostgreSQL handler/SDK worker fixtures,
PAYMENT_READ_WIRE_CONTRACTS and public API docs; refreshed manifest, test matrix
and lexical inventory. Existing tool registration stays in payments.ts/index.ts.
No schema, migration, currency regime or rollout flag changed.

## Acceptance mapping

1. PAYMENT_READ_WIRE_CONTRACTS inventories both REST/MCP operations, inputs/
   envelopes, named money aliases, signed safe ranges, count/filter units,
   metadata/null/history behavior, access/scope checks, errors and exact-only/
   settlement/FX limits. Described tool schemas and API documentation agree.
2. payment-reads-worker invokes actual REST exports with real synthetic API keys,
   memberships/custom roles and registered SDK tools on disposable migrated DBs.
   It checks empty/list/detail numeric/exact parity, USD/IRR/JPY/KWD independence,
   zero/signed/above-int32/safe-max amounts, page ties/filters, viewer access,
   invalid/expired auth, org-header resistance, foreign/deleted/missing IDs,
   all five polymorphic types, missing/unknown/foreign allocations and foreign
   journal/statement links. Credit/debit-note regressions pass alongside it.
3. Pure groups guard nonfinite/fractional/unsafe saved amounts and tenant refs.
   Real SQL-int64 injections into payment/allocation/contact/bank money fail 422
   on both transports without rounding or changing SQL-text business snapshots.
   Invalid input and scope denials also leave snapshots unchanged. API-key usage
   bookkeeping is excluded explicitly from business snapshots. Nullable/deleted/
   inactive history and paired noncash rows keep compatible types/aliases with
   no bigint JSON crashes. All final checks below pass.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18.6 cluster: D:/Temp/dubbl-mon055-pg-db36b3b97df24f1bacaf7b9d5a4a6058,
loopback port 55465, synthetic trust-auth dubbl_ci role. Explicit TEST_DATABASE_URL
selected that server. Harness migrated/dropped randomly named fixture databases;
configured local/production database and credentials were not inspected or used.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start/block/split/start MON-055 | Exit 0; valid 119-task graph | Structural only |
| node --import tsx --test tests/payment-read-wire.test.ts | Exit 0; 3/3 | Pure groups |
| Initial disposable payment-reads integration | Exit 0; 1/1 | Before additional scalar link guards |
| Final node --import tsx --test tests/integration/payment-reads.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts | Exit 0; 3/3 | Final runtime source; actual handlers/SDK/PostgreSQL, no real HTTP OAuth/session |
| npm test | Exit 0; 169/169 | Pure suite; later DB-only link guard additionally covered by final integration |
| Final pnpm typecheck | Exit 0; MDX generation and tsc --noEmit | Existing installed/generated environment; no build |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Full source lint |
| Final npx eslint of all eight affected TS files | Exit 0; clean | Includes worker/pure tests and runtime services |
| money_inventory.py --write then verification | Exit 0; 410 columns/1446 paths/1191 consumers/23088 occurrences | Lexical queue only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; columns/consumer hashes/source lines verified | Metadata only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No newly introduced deprecated helper use |
| Remaining fixture DB query; pg_ctl -m fast -w stop | 0 remaining fixture databases; shutdown exit 0 | Temporary cluster retained outside repository |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Authorized push follows closure |
| git diff --check; controller validate | Exit 0 | Line-ending notices only; structural workflow validity |

Initial initdb failed because redirected output made its target directory nonempty;
retry placed the log outside the data directory. Start-Process -Wait waited on the
server process tree despite successful startup. Ran the initial fixture separately,
then cancelled that launcher, which also stopped its descendant server. A subsequent
three-fixture attempt therefore failed ECONNREFUSED before creating databases.
Restart single-process WaitForExit timed out during recovery/fsync (log-sharing
delay); server completed recovery afterward. Confirmed readiness and ran the final
three-fixture command successfully, then shut down cleanly. These environment
failures are not represented as passing tests. Initial affected lint found two
intentional discarded-bank variable warnings; explicit void resolved them. A docs
patch had an invalid test-matrix anchor and applied no changes; corrected it.

No full build, dev server, Docker, provider, browser/session/OAuth, configured-target
migration, schema generation, deployment or IRR enablement occurred. Financial,
production/migration/security/release qualification remains assigned work.

## Review and handoff

See MON-055-review-1 for implementing-assistant self-review. No slice blocker.
MON-021 retains combined acceptance; next task MON-056 payment settlement.
Close through acceptance/submit/self-review/done, validate staged content, commit
and push as requested, then stop after this completed child.
