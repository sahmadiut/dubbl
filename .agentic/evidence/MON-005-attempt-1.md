# MON-005 attempt 1: historical FX and provider validation

## Identity

2026-10-02, Asia/Tehran. Operator: Codex. Entry HEAD `88afc6c`, clean working
tree. This implementation and evidence are uncommitted. One task only,
self-reviewed; no peer/human/accounting or production approval.

## Implementation

- `rate-provider.ts` preserves numeric JSON lexemes as decimal strings, expands
  bounded exponent notation and validates positive 20/18 rates, ISO currency
  direction/base identity, Gregorian source dates and real UTC timestamps.
  Original JSON parsing checks syntax only; its numeric values are discarded.
  Missing stamps/bases, stale/future feeds and invalid supported quotes fail
  closed. Non-ISO targets are excluded. Fixed HTTPS URLs, no redirects/cache,
  ten-second deadlines and streamed 256,000-byte caps bound external responses.
  Failures/logs redact credential-bearing URLs and payloads. Unknown configured
  providers reject rather than silently choosing another source.
- `rate-policy.ts` and `triangulate.ts` use bigint rational division, explicit
  half-up 18-place cross/reciprocal rounding and separate direct rational 6-place
  compatibility rounding. No floating-point quote arithmetic. Legacy int32 bounds
  and one basis point approximation cap reject large/tiny unsafe quotes. Derived
  overflow/underflow is explicitly counted as compatibility rejection. The
  original/18-place quote is provenance; stored `rateExact` remains the actual
  six-place rate. Manual inputs continue to reject lossy numeric writes.
- `rate-sync.ts` writes only exchange quotes, compares each tenant/pair against
  its last effective quote with a 20% automatic movement ceiling and rejects
  quarantined baselines. Org/base transaction advisory locks serialize refreshes;
  the atomic upsert guard preserves concurrent manual overrides. Older source
  observations cannot replace newer same-day observations. Counts use actual
  returned writes, including skipped, incompatible, extreme and failed bases.
  Public feeds are shared only inside this invocation, never tenant overrides.
- `historical-rate.ts` captures one organization per request/batch, normalizes
  currencies, validates dates and keys request/effective caches by tenant,
  base/quote and date (plus resolved row/direction). Direct then inverse lookup
  excludes future rates and fails closed for missing/quarantined/unrepresentable
  legacy rates. Frozen snapshots are reused inside a batch; a new resolver sees
  changes. Converter/status paths now share this lookup; same-currency identity
  remains the only implicit 1:1.
- Generated `0007_steady_scarlet_witch` and its snapshot/journal add six nullable
  provider metadata fields to exchange_rate. Provider observation/import fields
  use timestamptz; existing values, schema objects and MON-004 guards remain.
  No provider or timestamp is invented for old/manual rows.
- REST/MCP manual writes share strict date/currency/identity validation and clear
  prior provider metadata. MCP override now uses the existing audit helper.
  Existing numeric contracts, manage:tax-config checks, organization scope and
  tool registration remain; get/list descriptions and additive lookup provenance
  are updated. No new end-user operation or provider HTTP self-call is added.
- Added unit and five PostgreSQL workflows, including the real invoice journal
  function and real direct-DB MCP override. Extended historical checksum tests to
  exclude only the six new nullable fields when comparing original rows. Updated
  ADR-005, FX/CI runbooks, test matrix, env comments and money registries.
  Inventory: 410 numeric/JSON columns, 1,089 consumer files, 1,304 scanned source
  files and 20,960 lexical occurrences. Six added text/timestamp columns do not
  change the numeric inventory total.

Source contracts checked, without live quote requests:
[ExchangeRate-API](https://www.exchangerate-api.com/docs/free),
[Frankfurter v1](https://frankfurter.dev/v1/),
[Open Exchange Rates](https://docs.openexchangerates.org/reference/latest-json).
Frankfurter's date-only observation is kept null; OXR keeps its USD feed and
local cross derivation. Retained v1 is documented as deprecated but continuing
to work. No CBI API, market quote correctness or Iranian service eligibility
claim is made. See ADR-005 for implemented policy and limits.

## Acceptance mapping

1. **History:** actual createInvoiceJournalEntry stores EUR-to-USD 1.25 and
   balanced 1250-minor-unit debit/credit totals. Refresh updates its source quote
   from 0.8 to 0.9; the complete original journal-line rows remain identical.
   A later invoice journal uses inverse 1111111 and totals 1111. A real MCP manual
   override to 0.5 clears provider metadata and is audited; refresh skips it and
   original rows still match. Sync never targets journal/document tables. This
   exercises the posting service, not an HTTP invoice UI workflow or full exact
   monetary consumer cutover.
2. **Negative behavior:** zero/negative/nonfinite/malicious types, huge exponents,
   excess precision, invalid identity/base/JSON/dates, missing stamps, stale/future
   sources, HTTP 429/503, network failure, deadline and response-size limits have
   tests. Exact cross ties/reciprocals/high/underflow cases are covered. Two tenants
   with different baselines accept/reject the same provider quote independently.
   Missing/poisoned feeds preserve every stored row, including a backfilled
   invalid-legacy zero rate that historical lookup refuses. Concurrency/public
   reuse/manual precedence and older observation rejection pass.
3. **Caching/isolation:** request and effective-date keys include tenant,
   base/quote/date; no global tenant cache exists. Two tenants, multiple pairs,
   effective/as-of dates, future exclusion, inverse direction, missing pairs,
   cached snapshot identity and fresh resolver after update are asserted against
   PostgreSQL. Public USD feed reuse for EUR-base organizations needs one fetch
   per invocation and never mixes same-day manual tenant overrides.

## Verification

All commands ran from `D:/Projects/dubbl`. No Next build/dev, Docker, deployment,
configured app-DB migration or live provider request was executed.

| Command/procedure | Result | Context/limit |
|---|---|---|
| Controller validate/status/context; start MON-005 | Exit 0 | Selected first ready task |
| `npx drizzle-kit generate` | Exit 0 | Generated 0007; repeat reports no schema changes |
| `npm test` | Exit 0, 70/70 | Full existing and new unit tests |
| `npm run test:integration` | Exit 0, 18/18 | Existing migration/backup/FX suites plus five new workflows |
| `npx tsc --noEmit` | Final exit 0 | All new tests and application types checked |
| `npm run lint` | Exit 0, 0 errors/167 existing warnings | No additional warnings |
| Final affected-file `npx eslint ...` | Exit 0, no output | All changed application/tests except schema (full lint covers it) |
| Final provider/triangulate unit command | Exit 0, 11/11 | After final derived overflow reporting edge |
| Final `node --import tsx --test tests/integration/fx-history.test.ts` | Exit 0, 5/5 | After the final arithmetic edge; original suites already passed |
| Snapshot JSON comparison 0006/0007 | Passed | Only six nullable columns; every original schema object preserved |
| `python .agentic/scripts/money_inventory.py --write`, then without | Exit 0 | Reproducible current source inventory |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | All exported numeric columns and consumer hashes/source lines match |
| `git diff --check` | Exit 0 | Line-ending notices only |
| Fixture cleanup count; `pg_ctl -m fast -w stop` | Zero fixture DBs; exit 0 | Dedicated server stopped |

Reused the stopped dedicated synthetic MON-004 PostgreSQL 18.6 cluster at
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon004-pg-89fe1b0e6cb2412a81591f2d274dc049`,
localhost:55440, synthetic dubbl_ci CREATEDB role. TEST_DATABASE_URL and matching
PG_BIN were explicit. Tests create/drop random dubbl_ci_* databases; no existing
target database is migrated/reset and no real data/credentials are retained.
PostgreSQL 16/hosted CI were not executed locally.

An initial server start omitted its custom port and failed binding the default
port; explicitly using loopback:55440 succeeded. Initial new-test typecheck found
an overly narrow inferred feed helper type; widened to Record<string,string>,
then final typechecks passed. Full integration passed on the first execution.
Self-review tightened timestamp validation, added concurrency/quarantine/source
ordering cases and explicit reporting of unrepresentable derived quotes. Final
affected tests pass after those changes. Original completed evidence is unchanged.

## Review and handoff

Self-review: MON-005-review-1.md, by the implementing Codex assistant. No unresolved
MON-005 blocker. Next: MON-006 API and serialization compatibility. Existing
legacy amount math, full-range posting, historical base-currency snapshots,
quarantined payroll remediation, financial qualification and production migration
rehearsal remain later tasks. IRR production stays disabled. No configured DB
migration, deployment, human financial approval or compatibility-window approval
is implied by this tracker completion.
