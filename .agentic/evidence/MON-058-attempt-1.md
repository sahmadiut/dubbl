# MON-058 attempt 1 - payment batch contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD 0a52937,
clean master tracking origin/master. User requested the next task and commit/push
after completion. Controller validate/status/context selected MON-058; started
with coding-assistant ownership. Read root/nested instructions, START_HERE,
controller/project/map/backend role, MON-011 evidence, ADR-006, source migration/
compatibility sections, manifest and payment/credit/bulk/bill/debit-note handoffs.
Self-review only; no independent accounting, financial or deployment approval.

## Implementation

Shared payment-batch-wire and payment-batches services replace immediate batch
REST/MCP floating conversion and stored batch independent writers. Immediate
numeric allocations remain decimal major units, adding amountExact and amountMinor;
stored items remain positive numeric minor units plus amountMinor. Exact rational
alias agreement, positive tie rounding, frozen currency scales and bigint sums
guard prices/products/totals. USD 12.50 remains 1250; JPY/IRR/KWD new major inputs
use their scale instead of unconditional x100. Stored history never resizes.

The MON-056 settlement service can execute within the caller's transaction,
retaining its role/organization/document/history/bank/period/fiscal/FX/number/audit
checks. Immediate batching records one payment with all distinct allocations,
normalized retry keys and safe numeric/Minor outputs. Stored create/edit validate
recognized outstanding supplier bills, contact/currency, totals/counts and final
nonempty distinct items, then commit header/items/audit together. Unknown removal
IDs fail. Lists/detail validate scoped relations, nested money and scalar bill
journal ownership in repeatable-read read-only snapshots, preserving envelopes.

Stored submission now commits ALL items and their payments/allocations/GL/balances/
paidAt/numbering/status/timestamps/audit together. Any rejection, including final
audit failure, leaves the draft unchanged. No false completed state after partial
processing. One payment per bill uses UTC-today, bank_transfer and existing GL1100.
Concurrent/repeated submit cannot duplicate cash. Successful submit audit maps
items to payments. Five new described MCP tools expose stored list/detail/create/
edit/submit and are registered in index.ts; existing record/remittance tools share
the REST services and wrapTool.

Shared remittance qualifies completed items, retained submit mapping, live same-org
payments/allocations and live posted unreversed journal source/date. Draft, old
unlinked, malformed, foreign, inconsistent and reversed history fails before
export or email/log writes. Batch/group/line money adds explicit Minor strings;
group totals use bigint. Exact decimal/bigint Intl formatting retains safe-max
fractions; organization/supplier/bill/reference/message text is HTML escaped.
REST/MCP preflight all groups and rendered messages before sequential external
delivery. Missing email skips; existing best-effort send audit is awaited. Empty
REST send body stays supported; malformed nonempty JSON rejects. No real email
was sent by fixtures. Provider deliveries remain nontransactional and repeats
can resend; older batches are not repaired or matched by guessing.

Contract registry, API documentation, matrix, manifest and lexical inventory
are updated. Four migrated legacy-helper allowances are removed. No schema,
migration, production flag or posted-history rewrite. MON-021 keeps combined work.

## Acceptance mapping

1. PAYMENT_BATCH_WIRE_CONTRACTS inventories every adopted REST/MCP boundary,
   envelope, numeric/exact unit distinction, aliases/rounding, optional/default
   fields, supported range, scope/lock/retry/state/export policies and remaining
   gates. API documentation and MCP descriptions agree with implementation.
2. Actual REST exports use synthetic API keys, memberships/custom read-only and
   payment-only roles, two organizations and spoofed tenant headers. Registered
   SDK callbacks use linked in-memory transports and real PostgreSQL queries.
   Fixtures cover numeric/exact/dual immediate received/made/multi/partial cash,
   normalized retry aliases/order, stored CRUD/list/detail/submission, remittance
   data/send-skipped operations, safe-max, four scales, role/auth/key-expiry and
   tenant isolation. Seven related operation workers pass.
3. SQL-text snapshots of money, batches, documents, banks, accounts, sequences,
   email logs and non-API-key audits remain unchanged for rejected inputs/history.
   Malformed/conflicting/unsafe aliases, sums, duplicates/direction/contact/currency,
   references, locks/closed years, states, stale balances and missing FX reject.
   Forced final batch audit failure rolls back earlier payments and GL, item and
   header state, numbering and all audits in REST/MCP; draft create/edit audits
   roll back too. Concurrent submissions yield one completion and one 400.
   Malformed export provenance, nonposted linked journal, older unlinked and
   reversed payments cannot produce remittance/send effects. Safe-max numeric
   money and exact strings serialize without precision loss or bigint crashes.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18.6 cluster D:/Temp/dubbl-mon058-pg-3a79e3d9485947e294e5e0dec4543f0d,
loopback port 55468, trust-auth dubbl_ci test role; pg_ctl launched hidden. Explicit
TEST_DATABASE_URL selected only this cluster. Harness created/migrated/dropped
random disposable databases. Configured target/.env credentials were not read
or used. Worker Stripe/Resend keys are blank; suppliers have no email addresses.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119-task graph, MON-058 | Structural |
| node --import tsx --test tests/payment-batch-wire.test.ts | Exit 0; 2/2 | Pure schema/rounding/formatting |
| Final npm test | Exit 0; 175/175 | Pure suite |
| node --import tsx --test --test-concurrency=1 tests/integration/payment-batches.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reversals.test.ts tests/integration/payment-reads.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0; 7/7 | Actual handlers/SDK/PostgreSQL; before final extra negative fixtures |
| Final node --import tsx --test tests/integration/payment-batches.test.ts | Exit 0; 1/1 | Final fiscal/provenance/journal negative cases included |
| Final pnpm typecheck | Exit 0; MDX and tsc --noEmit | Installed/generated environment |
| Final pnpm lint | Exit 0; 0 errors/155 existing warnings | Full repository |
| Final npx eslint on sixteen changed TS paths | Exit 0; clean | Final changed source/fixtures |
| money_inventory.py --write and verify; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 410 columns/1462 paths/1206 consumer hashes/23334 occurrences | Lexical/Drizzle metadata |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No deprecated helper adoption |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Push follows closure |
| Fixture DB count; pg_ctl -m fast -w stop | Zero fixture DBs; exit 0 shutdown | Cluster retained outside repo |

Initial typecheck found a REST/MCP conditional return type's paymentDate access;
made the date a common additive field, then typecheck passed. Initial focused
lint found three unused fixture imports, later repaired with the complete fixture.
Concurrent accidental Codex session edits changed the worker and two service
files outside this agent's calls. A regression run and full lint then failed on
the incomplete worker's end-of-file parse error; three related workers still
passed. Owner confirmed the other session was accidental and disabled, explicitly
instructing continuation and repair. Preserved/reviewed shared changes, completed
the fixture and ran successful final checks above. No failed run is completion
evidence. Injected SQL audit errors intentionally yield 500/MCP errors with full
rollback; these are verified negative cases.

No build, dev server, Docker, live HTTP/session/OAuth/provider/email, configured
target migration, schema generation, deployment, independent review or IRR
enablement. Full-int64, unadopted schedule/bank/config/lock writer concurrency,
generalized retained rounded reversal carrying and financial/migration/security/
release gates remain assigned work. Long batches/real provider delivery have no
performance or availability qualification here.

## Review and handoff

See MON-058-review-1 for implementing-assistant self-review. No slice blocker.
Close controller criteria/submit/review/done, validate staged content, commit and
push as requested, then stop. Next task MON-059 exact scheduled payment contracts;
MON-021 combined criteria remain open.
