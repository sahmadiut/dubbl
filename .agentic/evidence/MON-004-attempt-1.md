# MON-004 attempt 1 — exact FX storage expansion

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`66b990a1c070d587c57859a7f2cdf8fe0762675e`, clean working tree. Changes/evidence
remain uncommitted during verification. One task only; no peer, human accounting,
deployment or production approval.

## Implementation

- Expanded the four discovered FX tables (`exchange_rate`, `journal_line`,
  `consolidation_rate`, `payroll_item`) with numeric/string exact rates, format
  version, direction, provenance and status. Generated migration/snapshot/journal
  are `0006_new_susan_delgado`. Two unpublished generation passes were consolidated
  into this single expansion; no earlier committed migration was modified.
- `lib/currency/exact-rate.ts` selects a positive 20-whole/18-fractional policy,
  validates canonical decimal strings and bridges int32 millionths using bigint.
  `lib/db/fx-column.ts` uses unconstrained numeric and SQL CHECKs to reject excess
  precision rather than typmod rounding. ADR-004 records this technical choice.
- Exact SQL millionths division never uses JavaScript floats. Payroll backfill
  decodes persisted binary32 bits using integer/numeric arithmetic. In-policy
  stored values get exact provenance; other floats retain unchanged bits with
  explicit review status and a null exact field. Invalid legacy rates remain
  unchanged and quarantined. No guessed rate, scaling or 1:1 replacement.
- BEFORE triggers keep old/new representations consistent across REST, direct-DB
  MCP, jobs, ORM, raw SQL and upserts. The UPDATE OF guard also rejects an explicit
  stale exact value equal to its previous value. Metadata/provenance are derived;
  unsupported format/direction and unsafe exact pairs are rejected. Existing
  malformed rows can retain quarantine during unrelated updates.
- `backfill_exact_fx` validates table/batch arguments, processes only pending
  rows, locks/skips concurrently locked rows, and uses invoker privileges. Initial
  migration backfill is atomic. `scripts/backfill-fx.ts` enables separately
  committed resumable batches, counts-only output, explicit target configuration,
  bounded timeouts and incomplete-work exit status.
- REST input now rejects int32 overflow before storage. MCP manual input uses
  shared validation and exact bigint millionths conversion, replacing silent
  rounding. Tool descriptions explain numeric units/bounds and additive exact
  metadata. Original numeric contracts, role/org scope and manual precedence stay.
- Refreshed mutable inventory: 410 numeric/JSON columns, 1,084 consumers, 1,299
  scanned source files and 20,817 lexical occurrences. Scanner recognizes exact
  FX fields and metadata. MON-003's historical 402-column disposition/evidence
  remain unchanged. Its current checksum test excludes only newly added metadata
  when comparing original full rows; original default/nullability checks remain.
- Added four unit groups and five integration workflows; added FX runbook,
  ADR-004, inventory and CI/core documentation updates.

## Acceptance mapping

1. **Capacity:** all four numeric fields/string adapters support synthetic
   1500000, 0.000000666666666667, 10^-18 and the maximum 20/18 decimal. Zero,
   negatives, nonfinite, overflow and nonzero excess scale are rejected. Physical
   storage tests disable only fixture triggers to isolate the CHECKs; live legacy
   consumers remain guarded. These fixtures are not current market rates. No
   inverse rounding/accounting policy is silently selected.
2. **Exact/idempotent/resumable:** upgrade from actual committed 0005 and clean
   installs pass. Full original rows, dates/IDs/amounts/tenants and payroll binary
   bytes survive backfill. Two-tenant fixtures cover all four fields, invalid
   legacy rates and approximate floats. Tests cover zero work on rerun, committed
   two-row batches, a locked remaining row with exit 2, unlock/resume with exit 0,
   and unchanged originals. Initial transaction lock failure rolls back every new
   field and keeps six history entries; retry completes.
3. **Coexistence:** original column types/defaults/nullability and values remain
   unchanged. ORM/raw/update/upsert and explicit-conflict tests verify consistent
   exact rates/provenance and rejected unsafe pairs. REST/MCP validators reject
   unsafe ranges/precision; direct MCP handler tests verify validation and role
   denial before DB access. Updating the rate table never refreshes journal-line
   snapshots. Provider/business/wire cutover is deliberately later work.

## Verification

All commands ran from `D:/Projects/dubbl`. No build, Next dev server, Docker,
deployment, production or configured application-DB migration was executed.

| Command/procedure | Actual result | Fixture/limits |
|---|---|---|
| `python .agentic/agent.py validate/status/context`, start MON-004 | Exit 0 | Controller selection/structural validation |
| `npx drizzle-kit generate` | Exit 0; final repeat reports no schema changes | Generated published-to-working-tree schema artifacts; no Git commit |
| `npm test` | Exit 0; final 65/65 passed | Four FX unit groups, existing money/FX tests retained |
| `npm run test:integration` | Exit 0; final 13/13 passed | Explicit separate PostgreSQL 18.6 cluster and matching PG_BIN clients |
| `npx tsc --noEmit` | Exit 0 | No ignored-generated-file repair required |
| `npm run lint` | Exit 0; 0 errors, 167 existing warnings | No additional warning |
| `python .agentic/scripts/money_inventory.py --write`, then without --write | Exit 0 | 410 columns, source inventory reproducible |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | All exported columns, hashes and source lines matched |
| Snapshot JSON comparison (0005 vs 0006) | Passed | 20 added columns/four CHECKs; every original column and other schema object preserved |
| `git diff --check` | Exit 0 | Line-ending notices only |
| Configured local DB census in BEGIN READ ONLY | Exit 0 | Counts only, credentials/rows never printed, no data changed |
| Fixture DB cleanup query; `pg_ctl -m fast -w stop` | 0 fixture DBs remain; stop exit 0 | Dedicated cluster stopped |

Dedicated cluster: temporary directory
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon004-pg-89fe1b0e6cb2412a81591f2d274dc049`,
localhost:55440, synthetic `dubbl_ci` role, trust restricted to loopback.
Tests create/drop only random `dubbl_ci_*` databases. Temporary backup/restore
fixtures pass and remove their backup directories. No real data was restored.
PostgreSQL 16/hosted CI were not run locally.

An initial integration run failed all five new cases because the synthetic
journal-entry fixture omitted required `description`. Added that field and
reran successfully. Self-review then added the explicit unchanged-field conflict
guard, regression, binary32 zero/negative/normal/subnormal/max edge assertions,
role denial and maintenance timeouts. The final full suites pass after those
changes. A prior full run also passed; the final run is the completion evidence.

Read-only application-DB census: exchange_rate 6 rows, journal_line 58,
consolidation_rate 0, payroll_item 8. No null/nonpositive scaled values; payroll
has no null/nonpositive/nonfinite values and all eight are identity 1. This is a
local test cohort, not production cleanliness. It was never migrated.

## Review and handoff

Self-review: `MON-004-review-1.md`. No unresolved MON-004 blocker. Storage capacity
is expanded; live scaled consumers remain int32/six-decimal limited. Positive
out-of-policy payroll floats explicitly require original-input/approved
remediation before exact cutover. Provider arithmetic, historical currency
snapshots, full-range public contracts and all consumer/business migration remain
MON-005/006/007/008/010 and QA-005 work. IRR production gate stays disabled.
Deployment still requires representative lock/WAL/disk/backup rehearsal and
authorization. Next task: MON-005, historical FX and provider validation.
