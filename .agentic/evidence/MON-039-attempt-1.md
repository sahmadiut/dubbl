# MON-039 attempt 1 — exact invoice CRUD write contracts

## Identity

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD
`d23996d5e3b500ce42afc174ab34065f10840e29`; clean working tree at entry.
All changes remain uncommitted. Self-review only; no independent accounting,
security, human or deployment approval. Controller selected/started MON-039;
95-task graph retained, no additional split or scope waiver.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task/dependency evidence, ADR-006, source money/API sections and
money manifest. Inspected actual invoice writes/reads/MCP, exact primitives/wire,
numbering/pricing/currency/tax/lock/approval/audit/plan helpers and actual schemas.

## Implementation

- `lib/api/invoice-write-wire.ts`: described shared schemas, canonical dates/
  dimensions, decimal-major `unitPriceExact`, integer-minor `unitPriceMinor`,
  major/minor alias agreement and bounded line/quantity/percent inputs. Integer
  ratios implement signed positive-infinity rounding; safe guards cover prices,
  gross products, individual taxes, subtotal/tax/header totals and due differences.
  No monetary binary float multiplication or Number sums.
- `lib/api/invoice-writes.ts`: shared direct-DB scoped CRUD. References share
  locked before writes; retained references allow inactive history but reject
  foreign ownership. Organization/invoice locks serialize service CRUD/first
  sequence creation. Number/header/lines/create approval request commit atomically.
  Existing line replacement and draft deletion cannot leave partial data on failure.
- Preserved REST price-first versus PATCH/MCP extended-major rounding, MCP USD/
  omitted-zero versus REST contact/org/item defaults, tax/discount/quantity rules,
  zero-terms 30-day fallback, explicit price override and price-list tiers/windows.
  Added opt-in MCP price-list lookup, credit policy and create approval parity.
  New unsupported pricing/credit currency combinations reject instead of assigning
  foreign amounts to local currency or silently choosing FX.
- Credits use SQL text/bigint and per-row/separate-total/projected guards; warning
  fields gain exact aliases. Hard enforcement precedes numbering. Create plan
  limits remain intact, including default unlimited self-hosted behavior.
- `app/api/v1/invoices/route.ts`, `[id]/route.ts`: POST/PATCH/DELETE delegate to
  services, preserving response/status envelopes and REST hard-credit payload.
  `lib/mcp/tools/invoices.ts`: adopts create; adds update/delete. Existing index
  registration covers the tools; every input field describes its units. No self-HTTP.
- Header responses gain subtotalMinor/taxTotalMinor/totalMinor/amountPaidMinor/
  amountDueMinor with existing numeric fields. Old/new locks, historical header/
  line/opaque snapshot serialization are preflighted. Successful audit uses
  awaited existing best-effort helper. No audit emitted after failed transaction.
- Added three pure contract groups and migrated PostgreSQL actual handler/SDK
  fixture worker/wrapper. Added invoice-write registry, public API/money docs,
  updated manifest/test matrix and reproducible source inventory. MON-019 retains
  remaining integration requirements; no lifecycle/quote/credit/receipt/recurring/
  bulk completion is claimed here.

## Acceptance mapping

1. [Invoice write contract inventory](../registries/INVOICE_WRITE_WIRE_CONTRACTS.md)
   covers three REST and three MCP operations, inputs/outputs, monetary versus
   physical units, alias agreement, ranges, rounding/default policies and errors.
   Public API and money README match implemented additive contracts.
2. `tests/integration/invoice-writes-worker.ts` invokes real authenticated REST
   POST/PATCH/DELETE and actual registered SDK MCP tools on committed migrations.
   Legacy/exact/dual prices, four scales, API-key/header/custom permission/two-org
   isolation, all foreign dimensions, tenant/deleted/state protections, old/new
   locks, pricing/terms/currency/omission defaults and plan limits are asserted.
3. Pure groups cover canonical/conflicting/malformed/unsafe values, signed ties,
   precision/rounding order and gross/tax/header sum guards. Actual operations
   cover int32-plus/safe-max, unsafe saved header/line/snapshot/due differences,
   credit currencies/unsafe rows and mutation snapshots. Forced line failures roll
   back header/sequence/create or replacement; forced header soft-delete failure
   restores deleted lines; forced approval-request failure rolls back entire create.
   Concurrent first/existing numbering yields distinct consecutive numbers.

## Verification

All commands ran in `D:/Projects/dubbl`. Synthetic PostgreSQL 18.6 cluster:
`D:/Temp/dubbl-mon039-pg-91d0f0136f604198b96ccfc6876682c5`, loopback port 55449,
password-free synthetic dubbl_ci role. Explicit TEST_DATABASE_URL points only
there; harness migrates/drops randomly named dubbl_ci_* databases. Configured app
DB and .env credentials were not read or changed. No external provider requests.
To exercise plan enforcement, worker temporarily enables only the local plan
evaluator with a synthetic Stripe test string, then restores unlimited mode.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 95 tasks, MON-039 selected | Workflow only |
| `node --import tsx --test tests/invoice-write-wire.test.ts` | Exit 0, 3/3 groups | Pure boundary arithmetic |
| Final `node --import tsx --test --test-concurrency=1 tests/integration/invoice-writes.test.ts` | Exit 0, 1/1 worker | Actual handler/auth/SDK + disposable migrated PostgreSQL |
| Invoice read worker in combined read/write run | Read worker passed 1/1 | Combined run failed later on write fixture's self-hosted limit assumption; separately repaired write worker passed |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0, 114/114 | Full unit suite |
| `npm run typecheck` | Exit 0, MDX generation and tsc | No build/dev, existing Next generated sources |
| Final `npx tsc --noEmit` after added fixture cases | Exit 0 | No build |
| `npm run lint` | Exit 0, 0 errors / 159 existing warnings | Full repository; no new warnings |
| Targeted eslint of adopted routes/services/tools/unit/integration files; final worker lint | Exit 0, clean | Changed-code checks |
| `python -m unittest discover -s .agentic/tests -v`, unique D: TEMP/TMP | Exit 0; 32 run, 31 pass / 1 Windows symlink privilege skip | Workflow only; Linux CI must run symlink case |
| Inventory --write, reproducibility, verify_money_inventory.mjs | Exit 0; 410 columns, 1353 scanned paths, 1123 consumer hashes, 21874 occurrences | Lexical/source/Drizzle verification |
| Fixture DB count and `pg_ctl -m fast -w stop` | Count 0; exit 0, server stopped | Only synthetic test cluster; data retained |
| `git diff --check` | Exit 0, line-ending notices only | Uncommitted changes |

Exploratory failures are disclosed, not counted as passing checks: initial fixture
used nonexistent business plan enum and wrong customerCredit property, corrected
to actual pro/sourceType/date schema; next worker tried JSON.parse on native MCP
schema-error text, corrected to support actual protocol shape. Expanded plan test
initially expected rejection in self-hosted unlimited mode; fixture now explicitly
enables local plan evaluation and passes. Early targeted lint found two imports
made unused by service adoption; removed. Initial tsc fixture schema errors were
corrected; final tsc/typecheck passed. Expected DB fault-injection errors are
asserted 500/MCP errors with unchanged snapshots, not failed fixtures. Hidden
pg_ctl startup waiter completed after shutdown and its trailing readiness probe
returned no-response/exit 1 as expected for a stopped server; independent readiness
probe had confirmed startup before tests.

## Review and handoff

Self-review recorded separately in MON-039-review-1.md. No schema changes, migration
generation, configured DB migration, full build/dev server, Docker, screenshot,
IRR flag, provider/configuration or deployment change. Safe numeric coexistence
remains mandatory; full int64 mode and monetary domain cutover require later tasks.
HTTP/session/OAuth/browser, concurrent external lifecycle/import/recurring writers,
lock/workflow/plan changes, complete posting/inventory/approval lifecycle and
accounting/production qualification remain separate gates. Audit remains the
existing best-effort policy. Repeated successful create calls still create new
invoices; no request-idempotency guarantee is added. Next: MON-040 lifecycle.
