# MON-046 attempt 1 - exact bill read contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`ca6f88d23c84fa322fe8a85a79f1e42f21d6d517`, clean master working tree. This evidence
records verified working changes before the user-authorized commit/push. Self
review only; no independent peer/human/accounting/security/deployment approval.

Read root/nested instructions, START_HERE/controller/project/repository map,
MON-020, MON-011 attempt/review, ADR-006, source money/migration/API requirements,
money manifest and actual bill/procurement/REST/MCP/schema/test source. Controller
validate/status/context/next selected MON-020. Verified independent bill list/detail/
counts, CRUD, lifecycle/stock/approvals, purchase orders, requisitions, debit notes,
goods receipts, bulk and settings. Applied documented split rules: started/blocked
MON-020, added MON-046..054 with inherited prerequisites, retained every original
parent acceptance criterion and added children to parent dependencies. Task index
and source coverage reflect the split. Exactly MON-046 is implemented; remaining
children and combined MON-020 acceptance stay pending.

## Implementation

- `bill-read-wire.ts` describes status/pagination fields and adds exact aliases to
  identified bill header/line/contact money. Safe numeric envelopes remain; signed
  historical money and stored currency units do not rescale. Hundredths quantity,
  basis-point discount/tax, IDs and dates retain their units.
- `bill-reads.ts` shares scoped direct-DB list/detail/status-count services between
  actual REST handlers and MCP. Parent organization/deletion scope is enforced.
  Nested foreign contacts/accounts/taxes reject before disclosure. Same-tenant
  inactive/deleted historical references stay readable. List rows/count share a
  repeatable-read/read-only transaction and stable createdAt/id descending ordering.
- Three GET handlers use guarded jsonResponse. Numeric legacy DTO fields and
  envelopes remain compatible; exact clients can read every additive *Minor alias.
  Malformed statuses/IDs/bounded pages now fail validation instead of invalid SQL.
  Existing REST parseInt/clamp pagination remains deliberately documented.
- Status counts select sum/min/max(amountDue) as SQL text. Bigint parsing preserves
  digits above int32; safe-number guards reject individual extremes, cancelling
  int64 history and unsafe sums. Each status requires one currency and adds its
  currencyCode; no cross-status money sum is invented. Existing status membership,
  omitted empty buckets, signed amounts and total document count are retained.
- Extracted the already-adopted invoice base-display policy into
  `document-base-wire.ts`; invoiceBaseDto remains an exported alias. Bill detail
  gains exact amount/rate/direction/basis fields while retaining issue-date lookup,
  freshness, missing-rate nulls and organization base selection. Matching-scale/
  legacy product guards apply before response, with bigint signed tie rounding.
  Generic error text now says Document. No saved posting-FX claim is made.
- Existing `registerBillTools` in tools/index registers list_bills, new get_bill
  and new get_bill_counts. One tool per operation, described Zod inputs, wrapTool
  and server-created AuthContext are used. No self-HTTP calls or new registration
  file. Authenticated-member reads (including custom roles without write access)
  remain accessible; all writer bodies are unchanged.
- Added four pure contract groups and actual PostgreSQL REST/API-key/custom-role/
  SDK fixtures. Updated BILL_READ_WIRE_CONTRACTS, API docs, money README, manifest,
  test matrix and reproducible lexical source inventory.

## Acceptance mapping

1. BILL_READ_WIRE_CONTRACTS inventories all three REST and all three MCP reads,
   filters, envelopes, units, exact aliases, ranges, errors, access, display lookup
   and read consistency limits. Registry and public API docs distinguish read
   minor-unit unitPrice from the pending write decimal-major unitPrice contract.
2. The migrated disposable bill-reads integration worker invokes actual handlers
   and registered tools. Numeric legacy and exact-alias clients agree at 1250,
   above-int32, safe-max and negative values. Both tenants, conflicting org headers,
   invalid API keys, custom read-only roles, deleted parents/references, foreign
   nested contact/account/tax objects, filters/pages and status counts are exercised.
3. Pure and actual fixtures guard unsafe header/line/contact/product/FX history,
   unsafe SQL sums, mixed currencies per status and cancelling unsupported int64
   individuals. Exact SQL-text snapshots compare bill/line/contact/rate state and
   ledger/audit/stock/allocation counts before/after successful and rejected reads.
   No business writes, precision/unit loss or bigint serialization failures occur.
   API-key last-used authentication metadata is outside business snapshots.

## Verification

All commands ran at `D:/Projects/dubbl`. Created synthetic PostgreSQL 18.6 cluster
`D:/Temp/dubbl-mon046-pg-47b4048482bd4b16a3541800bf248085`, loopback port 55456,
synthetic dubbl_ci trust-auth role. Hidden pg_ctl launch; explicit TEST_DATABASE_URL
selected only that server. The harness creates/migrates/drops random dubbl_ci_*
fixture databases and never changes the connection target or configured app DB.
No .env credentials were read/printed/persisted. PG_BIN pointed to the local 18
client binaries. Worker provider keys were blanked; no live provider requests.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/next/start/block/split/start | Exit 0; valid 104-task graph | State/structure, not product proof |
| `node --import tsx --test tests/bill-read-wire.test.ts tests/invoice-read-wire.test.ts` | Exit 0; 8/8 | Pure contracts; DB fixtures follow |
| `TEST_DATABASE_URL=... node --import tsx --test tests/integration/bill-reads.test.ts tests/integration/invoice-reads.test.ts` | Exit 0; both actual workers pass | Synthetic PostgreSQL 18.6, not production/PG16/browser/provider |
| `npm test` | Exit 0; 142/142 | Pure unit suite; no full financial qualification |
| Final `npx tsc --noEmit` | Exit 0 | Existing installed dependencies/generated sources |
| `npm run lint` | Exit 0; 0 errors, 159 existing warnings | Repository warnings remain |
| Affected-path `npx eslint` (three routes, four API files, MCP and three tests) | Exit 0; no output | Changed TS source only |
| Inventory `--write`, reproducibility, Drizzle/hash source verifier | Exit 0; 410 columns, 1395 paths, 1152 consumers, 22435 occurrences | Lexical coverage, not dataflow proof |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; 9 regression checks | No new deprecated money usage |
| PostgreSQL readiness/query/fast wait stop | Accepting connections; 0 fixture databases remain; stop exit 0 | Synthetic files retained outside repo |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit | User-authorized commit/push follows task closure |
| `git diff --check` | Exit 0 | LF/CRLF conversion notices only |

An intermediate typecheck caught a test helper passing null to classifyRate;
fixed by declaring the missing-rate fixture explicitly while keeping the real
classifier's numeric input. Final typecheck/fixtures pass. Diff review also found
PowerShell/Python default-decoding changes to old Unicode comments; restored
their original UTF-8 text before final checks. No runtime failure was hidden.
The hidden launch's Start-Process wait remained open until cluster shutdown;
its trailing pg_isready then reported no response (exit 1), as expected after stop.
An independent readiness check had succeeded before the integration run. All
task-specific helper/server processes finished; no local fixture server remains.

No build/dev, Docker, schema/migration generation, configured database migration,
deployment, provider/browser/session/OAuth or IRR enablement was run. Synthetic
migrations qualify the read fixture environment, not production migration safety.

## Review and handoff

See MON-046-review-1.md for honest self-review. No slice blocker. MON-047 is the
next controller task; complete bill CRUD write adoption next. MON-020 retains
all combined payable/procurement acceptance, with MON-048..054 and MON-021/024
coordination still pending. Functional IRR, full-int64, accounting, security,
migration, release and native linguistic gates remain mandatory. The user
explicitly authorized commit and push after this task is fully verified/closed.
