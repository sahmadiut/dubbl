# MON-038 attempt 1 - invoice read contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD
`42f256385df2c8797c27dddd5ff15c98ce52c3c8`; clean working tree before selection.
Work remains uncommitted. The user interrupted the initial implementation and then
requested continuation; the same in-progress task was resumed. Self-review only,
not independent human/peer/accounting/security/deployment approval.

Read root/nested instructions, START_HERE/controller/project/repository map,
MON-011 evidence/review, ADR-006, relevant money/source migration/API sections and
actual invoice/quote/credit/receipt/template/bulk/REST/MCP/schema code. Controller
selected MON-019. Source inspection verified independent invoice reads, writes,
lifecycle, quotes, credits, receipts, recurring generation and bulk writers.
Following controller splitting rules, retained the parent's complete scope and
unchecked acceptance, added MON-038 through MON-045 as dependencies and documented
the split. Exactly MON-038 is implemented here; other children are todo.

## Implementation

- `invoice-read-wire.ts` adds described common filters and explicit safe numeric
  plus string aliases for all identified header/line/contact money. Historical
  foreign-tenant contact/account/tax references reject the response before data
  disclosure; inactive/deleted organization-owned references remain readable.
  Quantities, discount/deposit basis points, dates and counts retain their units.
- `invoice-reads.ts` shares scoped direct-DB list/detail/summary between REST and
  MCP. GET list retains `{data,pagination}`; MCP list retains its original envelope.
  REST detail retains allocated payments and base display; MCP detail retains
  `{invoice}`, accurately described instead of claiming nonexistent payment history.
  Allocations add amountMinor and reject foreign payment parents/unsafe history.
- REST base display retains issue-date lookup, missing-rate nulls and freshness
  metadata. Declares rateExact for the six-place display rate, quote_per_base
  direction and historical_lookup_millionths basis. It does not claim persisted
  invoice posting FX. Matching scales and safe nonidentity amount*rate products
  are guarded; exact bigint ratio rounding preserves Math.round's signed tie
  toward positive infinity. Identity reads support the full safe-number range.
- Summary removes SQL int32 casts and Number sums. A repeatable-read/read-only
  transaction selects amounts as SQL text; bigint totals/aging then bridge only
  after safe-range checks. Mixed currencies, unsafe individuals, totals or aging
  buckets fail 422 instead of silently summing/rounding. Existing statuses,
  positive-aging policy and elapsed UTC due-date buckets remain. Adds currencyCode
  (null when empty), outstandingMinor/overdueMinor and aging amountMinor.
- `registerInvoiceTools` now uses shared list/get services and registers one
  `get_invoice_summary` operation through its existing tools/index registration.
  AuthContext org scope and wrapTool are retained; no HTTP self-call or new tool
  file requiring index registration is introduced. Read permissions remain the
  authenticated-member policy, including custom roles with no write permissions.
- Three GET handlers use guarded JSON output. POST/PATCH/DELETE, all lifecycle
  tools and write calculations are unchanged; they remain MON-039/040 and the
  other children. No public negotiation switch or legacy removal date is invented.
- Added four unit groups and actual migrated PostgreSQL/API-key/custom-role/MCP
  SDK read fixtures. Updated INVOICE_READ_WIRE_CONTRACTS, API docs, money README,
  test matrix, manifest, task index/source coverage and reproducible inventory.

## Acceptance mapping

1. INVOICE_READ_WIRE_CONTRACTS inventories all three REST and three MCP operations,
   filters/envelopes, signed stored minor units, additive header/line/contact/
   allocation/base/summary aliases, supported safe ranges, display lookup limits,
   errors and exclusions. USD/IRR/JPY/KWD 1250 stays 1250. No major/minor input
   conversion or invoice mutation is introduced by this read slice.
2. The invoice-reads integration worker invokes actual handlers and registered MCP
   SDK tools against a freshly migrated random PostgreSQL database. Numeric legacy
   and string-reading exact clients agree at 1250, above-int32 and safe-max values.
   Fixtures cover both tenants, conflicting org headers, invalid auth, custom
   read-only roles, deleted parents, foreign nested relations/payments, filters,
   pages, rate lookup dates/tenants and empty/mixed/large summaries.
3. SQL text snapshots compare invoice/line/payment/allocation/rate/journal/audit
   state before and after successful or rejected reads. Unsupported raw header/
   line/contact/allocation history, overflow, mixed currencies and FX products
   reject visibly with 422; malformed filters fail before reads. No precision
   loss, bigint JSON crash, mutation or rescaling is observed. Auth-key last-used
   metadata is deliberately outside these read-only business-state assertions.

## Verification

All commands ran in `D:/Projects/dubbl`. Created a synthetic PostgreSQL 18.6 cluster
at `D:/Temp/dubbl-mon038-pg-714453d162834076a961145ec6bdea44`, loopback port 55447,
password-free `dubbl_ci` role. Explicit TEST_DATABASE_URL points only there. The
integration harness migrates/drops random dubbl_ci_* databases, never the connection
target or configured app DB. No .env credentials were opened, printed or persisted.
Final remaining fixture DB count is zero; fast/wait cluster stop succeeded.
Temporary cluster data is retained. Its hidden Start-Process wait also completed
after the server stopped; no task-specific server/helper remains running.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/context/status/start/split/resume check | Exit 0; 95-task graph valid | Tracker structure only |
| `node --import tsx --test tests/invoice-read-wire.test.ts` | Exit 0; 4/4 | Pure contract groups |
| Final `node --import tsx --test --test-concurrency=1 tests/integration/invoice-reads.test.ts` | Exit 0; 1/1 worker | Actual REST/registered MCP SDK on migrated PostgreSQL, no HTTP/session/OAuth/browser |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0; 111/111 | Full unit suite, reduced process concurrency |
| Final `npm run typecheck` | Exit 0 | MDX generation plus tsc; existing generated Next files, no build |
| Final `npm run lint` | Exit 0; 0 errors/159 existing warnings | Full repository |
| Final targeted eslint on adopted routes/helpers/tools/unit/integration files | Exit 0; clean | After fixture type and readability corrections |
| `python -m unittest discover -s .agentic/tests -v`, unique D: TEMP/TMP | Exit 0; 32 run, 31 pass/1 Windows symlink privilege skip | Controller only; Linux CI must execute the symlink case |
| Inventory --write, reproducibility and verify_money_inventory.mjs | Exit 0; 410 columns, 1348 scanned paths, 1118 consumer hashes, 21797 occurrences | Conservative lexical/source/Drizzle checks |
| psql version / fixture count / pg_ctl fast-wait stop | 18.6 / 0 / exit 0 | Only synthetic fixture server |
| `git diff --check` | Exit 0; line-ending notice only | Uncommitted diff |

Initial interrupted typecheck result was unavailable after continuation; it was
rerun instead of counted as a pass. Review caught potential int64-overflow errors
in arbitrary-size FX products/summary intermediates; safe-range classification
now precedes the int64 bridge, with oversized products/SQL sums covered. A later
typecheck exposed a fixture's inferred any[] in a callback; an explicit inferred
row-array type fixes it. Final typecheck passes. The stopped previous fixture
cluster's pg_ctl status returned 1; that read-only probe is not a failed app test.
No failed exploratory command is represented as a passed verification.

No full build, Next dev server, Docker, schema generation, configured DB migration,
deployment, live provider or human review was run. No schema/migration/rollout flag
or posted history change. Full int64 consumers, cross-scale base conversion,
invoice writes/lifecycle and combined receivable/domain qualification remain the
assigned tasks. Detail/list multi-query concurrency is not snapshot-qualified;
only summary count/rows share repeatable-read. Opaque snapshots retain MON-034.

## Review and handoff

Actual self-review: MON-038-review-1.md. No remaining product blocker to this bounded
read slice. MON-019 retains combined acceptance. Next controller-selected child
after completion is MON-039 invoice writes. Changes remain uncommitted for review.
