# MON-076 attempt 1 - inventory movements and warehouses

## Identity and environment

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD
68f849a1a1d355c572e9a30cf0a96a9d63571182, master, clean working tree.
User requested the next task, followed by commit/push after full completion.
Controller selected/started MON-076. This evidence describes uncommitted work
at writing; no independent human accounting/security approval is claimed.

Read root and nested instructions, START_HERE, controller/project/repository
map/backend role, task and MON-075 handoff/evidence, MON-011 foundation evidence,
ADR-006, money/catalog/master registries and source migration/API sections.
Inspected actual schema, all seventeen route files, old inventory/warehouse MCP
tools, valuation/journal/master/bill-stock/goods-receipt helpers and affected UI.
No build, dev server, Docker, browser, schema edit or deployment.

PostgreSQL18 initdb created an isolated synthetic trust-auth cluster at
D:/Temp/dubbl-mon076-pg-2d293a4623314182a0fc26cafd58a307/data,
127.0.0.1:55476, role dubbl_ci. Hidden pg_ctl startup redirected logs;
pg_isready confirmed ready. Explicit synthetic TEST_DATABASE_URL selected it.
Harness cases created/migrated/dropped random fixture databases; configured .env
target was not migrated/reset and no credentials/customer data were printed.
Final psql count found zero fixture databases; verified absolute task path,
pg_ctl fast/wait shutdown exited 0. No directory deletion.
Windows startup wrapper remained waiting on inherited redirected process handles
until shutdown; its final pg_isready then reported no response (wrapper exit 1).
Separate readiness calls returned accepting connections while fixtures ran.
Init/start logs reported success; the late no-response is the stopped server,
not a failed fixture or an unresolved running-cluster check.

## Implemented behavior

- inventory-movement-wire.ts defines strict described input schemas, agreeing
  canonical cents aliases, bounded whole quantities, real Gregorian dates,
  movement and stock-line DTOs, pagination/chart/allocation contracts. Exact money
  remains safe Number coexistence; no full-int64 promise or currency rescaling.
- inventory-movements.ts provides direct scoped DB services shared by seventeen
  REST files and twenty-two movement tools plus six warehouse tools. Kept existing
  names/envelopes and separate REST absolute target/5020 versus MCP signed delta/
  surplus-or-impairment revaluation behavior. New matching tools cover previous
  REST-only count/transfer/chart/serial/lot operations. Full registration is unique.
- All adopted writes require manage:inventory and atomic audits. Owned active
  locations/live items, account type/currency, period locks, strict batches,
  quantity/money/product ranges and saved DTO preflight protect transactions.
  Default warehouse flag clears other defaults; deletion refuses stock/open work.
  History retains scoped deleted locations without exposing foreign references.
- Quantity adjustments share FIFO/average preflight, valuation and matching GL;
  free stock has no journal. Value-only adjustment uses exact division, retains
  quantity and rejects FIFO/standard pending separate layer qualification. Invalid
  negative/stranded saved stock and standard adjustments fail explicitly.
- Stock take apply checks every counted line, including saved zero discrepancies,
  against LIVE global or warehouse units. A location count 6->5 changes global
  10->9. Movements/line signed values, journal IDs, counts/completion/audit commit
  together. Direct completed status and terminal reopen are prohibited.
- Transfers validate every line before mutation, sufficient source and safe
  destination units. Creation and completion are atomic, two movements retain
  zero value/global quantity with no GL, terminal completion cannot repeat.
- Serial/lot endpoints preserve allocation metadata semantics without stock or
  GL receipt. Batch serial uniqueness includes deleted org/item history; dates,
  whole units and location ownership are validated. No new movement-assignment
  selection/consumption feature is fabricated from schema-only assignment tables.
- Org no-key-update and ordered item locks coordinate adopted writers and MON-052
  receipt locks. Cost-flow engine rejects stale pre-read values rather than
  overwrite concurrent stock. Products and FIFO sums use bigint; receipt unit
  average derives from authoritative carrying value. Average full exhaustion
  issues exact remaining value, including safe-max when rounded cost*quantity
  would be unsafe, preventing over-credit from unit rounding.
- Chart uses safe SQL bigint casts/text sums, supports over-int32 physical sums
  and safely negates int32 minimum. Money DTOs add known Minor strings, nulls stay
  null. Revaluation editor parses exact two-decimal legacy major text; count
  editor rejects overprecision/partial text instead of parseInt truncation.
- Contract registry inventories all fields/operations/units/ranges/offsets/errors.
  Money README/manifest/test matrix/source inventory and MON-077 pending handoff
  updated. No MON-077/078/024 acceptance is claimed.

## Acceptance mapping

1. INVENTORY_MOVEMENT_WIRE_CONTRACTS.md records seventeen REST files/twenty-seven
   handlers, twenty-eight described strict tools, all input/output units/aliases,
   safe ranges, pagination, null/history and distinct revaluation semantics,
   supported cost methods, lifecycle/metadata-only behavior and remaining gates.
2. Three pure groups plus actual migrated PostgreSQL REST API-key/custom-role and
   SDK tests cover numeric/exact/dual money, two tenants, spoofed org header,
   invalid/expired keys, viewer denied writes, custom manager allowed writes,
   every adopted operation, full unique tool registry and KWD base ledger with
   unchanged integer cents. Foreign/corrupt saved joins fail without metadata leak.
3. Text SQL snapshots prove invalid/range/reference/permission/lock/saved bigint
   failures leave stock/GL/audit/state unchanged. Actual FIFO and rounding residual
   issues, warehouse/global/zero-discrepancy recount, transfer retry/concurrency,
   standalone/master bulk and direct receipt races, stale engine rejection and
   sixteen audit-trigger rollback families verify atomic adopted writes. Linked
   money movement asset GL nets match signed values; every journal balances in KWD.

## Actual verification

All commands ran in D:/Projects/dubbl. Installed dependencies/generated sources
used; no full build or dev server was run.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-076 | Exit 0, valid 128-task graph | Structural orchestration only |
| Initial new pure/PostgreSQL run | 3/4; chart grouping failed | Fixed repeated bind parameter grouping with enum-selected SQL literal |
| First combined regression run | 5/6; FIFO fixture order nondeterministic | Same-timestamp layers ordered by random UUID; fixture now pins chronology |
| New pure/PostgreSQL rerun | Exit 0, 4/4 | After fixes, before strengthened negatives |
| Strengthened combined run | Exit 0, 7/7 | Corrupt references, all REST write permissions, physical chart limits/GL assertions |
| Final node --import tsx --test tests/inventory-movement-wire.test.ts tests/integration/inventory-movements.test.ts tests/integration/inventory-master.test.ts tests/integration/inventory-catalog.test.ts tests/integration/goods-receipts.test.ts | Exit 0, 7/7 | Final runtime with safe-max average exhaustion and year-zero rejection |
| npm test | Exit 0, 224/224 | Full pure suite; final new pure groups rerun above after date guard |
| npm run lint | Exit 0, 0 errors/143 existing warnings | Same warning count as MON-075; no new warning |
| Final changed-file eslint | Exit 0, clean all changed TypeScript/TSX | API/MCP/service/UI and fixtures |
| npx tsc --noEmit (final) | Exit 0 | Existing generated Next/MDX sources, no build |
| money_inventory.py --write and verification; node --import tsx verify_money_inventory.mjs | Exit 0, 410 columns/1257 consumer hashes verified | Conservative source inventory |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | No introduced legacy money helpers |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Push occurs after controller closure |
| psql fixture count; verified pg_ctl stop | Zero fixture databases; exit 0 shutdown | Isolated synthetic cluster only |
| git diff --check; controller validate | Exit 0, valid 128 tasks | LF/CRLF notices only |

Initial typechecks caught the missing assembly-only notDeleted import after
removing moved tools, and the existing whole-input helper's optional return in
the count editor. Both repaired; subsequent checks passed. Self-review removed
unused imports, kept legacy MCP movement `total`, retained scoped historical
locations, guarded warehouse deletion with open work and documented unsupported
FIFO value-only behavior rather than writing inconsistent layers. No unresolved
check failure. Separate review evidence records the honest self-review.

## Limits and handoff

Safe Number coexistence remains explicit; full-range/historical/IRR/migration,
tracked selection/consumption, valuation/layers/landed-costs/assembly and general
combined cross-writer acceptance remain MON-077/078/024 and assigned gates.
No retry token for standalone adjustments/metadata creation; these are new events.
Transfer/take completion rejects retries without reposting. Catalog UI keeps its
existing USD/two-decimal display, not an inferred KWD/IRR conversion. A synthetic
direct receipt race omits its GL fixture deliberately; the real MON-052 regression
qualifies actual REST/MCP receipt GL. No genuine session/OAuth/browser/PostgreSQL16
or independent human accounting/security review is represented as passed.

No bounded task blocker. Close with controller check/submit/self-review/done,
validate/status, then commit/push as explicitly authorized and stop. Next MON-077.
