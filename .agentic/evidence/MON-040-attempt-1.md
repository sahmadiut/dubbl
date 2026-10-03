# MON-040 attempt 1 - exact invoice lifecycle contracts

## Identity

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD `c40826c`, master,
clean working tree. At evidence capture the task diff is uncommitted; the owner
explicitly requested commit/push after completion. Self-review only; no independent
accounting/security/human/deployment approval. Controller selected/started MON-040;
95-task graph retained, no task split or scope waiver.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task/dependency evidence, ADR-006, money/API requirements and money
manifest. Inspected actual REST/MCP lifecycle, generic approvals, exact wire/
arithmetic, journal automation/FX triggers, historical rate resolution, stock/FIFO/
warehouse schemas/services, audit/locks, snapshots and optional email boundary.

## Implementation result

- Added shared `lib/api/invoice-lifecycle-wire.ts`, `invoice-lifecycle.ts` and
  `invoice-stock.ts`. Monetary inputs preserve numeric compatibility and exact
  aliases with documented major-interest versus minor-recovery units. Bigint
  ratios/sums implement simple/daily compound interest, explicit currency scales,
  residual-balanced conversion, exact stock costing and guarded final outputs.
- Eight invoice REST operations and nine new/adopted MCP tools share direct DB
  services. New tool file is registered in `lib/mcp/tools/index.ts`; duplicated
  invoice approval/void and sales-receipt bad-debt implementations were removed.
  Every tool input field describes its meaning/units; `wrapTool` consistently
  returns classified missing-FX 422 responses.
- Scoped organization/invoice locks coordinate with adopted CRUD, serialize
  numbering/duplicate send/void and protect atomic document/journal/stock/layer/
  warehouse/request/action/status writes. All reference ownership, safe persisted
  money/opaque snapshots, issue-date/current interest locks, state/account/FX
  requirements and output compatibility are checked before commit.
- Send requires complete active accounts and exact nonnegative header/line
  agreement. It freezes snapshots and persists new baseCurrencyCode. Posting saves
  exact transaction rates under the existing FX coexistence trigger policy.
  Void rejects settlements, mirrors original saved base legs/FX/dimensions,
  links reversal entries, cancels pending approvals and restores new stock at
  original issued values. FIFO consumptions reopen original layers; average-cost
  shortfalls receive exact return layers. New COGS mirrors original postings.
- Bad debt uses saved recognition FX when linked, retains direct/allowance and
  integer-minor recovery defaults, creates fallback accounts transactionally and
  rejects drafts/pending/rejected/paid/void write-offs. Captured base-currency
  changes and same-tenant journals belonging to another invoice fail safely.
- Interest creates invoice/line/journal/link/number atomically, requires available
  AR/interest accounts and handles 0/2/3 minor scales. Exact/simple/compound
  calculations and explicit overrides guard supported rates/grace/durations/output.
- Submission/step/rejection changes are atomic and enforce assigned scoped
  approvers. Generic approval-request REST/MCP actions for invoices use the same
  preflight; comments retain scoped member access. Audit calls are awaited with
  previous state/amount details under the existing best-effort policy.
- Optional REST email validates explicit email options before recognition, and
  external delivery follows committed accounting. PDF receives invoice currency.
  No email/provider traffic was exercised. Separate email/delivery retry and
  provider/PDF/payment-link qualification remain MON-016.
- Added pure and actual REST/SDK/PostgreSQL fixtures, detailed lifecycle registry,
  public API/money docs, manifest/test matrix updates and regenerated inventory.
  No schema/migration, application database, feature flag or deployment changes.

## Acceptance mapping

1. `../registries/INVOICE_LIFECYCLE_WIRE_CONTRACTS.md` inventories every adopted
   REST/MCP boundary, inputs/outputs/defaults, money versus physical/basis-point
   units, aliases/conflicts, currency-scale/rounding/range/error/state policies,
   saved FX and explicit legacy/provider/qualification limitations.
2. `tests/integration/invoice-lifecycle-worker.ts` invokes real authenticated
   REST handlers and registered MCP SDK tools on committed migrations. Main
   fixture uses full `registerAllTools` registration. Fixtures exercise numeric/
   exact/dual inputs, two tenants, hashed API-key/header precedence, custom
   read-only permissions, assigned multiple-step approvers and generic request
   parity. Unit aliases cover USD/JPY/KWD/IRR; actual operations cover USD/EUR,
   JPY base conversion and JPY/KWD interest. IRR activation is not claimed.
3. Pure groups cover malformed/conflicting/unsafe inputs, safe integer edges,
   rounding and distinct units, exact interest/range/duration and FX scale/
   residual/overflow. Actual operations snapshot invoices/lines/entries/legs/
   accounts/stock/movements/layers/consumptions/warehouses/numbers/requests/actions/
   audits around failures. Persisted unsafe money/opaque JSON, unavailable/foreign
   dimensions/accounts/journal links, locks, states and FX fail without committed
   mutations. Triggered header/line/ledger/stock/request/action failures roll back
   all effects; concurrent duplicate send/void yields one success and one rejection.
   Saved FX survives lookup change/deletion; stock/COGS and FIFO restoration use
   original values after cost change. No empty or unbalanced journal remains.

## Verification

All commands ran in `D:/Projects/dubbl`. Separate synthetic PostgreSQL 18.6
cluster `D:/Temp/dubbl-mon040-pg-63394f760e6843e79bbaa7d82e77a8e6`, loopback
port 55450 and synthetic dubbl_ci role. Explicit TEST_DATABASE_URL targeted only
this cluster; wrappers create/migrate/drop random `dubbl_ci_*` fixture databases.
Configured application DB and .env credentials were neither opened nor changed.
No external messages, live providers, dev server, build, Docker or deployment ran.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 95-task graph, MON-040 selected | Workflow only |
| `node --import tsx --test tests/invoice-lifecycle-wire.test.ts` | Exit 0, 3/3 groups | Exact pure boundary math |
| `node --import tsx --test --test-concurrency=1 tests/integration/invoice-reads.test.ts tests/integration/invoice-writes.test.ts tests/integration/invoice-lifecycle.test.ts` | Exit 0, 3/3 workers | Actual handler/auth/SDK, disposable migrated PostgreSQL |
| Final `node --import tsx --test --test-concurrency=1 tests/integration/invoice-lifecycle.test.ts` | Exit 0, 1/1, full MCP registration, expanded stock/FX/journal-link/approval/rollback fixtures | No HTTP/session/OAuth/provider/browser |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0, 117/117 | Full unit suite |
| Later `node --import tsx --test tests/invoice-lifecycle-wire.test.ts tests/money-wire.test.ts` | Exit 0, 16/16 | Final changed arithmetic/adapter regression |
| `npm run typecheck`; final `npx tsc --noEmit` after added fixtures/review fixes | Exit 0 | MDX + TypeScript; no Next build/dev |
| Final `npm run lint` | Exit 0, 0 errors / 159 existing warnings | Initial run's three fixture import/variable warnings were subsequently removed |
| Targeted eslint over every changed TS file; final service/worker lint | Exit 0, no warnings | After all functional review fixes |
| `python -m unittest discover -s .agentic/tests -v` with unique D: TEMP/TMP | Exit 0, 32 run, 31 pass / 1 Windows symlink privilege skip | Unchanged controller; Linux CI must execute symlink case |
| Inventory write/reproducibility and `verify_money_inventory.mjs` | Exit 0: 410 columns, 1360 scanned files, 1130 consumer hashes, 22044 occurrences | Source/lexical/Drizzle check, not full dataflow qualification |
| Fixture DB count; `pg_ctl -m fast -w stop` | Count 0; exit 0, synthetic server stopped | Test files retained; configured DB untouched |
| `git diff --check` | Exit 0, line-ending notices only | No whitespace errors |
| `git fetch origin`, HEAD...origin/master count | Exit 0, 0 ahead / 0 behind at precommit check | Remote freshness checked before commit |

Exploratory failures were repaired and are not counted as passes: first worker
used an unexported pool for shutdown and expected missing FX to be classified by
MCP, exposing its previous generic error handling. Worker now follows existing
fixture exit convention and wrapper classifies missing FX. Initial tsc caught
pool access and tuple-spread typing; fixed. A base-currency-change test exposed
that the FX trigger deliberately replaces supplied provenance, so new document
snapshots now capture baseCurrencyCode and trigger provenance is preserved.
Early lint found unused imports/variables; removed. Review also restored Unicode
comment encoding introduced by a default Windows file read, added original
FIFO shortfall restoration and same-tenant journal-source validation, then reran
affected integration/typecheck/lint/inventory checks. Forced DB failures are
expected negative tests, with 500/internal-error responses and unchanged snapshots.

## Review and handoff

Self-review is recorded separately in MON-040-review-1.md. No independent financial,
security, human or production approval is implied. MON-019 keeps combined
receivable integration acceptance; MON-021 keeps settlement qualification and
MON-016 keeps optional email/PDF/payment-link/provider boundaries. Legacy unlinked
stock retains current-average restoration; legacy unlinked/no-base-snapshot FX,
external writer/configuration races, repeated recovery/interest request semantics,
full-int64/reporting/domain conversion and accounting release qualification stay
explicit. Existing recovery-total default and absence of a recovery cap are
retained. Actual email delivery after recognition cannot roll back accounting;
retry email separately. IRR remains disabled. Next task: MON-041 quote contracts.
