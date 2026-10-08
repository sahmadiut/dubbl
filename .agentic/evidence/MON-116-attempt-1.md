# MON-116 attempt 1 - exact cash forecast and unrealized FX reports

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry HEAD
8837c762d436bfef1d2cbf568f6b269e4c5d61b3 on master; clean working tree at entry.
Controller selected and started MON-116. Work is uncommitted while this evidence
is written. Honest technical self-review only; no independent financial, peer,
human, browser or deployment approval.

Read repository and nested instructions, controller/project/map/task/role,
MON-011 evidence and ADR-006, relevant money/test registries and actual source.
The cash forecast and unrealized FX routes used Number arithmetic; neither had
corresponding MCP operations. Historical quotes, recurring generators, current
document writers and existing report adapters/fixtures were inspected.

## Implementation and bounded scope

- Added forecast-fx shared report service and wire helpers. Actual REST handlers
  and new registered cash_flow_forecast/unrealized_gains_losses MCP tools share
  schemas, permissions, scoped read-only repeatable-read snapshots and exact math.
- Amounts use SQL text reads, bigint/rational products/sums and guarded numeric
  output plus canonical Minor strings. Rates expose numeric int32 millionths and
  exact strings; lossless direct/inverse compatibility is enforced. No bigint
  crashes, heuristic scaling, precision repair or full-int64 mode.
- Forecast has strict 1-52 week horizon/currency filters, scoped/deleted contact
  joins, live unpaid documents and active invoice/bill/expense recurring templates.
  Journals are excluded. End/max/generated limits and UTC generator advancement
  remain. All horizon occurrences are projected, replacing the ten-run truncation.
  A backlog over 10000 steps fails explicitly. Pretax/prediscount line subtotal
  estimation is retained and exposed by projectionBasis.
- Inclusive today through today + weeks*7 remains, with correct UTC Sunday buckets
  including both partial ends instead of lumping final dates into the previous
  bucket. Bucket sums and terminal cumulative equal root totals. Mixed contributing
  currencies require a filter; empty results retain selected/org currency.
- FX retains current amountDue and issue-date/today rate-table estimates, without
  claiming reconstruction of posted FX or historical settlements. Latest direct
  quotes have precedence over inverse; quarantined/missing metadata yields nullable
  results and a missingRateItems count. Exact quotes are not silently rounded to
  millionths. Invoice gains and inverted bill gains retain signed loss totals.
- Forecast currency selection, exact currency formatting and chart tooltips are
  added. Both consumers display errors; FX shows missing-rate exclusions and
  describes its estimate. Chart coordinates alone use approximate display numbers.
- FORECAST_FX_WIRE_CONTRACTS documents both complete inputs/outputs, units, aliases,
  ranges, calendar, estimate semantics, selection, failures and limitations. Money
  manifest/test matrix and generated money inventory are updated.

No schema, migration, posting, generation, rate provider, production feature flag
or application database change. MON-104/MON-029 retain integrated acceptance.

## Acceptance mapping

1. Contract registry maps both REST/MCP operations, every monetary/rate alias,
   safe source/exposed/result range, physical/count units, defaults, strict queries,
   supported rates/currencies, nullable values and forecast/FX estimate limitations.
2. Actual API-key REST handlers and registered MCP SDK clients on migrated
   disposable PostgreSQL agree. Real legacy/exact invoice and bill writer inputs
   feed the forecast; fixture documents and synthetic quotes feed the FX output.
   Cover denied keys/custom-role permissions, populated tenant isolation, foreign/
   deleted contact labels, status/deletion/date/currency selection, defaults, all
   frequencies, 52-week recurrence completeness, limits/backlog and synthetic direct/
   inverse/missing/quarantined quotes. No market quotes or provider calls.
3. Wire and actual operation fixtures reject malformed/unsupported parameters,
   mixed/unknown currencies, unsupported quotes/reciprocals, unsafe saved prices/
   amountDue, exact product/subtotal/root overflow and FX converted/summary overflow.
   Signed safe limits, .5/- .5 ties and large exact products preserve compatibility.
   Whole document/line/template/rate/GL/audit snapshots remain unchanged after
   successful report calls and expected compatibility failures; API-key lastUsedAt
   authentication bookkeeping is excluded.

## Verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55516 using a synthetic local role and UTC timezone. Explicit
TEST_DATABASE_URL targeted it; fixtures created/migrated/dropped random dubbl_ci_
databases. Application DATABASE_URL was not read or targeted. The cluster was
stopped successfully before controller completion and push; temporary cluster data
remains outside the repository.

| Actual command/check | Result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/forecast-fx-wire.test.ts tests/integration/forecast-fx.test.ts | Exit 0, 3/3, no skips | Focused corrected unit/actual REST/MCP fixture run |
| node --import tsx --test --test-concurrency=1 tests/integration/forecast-fx.test.ts tests/integration/document-analytics.test.ts tests/integration/kpi-analytics.test.ts | Exit 0, 3/3, no skips | Final expanded fixture and adjacent shared-helper regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 338/338, no skips | Complete unit suite |
| pnpm typecheck | Exit 0 | MDX and tsc, no build |
| pnpm exec eslint on changed TS/TSX files | Exit 0, clean | All routes, MCP, helpers, consumers and fixtures |
| pnpm lint | Exit 0, 0 errors, 117 existing warnings | Unrelated repository warning debt |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0, 415 columns, 1363 consumers | Inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports, hashes and occurrence/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard regression |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace |

Initial unit expectation for a large multiplication was incorrect; independently
recomputed the exact integer expectation. Initial rate seeding supplied mismatched
exact/legacy aliases and was correctly rejected by the migration trigger; fixed
valid fixture aliases. Deliberately quarantined/unrepresentable rate rows bypass
user synchronization triggers only in the disposable fixture, restoring the guards
before report reads. Runtime never bypasses the migration protections. Self-review
added exact reciprocal equality checking so 18-place rounding cannot silently become
a purported exact alias, along with extra recurring label/subtotal-overflow coverage.
Final tests/typecheck/lint/gates passed after corrections. No failure was waived.

No full build, Next dev server, Docker, schema generation, application migration,
provider/email request, deployment or IRR enablement ran. Browser/session/OAuth,
visual layout, large-volume performance, full-range clients, independent accounting/
historical-currency/localization and production qualification remain separate.

## Review and handoff

See MON-116-review-1.md for the actual self-review. No in-scope blocker remains.
Complete this child, commit task-owned files, push origin/master and verify remote
SHA/clean status. Stop after this task; controller selects the subsequent work.
