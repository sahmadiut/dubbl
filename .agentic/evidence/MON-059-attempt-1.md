# MON-059 attempt 1 - scheduled payment contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD bfd1de9,
clean master tracking origin/master. User requested the next task and commit/push
on full completion. Controller selected MON-059; claimed coding-assistant ownership.
Read root/nested instructions, START_HERE/controller/project/map/backend role,
MON-011 evidence, ADR-006, source migration/API compatibility, money manifest and
MON-042/045/048/051/058 settlement/carrier handoffs. Self-review only.

## Implementation

New scheduled-payment-wire and scheduled-payments services replace independent
REST read/write/process paths. Numeric amount remains positive integer currency
minor units; amountMinor adds canonical integer strings with exact alias agreement.
Safe-number coexistence rejects values above 9007199254740991 before mutations;
no currency/magnitude rescales stored units. Header and nested bill/contact money
add matching *Minor aliases. Scoped bill/contact/journal/money checks precede
disclosure; repeatable-read snapshots retain envelopes, filters and pagination.
New detail GET complements the existing list/CRUD/process routes. Six described,
strict MCP tools use direct DB services and wrapTool, registered in index.ts.

Org/schedule locks serialize adopted writes and settlement. Creation validates
recognized outstanding supplier bills, contact/currency/date/lock/overpayment.
Pending edit checks saved/new dates and current references/balance; cancellation
can release stale intent. Soft-delete never reverses cash, rejects processing/
completed rows, and preserves safe same-tenant history. CRUD and audit are atomic.

Due processing selects IDs only, then rereads each row under the locks. Each item
uses MON-056 transaction settlement with saved date/currency/notes, bank_transfer
and existing GL 1100. Payment, allocation, exact carrying/payment-date FX, journal,
bill paid/due/status/paidAt, numbering, schedule completion/processedAt and mandatory
audits commit together. Schedule process audit links paymentId. Final audit faults
roll back ALL item effects. Concurrent/repeated processing cannot duplicate cash;
changed/future/deleted/cancelled/completed items skip after locking. No guessed
historical matching or public retry key. Independent successes remain committed.
Failures remain pending and add classified failed/failures/skipped to the existing
processed/total envelope. Legacy failed/processing rows are not automatically retried.

The existing form's prefill and parsing now use exact currency scales, bigint
half-away rounding and amountMinor, plus the selected bill currencyCode. Invalid
input gives a validation toast. It reports failed pending attempts instead of
claiming no due payments. Removed its deprecated parseMoney allowance. Existing
display formatter remains assigned locale work. No dedicated scheduled-payment
Trigger/cron caller existed; existing dashboard on-load/manual processing and MCP
now share the service. No unattended cash-posting job is added.

Registry SCHEDULED_PAYMENT_WIRE_CONTRACTS, API docs, manifest, test matrix and
lexical inventory document all operations/aliases/units/ranges/errors/retry policies.
No schema, migration, historic-unit, production feature flag or IRR change.

## Acceptance mapping

1. Registry and API docs enumerate six REST/MCP operations, strict field schemas,
   amount/amountMinor integer-minor units, USD default/matching currency, dates,
   numeric/Minor nested envelopes, safe monetary bounds, list behavior and errors.
   Pure fixtures preserve USD/JPY/KWD/IRR 1250 and exact form scales/ties/safe max.
2. Disposable PostgreSQL fixtures invoke actual REST handlers with API keys and
   actual MCP SDK linked transports. Both legacy and exact clients exercise create,
   list/detail/edit/cancel/delete/process, read-only reads, custom payment role,
   denied read-only writes, expired/invalid keys and foreign org/references. Header
   override does not change API key scope. All six tool registrations are checked.
3. Invalid aliases/syntax/ranges/dates/state/references/currency and overpayment,
   period/fiscal locks, missing cash/rates, saved unsafe/null/foreign/deleted history
   fail without committed effects. Snapshot comparisons include schedules/bills/
   lines/payments/allocations/GL/accounts/numbering and all non-API-key audits.
   Injection at final process audit proves rollback after cash and status updates;
   create/edit/delete audit faults also roll back. Competing REST/MCP process calls
   post once; repeat is a no-op. Process/cancel race gives one valid serialized
   outcome. Future and legacy ambiguous statuses never auto-process. Partial success
   preserves valid independent item, reports stale item, then exact edit/retry settles
   remaining balance. Safe-max JSON retains numeric and string money. EUR schedules
   retain currency and payment-date FX 3 versus recognition FX 2; cash/control/FX
   journal balances, saved date/notes/allocation/paidAt and payment audit links assert.

## Actual verification

Commands ran at D:/Projects/dubbl using installed dependencies. Synthetic
PostgreSQL 18.6 cluster D:/Temp/dubbl-mon059-pg-67254aafd874463f9ee4d5b3b84bc4d8,
loopback port 55469, trust-auth dubbl_ci role. Hidden pg_ctl launcher. Explicit
TEST_DATABASE_URL pointed only to this synthetic cluster; harness created,
migrated and dropped random disposable databases. Configured .env target and
credentials were neither read nor used. Provider keys blank in fixtures.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119 tasks, MON-059 selected | Structure only |
| pnpm test (scheduled-payment-wire groups) | 2 pure groups passed in the full suite | Adapters/schemas, no browser |
| pnpm test | Exit 0; 177/177 | Unit/pure suite |
| node --import tsx --test --test-concurrency=1 tests/integration/scheduled-payments.test.ts tests/integration/payment-batches.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reversals.test.ts tests/integration/payment-reads.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts | Exit 0; 8/8 | Actual handlers/SDK/disposable PostgreSQL |
| Final node --import tsx --test tests/integration/scheduled-payments.test.ts | Exit 0; 1/1 | Final additional MCP permission/scope/strict fixtures included |
| pnpm typecheck | Exit 0; MDX and tsc --noEmit | Installed/generated environment |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Full repository |
| Final pnpm exec eslint on ten changed source/fixture paths/globs | Exit 0; clean | Changed TS files |
| money_inventory.py --write; money_inventory.py; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 410 columns/1468 paths/1209 consumer hashes/23422 occurrences | Lexical/metadata checks |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Deprecated-helper gate |
| git diff --check; git fetch origin; rev-list HEAD...origin/master | Exit 0; origin 0 ahead/0 behind before commit | Push after controller closure |
| psql fixture database count; pg_ctl -m fast -w stop | Zero disposable DBs; clean shutdown exit 0 | Cluster retained outside repo |

Initial fixture failures exposed MCP's default unknown-field stripping, corrected
by strict registerTool schemas. Subsequent fixture setup failures were missing
draft dueDate and incorrect exchangeRate property names; corrected against actual
schema. An unavailable default cash account is classified 400, not the initially
expected 422; fixture corrected to service policy. Final successful runs include
all repairs. Expected injected audit diagnostics are synthetic and asserted full
rollback errors; they are not unexplained failed checks. Two preliminary evidence
read commands had an invalid PowerShell Skip value; no file mutation occurred.
The hidden startup launcher stayed attached until server shutdown, then its
trailing readiness probe returned no response/exit 1. pg_ctl itself started with
exit 0; successful PostgreSQL suites, zero-database query and explicit shutdown
verify the lifecycle. No failing final readiness or live test server is claimed.

No builds, dev server, Docker, configured DB migration/reset, schema generation,
live browser/session/OAuth/provider/email, deployment or IRR enablement ran.
Adopted org locks serialize adopted writers; unrelated lock/configuration/bank/
contact-merge writers retain their own concurrency qualification. Legacy stuck
processing rows need provenance recovery, not automatic retry. Full-int64,
broader locale/UI, long-run performance, independent financial/security/migration/
release qualification remain assigned work; MON-021 retains combined acceptance.

## Review and handoff

See MON-059-review-1 for actual implementing-assistant self-review. No bounded
slice blocker. Close controller criteria/submit/self-review/done, validate staged
content, commit and push as requested, then stop. Next MON-060 expense CRUD contracts.
