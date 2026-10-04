# MON-072 attempt 1 - exact tax period contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator coding-assistant (Codex), D:/Projects/dubbl,
master, entry HEAD 16d2c08, clean tree. User authorized next task and commit/push
when complete. Controller validate/status/context selected MON-072, claimed with
start --owner coding-assistant. Read root/nested instructions, START_HERE,
controller/project/map/backend role, task/parent, MON-011 dependency review,
ADR-006, money manifest, migration/API source sections and actual source.
Exactly one task; no delegation, schema edit or production migration.

## Implementation and findings

- tax-period-wire.ts defines strict described schemas, Gregorian merged-range
  validation, canonical settlement aliases, saved header/line DTO guards and
  classified safe bigint aggregate boundaries. Money remains base minor units,
  with additive amountMinor/netMinor/outputVatMinor/inputVatMinor; no rescaling.
  Percentages remain numeric int32 basis points and do not gain money aliases.
- tax-period-calculation.ts adopts filing SQL aggregates as text to bigint,
  guards debit/credit legs, individual EC subtotals and sums (including >int64).
  Existing accrual/cash selection and VAT-registered cross-border heuristics
  remain. Foreign EC subtotals reject instead of summing unlike units; foreign
  qualifying contacts reject. Broader report paths remain MON-029.
- tax-periods.ts shares scoped direct-DB list/get/CRUD/file/settle services.
  Organization/period locks serialize adopted writers; invalid stored history
  fails before writes. Figures, signed clearing/payment/refund legs, identity
  FX history, sourceId links, numbering, frozen lines, status/actor/reference
  and required audits commit atomically. Audit includes currency/basis/boxes and
  flat-rate choice. Filing losers throw before posting; no extra committed journal.
- Found a preexisting race: filing posted before checking whether the conditional
  status update succeeded, returning null updated while committing the journal.
  Shared locked state validation fixes REST and both existing MCP filing names.
  Filed/amended metadata is immutable; linked open settlements reject. Existing
  control accounts and settlement banks must be live, active, correctly typed
  and base-denominated; arbitrary GL/foreign-currency banks cannot receive tax
  cash postings. Existing period/advisor/fiscal checks guard posting dates.
- Three REST route files are thin adapters with safe JSON responses and malformed
  JSON rejection. Valid {} still files by default. Both filing tool names and
  legacy standalone settlement remain; optional taxPeriodId adds linked MCP
  settlement. update_tax_period/delete_tax_period close existing operation parity.
  All eight tools use AuthContext, strict described schemas and wrapTool.
  Existing tool registration already covers both files, so index.ts is unchanged.
- Registry TAX_PERIOD_WIRE_CONTRACTS.md documents every envelope/input/unit/range,
  compatibility corrections, state/scope/lock/transaction/retry behavior and
  remaining qualifications. Updated MONEY_MANIFEST, money README, TEST_MATRIX
  and lexical MONEY_BOUNDARIES inventory. No schema changes require migrations.

## Acceptance mapping

1. Registry operation table/range sections cover list/get/create/PUT/delete,
   file_tax_period/file_vat_return and REST/MCP linked/standalone settlement.
   Numeric minor units coexist with canonical Minor strings within safe range.
   Dates, timestamps, identifiers, basis points and counts retain their units.
2. tests/integration/tax-period-contracts-worker.ts invokes actual REST handlers
   with API keys/custom roles and actual registered MCP SDK clients over linked
   InMemoryTransport. Two tenants, spoofed org header, viewer/manager/owner,
   expired/invalid auth, scoped references and denied writes use full SQL
   snapshots. Every REST operation and all eight tools have real fixture calls.
   Numeric and exact clients cover filing reads/totals and settlement inputs.
3. Pure/actual DB fixtures verify >int32 values, max-safe settlements, malformed,
   missing/conflicting aliases, fractional/unsafe values, unsupported saved
   frozen/EC money, over-safe/over-int64 SQL aggregates, unlike currency and
   foreign/inactive/deleted/non-bank GL references. Frozen lines survive later
   source edits. REST and both-tool concurrent races commit exactly one journal
   and seven lines. Audit and journal-line triggers prove complete rollback.
   Cash, flat-rate zero, payable/refund, amended immutability, period/fiscal locks,
   cascade deletion, KWD minor units and IRR-disabled posting are exercised.

## Verification

Commands run from repository root with installed dependencies and existing
ignored generated MDX/Next sources. PostgreSQL18 initdb/pg_ctl created a unique
synthetic trust-auth cluster in the temp directory on 127.0.0.1:55472. Explicit
synthetic TEST_DATABASE_URL supplies fixture identity; withDatabase creates/drops
random dubbl_ci_* databases and applyCurrent runs committed migrations there.
No configured .env target was migrated/reset, and no secrets printed/persisted.

| Command/check | Actual result | Limitation |
|---|---|---|
| Controller validate/status/context/start | Valid 123-task graph, MON-072 selected/claimed | Structure only |
| npm test | 212/212 passed, exit 0 | Pure suite; final changed groups also rerun in targeted checks |
| node --import tsx --test tests/tax-period-wire.test.ts tests/integration/tax-period-contracts.test.ts | Final 3/3 passed | Actual handler/SDK DB plus two pure groups, no genuine network server |
| Same plus tax-rate-contracts.test.ts and organization-settings.test.ts | Final 5/5 passed | Three migrated PostgreSQL suites, two pure groups; organization suite uses existing synthetic session/email seam |
| npx tsc --noEmit | Final exit 0 | No full build; installed/generated sources |
| npm run lint | Final exit 0, 145 warnings, zero errors | Baseline warnings outside adopted source retained |
| npx eslint on changed/new TS paths | Final exit 0, no warnings/errors | Adopted source/fixtures only |
| money_inventory.py --write then without --write | Exit 0, 410 columns/1552 paths/1255 consumers/24386 occurrences | Lexical queue, not dataflow proof |
| verify_money_inventory.mjs | Exit 0, all columns/source hashes/occurrence lines verified | Source metadata only |
| verify_legacy_money.mjs | Exit 0, nine regression checks | Legacy import gate only |
| git diff --check | Exit 0 | Git CRLF checkout notices only |
| Disposable database count / pg_ctl stop | Zero dubbl_ci_* databases, server stopped | Synthetic temp cluster files retained outside repo |

Exploratory failures were fixed: first typecheck exposed an incorrect jsonResponse
import; corrected to its defining module. First fixture exposed discriminated
union mode defaults requiring explicit normalization of valid objects; fixed
while retaining primitive/malformed rejection and permission precedence. The
>int64 aggregate fixture exposed a generic RangeError from checkedMinor; a
pre-bridge safe bound now produces classified 422 without writes. Initial lint
found an unused test import; amended-state fixtures now exercise that table.

No full build, dev server, Docker, production DB/provider/authority/session UI,
deployment, screenshot, statutory-rate refresh or IRR flag action occurred.
Zero-net filing retains an empty clearing header, cash and EC retain documented
heuristics, and flat-rate turnover remains uncomputed. Repeated positive
settlements intentionally create new journals; no generic request idempotency,
outstanding cap, bank movement or payment/reversal workflow is introduced.
Foreign EC/settlement FX, full-int64, historical remediation, PostgreSQL16,
global unadopted fiscal/lock/chart concurrency, broader report and independent
accounting/security/migration/IRR qualification remain at separate gates.

## Review and handoff

Implementing-assistant self-review in MON-072-review-1.md; no invented peer or
human approval. No unresolved bounded-slice blocker. Check three criteria,
submit/self-review/done and validate/status, then user-authorized commit/push
and clean synchronized branch verification. Stop after this task. Next MON-073;
MON-022 combined integration acceptance remains unchanged.
