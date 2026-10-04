# MON-057 attempt 1 - payment reversal contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD 0409565,
clean master tracking origin/master. User requested the next task, followed by
commit/push only after completion. Controller validate/status/context selected
MON-057; started with coding-assistant ownership. Read root/nested instructions,
START_HERE/controller/project/map/backend role, MON-011 evidence, ADR-006,
requirements migration/compatibility sections, manifest and MON-042/045/048/051/
056 handoffs. Self-review only; no independent financial or deployment approval.

## Implementation

Replaced duplicated REST DELETE and registered delete_payment code with shared
payment-reversals service and described UUID fields. The public response remains
{success:true}; no monetary input, rate lookup, representation negotiation or
currency rescaling. Numeric/exact clients reverse the same stored payments.
Safe bigint subtraction/addition never clamps or silently repairs balances.

Scope/identity, active allocation sums, document recognition/state, bank/provider
links, period/fiscal locks and saved journal values are checked in one transaction.
Organization lock serializes adopted payment/carrier writers, documents and
journals are read under row locks. Missing/deleted/foreign primary UUIDs return
404; malformed 400; forbidden roles 403. Corrupt/range/history failures return
422. Statement-linked or Stripe-backed payments return 409 for unmatch/refund
workflow; deletion performs no provider operation or statement balance update.

Cash journal reverses every saved leg, including zero control and realised FX,
with original currency/rateExact/legacy rate/direction/version/status/provenance/
cost-center/project. Source/date/currency, ownership, nonnegative one-sided
balanced safe totals and unreversed live posted status qualify the journal.
Legacy null sourceId qualifies through its saved reference. Reversal and original
link each other; original lines remain untouched. New journal numbering checks
positive int32 capacity under organization lock. Inactive owned bank/GL history
can reverse; foreign references fail.

Paired credit/debit notes restore amountApplied/amountRemaining/status and target
paid/due/status/paidAt, without another GL or stock change. Prepayment restores
credit remaining/status and reverses only its application journal, preserving the
original deposit. Note void queries now exclude soft-deleted carriers; reapply and
void fixtures verify no double unwind. Allocation rows and payment metadata are
retained as history. All changes and mandatory delete audit commit atomically;
audit JSON is preflighted with numeric-compatible exact minor aliases. Failure at
the final audit insert rolls back balances, journals/links and tombstone.

Contract registry, public docs, matrix and lexical inventory are updated. No schema,
migration, rollout flag or posted-history repair. MON-021 retains combined work.

## Acceptance mapping

1. PAYMENT_REVERSAL_WIRE_CONTRACTS inventories both boundaries and success/error
   envelopes, UUID/no-money inputs, original minor units, audit aliases, safe money/
   sum/FX/number ranges, identity/lock/bank/carrier and unsupported history policies.
   Public docs and described registered MCP fields match actual implementation.
2. Actual REST exports use synthetic API keys, two organizations, memberships and
   custom read-only/payment-only roles; full registered SDK callbacks run over
   linked in-memory transports with real DB queries. Tests cover numeric/exact
   created cash, received/made, multi/partial, above-int32 and safe-max, four currency
   scales, saved FX after edits, dimensions, inactive bank, legacy null sourceId,
   paired note reapply/void, prepayment, auth/key expiry, spoofed tenant header and
   foreign/missing IDs. Six regression workers pass on current source.
3. Complete SQL-text business snapshots cover rejected UUID/auth/tenant/lock/fiscal/
   bank/provider/unsafe/corrupt history, including foreign documents/accounts/
   dimensions, inconsistent pairs/balances, changed journal source/date, quarantined
   FX and exhausted journal numbers. Forced final audit rejection preserves cash
   and noncash snapshots in REST and MCP. Concurrent deletes yield one success,
   one 404, one reversal and one audit. Original GL lines and metadata are compared
   exactly; money JSON/audit aliases remain numeric-compatible with no bigint crash.

## Verification

All commands at D:/Projects/dubbl with installed dependencies. Synthetic PostgreSQL
18.6 cluster D:/Temp/dubbl-mon057-pg-d40b14b27a1d433aa46d47f34e0028bc,
loopback port 55467, trust-auth dubbl_ci test role; pg_ctl launch was hidden.
Explicit TEST_DATABASE_URL selected only this cluster. Harness creates/migrates/
drops random fixture databases. Configured target/.env credentials were not used.
Worker Stripe key is blank; no provider calls.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119-task graph, MON-057 | Structural |
| npm test | Exit 0; 173/173 | Pure suite including reversal arithmetic |
| Final node --import tsx --test --test-concurrency=1 tests/integration/payment-reversals.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reads.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0; 6/6 | Real handlers/SDK/PostgreSQL; no live HTTP/session/OAuth |
| Final pnpm typecheck | Exit 0; MDX and tsc --noEmit | Installed/generated environment |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Before final review refinements; affected checks below |
| Final npx eslint on nine changed TS paths | Exit 0; no warnings/errors | Final service and expanded fixtures |
| money_inventory.py --write and verify; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 410 columns/1456 paths/1201 consumer hashes/23307 occurrences verified | Lexical/Drizzle metadata, not financial qualification |
| verify_legacy_money.mjs | Exit 0; 9 checks | No deprecated helper adoption |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Push follows closure |
| git diff --check; controller validate | Exit 0 | Structural/whitespace |
| Fixture DB count; pg_ctl -m fast -w stop | Zero fixture DBs; shutdown exit 0 | Temporary cluster retained outside repo |

Initial typecheck exposed nonexistent matchedPaymentId and fixture union/FX field
names; corrected to actual bank journal links, explicit queries and targetCurrency.
Initial fixtures used a credit limit that overflowed when leaving safe-max invoices
unpaid and changed organization base currency without qualifying old control
accounts; corrected synthetic setup and exercised JPY/IRR/KWD under USD with
explicit fixture rates. Lock status expectations corrected to existing 422.
Review FX quarantine initially got repaired by the DB synchronization trigger;
disable/re-enable only that disposable fixture trigger around the deliberate saved
status corruption, then verify rejection. Injected audit errors intentionally return
REST 500/MCP errors while retaining snapshots; these are expected failure cases.

A later concurrent six-suite rerun failed in migration subprocess startup before
workers ran; the harness hid detailed migration stderr. A fresh diagnostic
disposable migration immediately passed; final six-suite serial run passed all
workers. No migration source changed. An inventory check initially omitted
--import tsx and failed module resolution; corrected invocation passes. Evidence
records these failed attempts without claiming a diagnosed infrastructure cause.

No build, dev server, Docker, configured-target migration, schema generation,
browser/session/OAuth, live provider, deployment, independent review or IRR enablement.
Out-of-order rounded reversals retain saved legs; retained carrying can fail the
existing settlement proportional-history guard. Unwinding remaining applications
before new cash is documented and fixture-qualified. Generalized residual carrying,
simultaneous unadopted batch/schedule/bank/lock/configuration writers, full-int64,
financial/migration/security/release gates remain MON-021/assigned work.

## Review and handoff

See MON-057-review-1 for implementing-assistant self-review. No bounded-slice
blocker. Close through controller, commit/push as requested, then stop.
Next task MON-058 payment batch contracts; parent combined criteria remain open.
