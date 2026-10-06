# MON-085 attempt 1 - exact payroll output contracts

## Identity and scope

2026-10-06, Asia/Tehran; operator coding-assistant. Repository D:/Projects/dubbl,
master, entry HEAD 604916629075faf65542349d0ce110030fbec532, initially clean and
synchronized with origin/master. Owner requested "complete and push next task".
Controller validate/status/context selected and started MON-085. This evidence
records uncommitted implementation, not an invented commit or independent review.

Read root and nested instructions, START_HERE, controller/project/repository map,
backend role, MON-011 evidence, ADR-006, money manifest and source migration/API
compatibility sections. Verified actual payroll output routes, monolithic tools,
schema, DTOs/transaction primitives, dashboards and fixture infrastructure.
Existing detail routes lacked tenant checks, aggregates used Number coercion,
YTD included earlier years/deleted runs, generation duplicated snapshots and MCP
estimated W-2 withholding differently from REST. Tax-form PDF was already JSON.

## Implementation

- payroll-output-wire.ts supplies strict described date/year/pagination/self
  schemas and explicit safe cents/opaque deduction/tax payload DTOs. Canonical
  named Minor aliases agree; counts/flags/physical/FX units are not relabeled.
- payroll-outputs.ts supplies scoped direct-Drizzle services for all 16 paired
  operations. Bigint sums and rational rounded averages protect safe Number
  coexistence; reports use saved base/item currencies and reject unlike-unit
  single totals. Existing MON-082 header/item scope/FX guards are reused.
- Existing REST handlers use those services, preserving envelopes/statuses;
  new GET runs/:id/payslips supplies parity for existing list_payslips. Sixteen
  wrapTool tools register in payroll-outputs.ts/index; payroll.ts retains a
  compatibility export. Every SDK input property has a tested description.
- Payslips copy saved amounts, same-year live completed YTD and saved deductions.
  Existing snapshots stay unchanged; missing-item generation retries serialize
  and insert once. Detail ownership and preflight precede viewed status; status
  and audit commit together. Foreign member/item/run/employee references fail.
- W-2 uses saved employee withholding/jurisdiction and complete deduction rows,
  retaining existing box/wage-cap mapping without new statutory policy. Legacy
  withholding without breakdowns, incoherent deductions, non-USD and unsupported
  annual negatives fail before batches. NEC groups saved paid USD amounts, uses
  saved paymentDate with legacy UTC paidAt fallback, and applies the retained
  60000-cent threshold. JSON snapshots carry USD and exact aliases. 1099-MISC
  generation fails before writing a misleading empty successful batch.
- Self profiles/payslips resolve exactly one live owned employee for the caller's
  member. Email/bank-only patches validate before writes; DTO and awaited audit
  are atomic. Audit does not copy bank account data.
- CSV formats safe-max/signed cents exactly and safely quotes text/formula cells,
  retaining the first eight columns and adding Currency. Dashboards display
  exact saved-currency cents; totals/differences use bigint, errors are visible,
  authenticated downloads send organization headers, and run lists match the
  actual payroll item rather than fetching all employee history separately.
  The existing PDF compatibility route remains JSON with a truthful form-data
  download label; no real PDF generation or new statutory filing is claimed.
- PAYROLL_OUTPUT_WIRE_CONTRACTS records all operations/units/ranges, history,
  auth/error/currency/retry policies and limits. Manifest/test matrix/CI runbook,
  money README and generated source inventory are updated. No schema/migration,
  historical rescale, journal posting, production migration or IRR flag change.

## Acceptance mapping

1. PAYROLL_OUTPUT_WIRE_CONTRACTS maps all 16 REST/MCP pairs, signed/nullable safe
   cents aliases, saved/fallback currencies, dates/year/pagination, CSV/opaque
   payload shapes, unsupported history/type/currency and exact coexistence limits.
2. payroll-outputs.test.ts/worker invoke actual API-key REST handlers and in-memory
   MCP SDK transport on migrated disposable PostgreSQL. Full registration and all
   16 strict described tools are exercised; legacy numeric and exact alias outputs
   have expected amount assertions. Each operation has denied/expired/invalid
   REST credentials and denied MCP permissions. Foreign IDs and stored joins,
   self-only and ambiguous memberships cannot return another tenant's data.
3. Six pure groups and PostgreSQL snapshots cover malformed inputs/JSON, unknown
   aliases, dates/filters, unsupported types, mixed currencies, safe-max export,
   aggregate overflow, unsafe stored columns/JSONB and saved alias disagreement.
   Audit-trigger injection rolls back slips, viewed status, self patches and tax
   batches through both adapters. Cross-transport retries insert one snapshot.
   Expected YTD 1250/1279 excludes 2023 and deleted history; W-2 box1 1221,
   federal/SS/Medicare 100/15/10 and deduction boxes 29/17 come from saved detail.
   NEC 60029 includes a backdated saved paymentDate despite 2026 paidAt, excludes
   59999 and foreign payments. Current employee/base currency changes preserve
   saved USD output snapshots. No bigint serialization failure is hidden.

## Verification and corrections

Commands ran in the repository root. PostgreSQL18 was initialized in a unique
local temporary trust-auth cluster on loopback port 55485 with timezone UTC.
Explicit TEST_DATABASE_URL drives random disposable fixture databases; matching
PG_BIN clients were configured. No .env credentials were printed and no existing
application database was migrated or reset.

| Actual command | Result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-085 | Exit 0; valid 135-task graph | Tracking only |
| node --import tsx --test tests/payroll-output-wire.test.ts tests/integration/payroll-outputs.test.ts (final focused source) | Exit 0; 7/7 | Six pure groups and one substantial actual transport/PostgreSQL case |
| pnpm typecheck | Exit 0 | MDX/tsc only; no full build |
| npx tsc --noEmit after final source/UI edits | Exit 0 | No browser/server qualification |
| pnpm lint (final) | Exit 0; 0 errors, 129 existing warnings | Baseline 134; removed old route warnings and obsolete suppression |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts tests/integration/*.test.ts | Exit 0; 341/341 pass, no skips | 264 pure and 77 PostgreSQL cases, including real dump/restore; elapsed 362937 ms |
| Changed service/tool/client/fixture eslint | Exit 0, no warnings | Current changed implementation |
| python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1647 scanned files, 1263 consumers, 25449 occurrences | Lexical inventory/source hashes, not full dataflow |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import guard regression |
| git diff --check | Exit 0 | Checkout LF/CRLF notices only |

The initial typecheck caught nullable deduction columns; explicit unsupported
history validation fixes that without treating null as zero. Two initial fixture
expectations were corrected: a safe-max row must share a month to overflow a
monthly YoY total, and randomly ordered deduction UUIDs require a category lookup
rather than assuming the first row. Focused fixtures subsequently passed. Diff
review caught a Windows default-encoding artifact in edited dashboards; original
Unicode was restored and subsequent edits explicitly use UTF-8. Self-review also
added current membership preflight before creating a new payslip, with negative
fixture coverage. An obsolete lint suppression was removed after the new async
error path made it unnecessary.

## Review, qualification limits and handoff

See MON-085-review-1.md for the implementing assistant's actual self-review.
Numeric-safe business consumers do not imply full-int64 support. Legacy null run
base uses the existing current-base bridge, historical form JSON retains its USD
contract, and legacy missing FX/withholding/detail may require explicit remediation.
Payroll retains its existing two-decimal cents presentation; general ISO/locale/
regime/PDF cutover, large-history performance, browser/session/OAuth/network and
independent financial/security qualification remain with MON-034/025 and the
release tasks. No full build, dev server, Docker, provider, deployment, production
migration or IRR rollout occurred. Parent acceptance is not silently completed.

Bounded implementation and all three criteria have passing evidence. Close the
controller, commit/push to origin/master under owner authorization, verify remote
SHA and clean synchronized tree, then stop. Next ready task is MON-026.
