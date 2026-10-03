# MON-047 attempt 1 - exact bill CRUD write contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`0f6e77e71776b9fdaf0e0f2192dbf0d32b91d38e`, clean master working tree. The user
requested the next task and commit/push after full completion. Controller
validate/status/context selected MON-047, then start claimed it. This evidence
describes verified working changes before commit; self-review only.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-047/MON-020 scopes, MON-011 attempt/review, MON-046 attempt/review,
ADR-006, source migration/API compatibility sections, money manifest and actual
REST/MCP/bill/procurement/schema/money/test code. No delegation, build or dev server.

## Implementation

- bill-write-wire adds described create/update schemas, exact major/minor price
  aliases and safe header DTOs. Reuses existing invoice exact-ratio arithmetic
  without the invoice-only price-list/cost-center input. Both bill transports
  retain decimal-major prices, physical quantities and basis-point discounts.
  Price, rounded gross/net/tax and header/reverse-tax/due sums use bigint guards.
- bill-writes shares direct-DB create/update/delete between real REST and MCP.
  New references validate tenant/availability with share locks, including receipt
  lines through their parent and source POs. Saved header/line money and historical
  tenant references validate before edit/delete, even before full replacement.
  Drafts with payments or a journal link reject. Strict period checks cover old
  and replacement dates and closed fiscal years.
- Organization/header locks serialize CRUD and first numbering. Auto numbering
  skips arbitrary supplier identifiers and uses both sequence and existing numeric
  forms to avoid supplied BILL-number collisions; signed int32 exhaustion rejects.
  Duplicate off/warn/block/hold and pending-approval submission retain REST policy
  and are available to MCP. Warn acknowledgement cannot override block or hold.
- Every operation commits number/header/lines/PO links/soft delete/audit together.
  Failed audit now rolls back bill mutation. DTO/JSON preflight happens before
  commit, preserving numeric headers and additive *Minor strings without bigint
  serialization failure. Existing soft-delete behavior keeps header/PO links and
  removes lines. These CRUD writers never post ledger, stock or allocations.
- Reverse-charge VAT stays in taxTotal/total but is excluded from supplier due.
  PATCH and MCP create previously overstated supplier due; they now share the
  existing REST create rule. No posted history is changed or revalued.
- Two thin REST writer routes use jsonResponse; GET behavior is retained. Existing
  registerBillTools adds update_bill/delete_bill and adopts create_bill, with
  described inputs, wrapTool and server-created AuthContext. Lifecycle/pay tools
  remain assigned to MON-048/MON-021. No new registration file is needed.
- Added pure contracts and actual migrated PostgreSQL REST/API-key/custom-role/
  registered-SDK fixtures. Updated BILL_WRITE_WIRE_CONTRACTS, API/MCP docs, money
  README/manifest, test matrix and reproducible lexical inventory.

## Acceptance mapping

1. BILL_WRITE_WIRE_CONTRACTS inventories all three REST and MCP writes, envelopes,
   defaults, numeric/exact aliases, currencies, quantity/percent/date/UUID units,
   supported ranges, duplicate/state/approval policy and explicit error semantics.
   It records the reverse-charge repair, atomic audit policy, create-only duplicate
   matching, retained history and unqualified lifecycle/configuration races.
2. Real handler/SDK fixtures compare numeric, exact-major, exact-minor and dual
   clients through create and update, with delete operations on persisted drafts.
   USD 1250, above-int32, safe maximum, signed values and explicit KWD/default JPY
   retain units. Owner writes succeed, custom read-only roles and invalid keys
   reject, conflicting org headers cannot redirect scope, and foreign bills and
   every contact/account/tax/inventory/warehouse/project/receipt/PO input reject.
3. Invalid/conflicting values and unsupported money/products/taxes/sums reject
   without business mutations. Unsupported saved headers/lines, foreign saved
   references, payments, pending state, old/new locked dates and closed years
   reject. SQL-text bill/line/link/sequence snapshots plus audit/ledger/stock/
   allocation counts compare before/after failures. Injected line/link/audit/delete
   constraints prove whole-operation rollback. Concurrent first creates and
   supplied duplicates serialize; numbering collision/exhaustion are exercised.

## Verification

All commands ran at D:/Projects/dubbl using installed dependencies. Provisioned a
synthetic PostgreSQL 18.6 cluster at
`D:/Temp/dubbl-mon047-pg-3d8e0e43a3b04b5fb56321ae5c3cc716`, loopback port 55457,
synthetic dubbl_ci trust-auth role, hidden pg_ctl launch. Explicit TEST_DATABASE_URL
selects only that server; harness creates/migrates/drops random dubbl_ci_* fixture
databases, never the connection target or configured application DB. PG_BIN points
to local 18 client binaries. No .env credentials were read/printed/persisted and
worker Stripe keys were blanked; no live providers.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 104-task graph, MON-047 selected | Structure/state only |
| node --import tsx --test tests/bill-write-wire.test.ts | Exit 0, 3/3 | Pure contracts |
| TEST_DATABASE_URL=... node --import tsx --test tests/integration/bill-writes.test.ts tests/integration/bill-reads.test.ts tests/integration/invoice-writes.test.ts | Exit 0, all 3 workers pass | Actual handlers/SDK, synthetic PostgreSQL 18.6 |
| npm test | Exit 0, 145/145 | Unit suite, not full financial qualification |
| npx tsc --noEmit | Exit 0 | Existing installed dependencies/generated sources |
| npm run lint | Exit 0, 0 errors/159 existing warnings | Repository warnings remain |
| Affected-path npx eslint (two services, two routes, MCP and three tests) | Exit 0, clean | Changed TS source |
| money_inventory.py --write and verification; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, 410 columns/1400 paths/1157 consumers/22457 occurrences | Lexical/source/Drizzle coverage, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | No new deprecated money usage |
| pg_isready; fixture database count; pg_ctl fast/wait stop | Ready before integration; 0 fixture databases remain; stopped, exit 0 | Synthetic files retained outside repository |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows closure |
| git diff --check | Exit 0 | LF/CRLF notices only |

An initial integration attempt failed only when its fault-injection DDL used a
bound UUID parameter in ALTER TABLE, which PostgreSQL utility statements do not
accept. Replaced that test-only constraint with CHECK(false) NOT VALID. The prior
expected line-injection errors had correctly rolled back. Final integration passes.
An initial lint warning for a discarded costCenterId was removed with explicit
bill-line mapping. Self-review also corrected the inherited unitPrice description
to state zero default/no price lookup and added supplied-number collision coverage.
The inventory verifier initially ran without tsx and failed extensionless TypeScript
module resolution on Node 23; rerunning its documented tsx form passes. No failed
check is represented as success.

No full build/dev, Docker, schema modification/migration generation, configured
DB migration, deployment, provider/browser/session/OAuth or IRR enablement was
run. Existing migrations in fixture databases establish the test environment,
not production migration safety. The transitional safe numeric domain remains
intentional; exact aliases do not claim full-int64 workflow support.

## Review and handoff

See MON-047-review-1.md for honest implementing-assistant self-review. No slice
blocker; complete the controller check/submit/self-review/done cycle, validate,
commit and push as explicitly requested, then stop. Next task: MON-048 bill
lifecycle. MON-020 retains combined acceptance; MON-049..054 procurement and
MON-021/024 settlement/inventory remain pending. Full financial, security,
migration, release and native linguistic review gates remain separate.
