# MON-049 attempt 1 - exact purchase order contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`758378196d545d21ab837ed97d1e05d468ab0972`, clean master working tree. The user
requested the next task and commit/push on full completion. Controller validate,
status and context selected MON-049; start claimed it. This evidence describes
verified working changes before commit. Review is implementing-assistant self-review.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-049/MON-020 scope, MON-011 and MON-047 attempt/review, ADR-006,
money manifest, source migration/API compatibility sections and actual REST/MCP,
schema, procurement, bill lifecycle, money, email and fixture code. No delegation.

## Implementation

- purchase-order-wire describes all public input schemas, decimal-major numeric/
  exact-major/minor aliases, quantity/discount/tax units, dates and ranges. Reuses
  existing exact-ratio extended-price math and guards every money component/sum.
  Additive header/line/contact aliases retain numeric v1 outputs. Existing PATCH
  line replacement no-tax/discount semantics remain explicit, including on MCP.
- purchase-orders shares scoped direct-DB reads/counts/create/edit/delete/send/
  conversion. Repeatable-read list/count envelopes and tenant reference checks
  prevent foreign relation disclosure. Counts use SQL-text sum/min/max, rejecting
  unsafe constituents/sums and mixed currency buckets without Number precision loss.
- Organization/header/line/reference locks protect numbering and mutations.
  Numbering uses both saved sequences and existing numeric forms, rejects int32
  exhaustion and reuses exported nextBillNumber under the organization lock.
  Headers/lines/links/tallies/status/number/audit commit atomically with DTO/JSON
  preflight. Saved unsafe/corrupt money, inconsistent balances, foreign dimensions,
  draft procurement activity and old/new locked dates reject before commit.
- Conversion allocates saved net/tax by exact cumulative quantities. It repairs
  the former rounded-unit-price recomputation that discarded discounts/subminor
  values. Exact active allocation metadata in transactional conversion audit
  preserves rounding residuals even after voiding earlier partial bills. Qualified
  partial conversion can subsequently convert all remaining quantities; the first
  convertedBillId remains historical. Unknown legacy partial allocations reject.
- GRN slices validate organization/supplier/order and subtract active billed
  quantities per receipt, avoiding repeated allocation to the earliest GRN. Money
  residuals and cost-center/inventory/warehouse dimensions survive slicing.
  Reverse-charge tax is excluded from supplier due. Partial/sliced reverse-charge
  amounts that cannot satisfy both saved tax and recognition rounding reject 422.
- purchase-order-reservations bridges conversion and bill lifecycle: recognition
  does not increment already reserved tallies, and void releases posted/unposted
  reservations including unmatched slices and updates PO status. Converted draft
  bill CRUD rejects edits/deletion; void/reconvert protects allocations. No old
  posted history or legacy reservation is automatically repaired.
- Thin REST routes use jsonResponse and shared services, preserving envelopes.
  Empty send/convert bodies remain accepted, malformed JSON and email input reject
  before mutation. Email delivery follows committed sent state/audit; failure is
  502 with sent state retained. Legacy attachPdf remains unimplemented/false.
- New registerPurchaseOrderTools is registered in tools/index.ts, with all eight
  corresponding operations, described input fields and wrapTool. Existing create/
  list/convert names retain their units/envelopes; purchasing.ts retains receipt,
  matching/settings/statements/remittance operations and loses duplicate PO code.
- Added pure and actual migrated PostgreSQL route/API-key/custom-role/full-SDK
  fixtures; updated contract registry, money manifest/README, API/module/MCP docs,
  test matrix and reproducible source inventory. No schema changes/migrations.

## Acceptance mapping

1. PURCHASE_ORDER_WIRE_CONTRACTS inventories every scoped REST/MCP operation,
   envelopes, units, exact aliases, defaults, signed safe ranges, dates, roles,
   counts and retained PATCH policy. It documents conversion repairs, qualified
   reservation/legacy limits, strict locking, delivery failure and remaining gates.
2. Actual routes and registered SDK on migrated PostgreSQL compare legacy,
   exact-major, exact-minor and dual clients through create/edit/detail/list,
   delete/send/convert/counts. USD 1250, above-int32, safe maxima, signed values
   and JPY/KWD labels retain units; pure fixtures cover IRR scale without enabling
   production input. Tests cover API-key scope despite conflicting org headers,
   read-only custom roles, invalid keys, foreign orders/suppliers/all exposed
   dimensions/saved references/GRNs and unique full registry tool registration.
3. SQL-text PO/bill/line/link/sequence snapshots plus audit/ledger/stock/email
   counts prove failed operations leave no committed effects. Price aliases,
   product/sum/range/date/email/JSON/quantity/selection/history errors reject.
   Injected PO/bill-line/link/tally/audit constraints roll back numbers and all
   business writes. Concurrent first numbering, send, conversion and deletion
   produce no duplicates. Real GRNI recognition/void preserves reserved quantities;
   partial void/reconversion preserves all net/tax residuals. Counts reject mixed,
   unsafe/offsetting constituents and overflow. Email fixtures blank credentials,
   exercise 502/logged failure, and prove failed audit causes no delivery.

## Verification

All commands ran at D:/Projects/dubbl with installed dependencies. Initialized
a synthetic PostgreSQL 18.6 trust-auth cluster at
`D:/Temp/dubbl-mon049-pg-6730ac00c84b441bb8594102b332f639`, loopback port 55459,
synthetic dubbl_ci role, hidden pg_ctl launch. TEST_DATABASE_URL explicitly selected
only that server; the harness migrated/removed random dubbl_ci_* databases, never
the connection target or configured app DB. PG_BIN selected installed PG18 binaries.
No .env credentials were read/printed/persisted; worker Stripe/Resend keys were blank.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 104-task graph; MON-049 selected | Structural tracking only |
| node --import tsx --test tests/purchase-order-wire.test.ts | Exit 0, 4/4 | Exact pure contracts |
| Final TEST_DATABASE_URL=... node --import tsx --test tests/integration/purchase-orders.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/bill-writes.test.ts tests/integration/bill-reads.test.ts | Exit 0, all 4 workers pass | Real handlers/full SDK, synthetic PG18.6 |
| npm test | Exit 0, 153/153 | Full unit suite; financial release qualification remains separate |
| npx tsc --noEmit | Exit 0 | Installed dependencies/existing generated sources |
| npm run lint, final full run | Exit 0, 0 errors/159 existing warnings | No additional warnings remain |
| Affected-path npx eslint; final worker rerun | Exit 0, clean | All changed TS paths |
| money_inventory.py --write then verification; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, 410 columns/1413 paths/1168 consumers/22585 occurrences | Lexical/Drizzle/hash checks, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | No new deprecated money usage |
| pg_isready; final fixture database count; pg_ctl fast/wait stop | Ready during checks; zero fixture DBs; stopped, exit 0 | Synthetic files retained outside repo |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows closure |
| git diff --check | Exit 0 | LF/CRLF notices only |

Initial typecheck caught generic narrowing that lost PO costCenterId; preserved
the actual saved-line subtype through the pure allocation helper. Fixture setup
initially lacked AP account 2100 and reused journal number 1 after earlier posting;
added the account and used getNextEntryNumber. A new MCP foreign-GRN fixture
incorrectly expected HTTP-style status on a wrapped ZodError; corrected it to
assert the actual isError result, retaining REST 400 plus unchanged-state checks.
An unused fixture bill import initially added a lint warning; removed it and
confirmed the original 159-warning baseline. No failed check is claimed passed.

The first hidden server launch used Start-Process -Wait, which followed its server
child until shutdown; its subsequent readiness probe ran after stop and returned
no response. Separate pg_isready confirmed readiness during integration. Restart
used nonblocking hidden launch for the final corrected run; zero remaining fixture
databases and clean server shutdown were verified afterwards.

Self-review added the reverse-charge partial-recognition guard, foreign receipt
bill-reference refusal, exact residual history after void, first-numbering/email/
offsetting-count coverage and corresponding documented limitations. The final
four-worker integration run includes these guards and passes after corrections.

No full build/dev/Docker, schema generation, configured database migration,
deployment, live provider/session/OAuth/browser or IRR enablement was run.
Existing migrations in isolated fixtures establish their environment; they do not
qualify production migration safety or full-range business arithmetic.

## Review and handoff

See MON-049-review-1 for honest implementing-assistant self-review. No slice
blocker remains. Complete controller check/submit/self-review/done and validate;
commit/push as authorized, then stop after this task. MON-020 retains combined
procurement acceptance; expected next task MON-050 requisition contracts. Other
procurement writers/races, legacy reservation remediation, foreign receipt FX,
full-int64 and independent financial/security/migration/IRR gates remain separate.
