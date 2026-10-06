# MON-094 attempt 1 - exact project billing and profitability

## Identity

2026-10-06, Asia/Tehran. Operator/reviewer: codex, implementing-assistant
self-review only. D:/Projects/dubbl, master, entry HEAD
0185aeb6df52fd88305ac22e32aefad703a29909. Entry tree was clean. User requested
completion and push of the controller's next task; MON-094 was selected and
claimed. Read root/nested instructions, START_HERE, controller/project/map,
backend role, task/dependency evidence, ADR-006, source migration/API sections,
registries and actual source. Live origin fetch showed 0 ahead/0 behind. No
independent reviewer, human approval, delegation or deployment is claimed.
This record precedes the authorized implementation commit/push; the resulting
SHA is verified outside this immutable evidence record.

## Implementation and acceptance mapping

1. PROJECT_BILLING_WIRE_CONTRACTS documents seven REST/MCP operation pairs and
   the existing singular register adapter, every input/output field, fixed cents
   and Minor aliases, dates, physical minutes/quantity, markup/percentage units,
   safe/int32/int64 syntax bounds, status/error/period/reference behavior, retries,
   historical restrictions and limitations. Three project routes and the report's
   project branch share project-billing.ts with registered direct-DB MCP tools.
   The unrelated contact report branch remains MON-029.
2. Four pure groups and the actual migrated project-billing worker exercise all
   seven pairs and all eight billing MCP tools via full SDK registration. Real
   synthetic API keys verify scope/auth, custom permission denial/allowance,
   expired/invalid keys and ignored foreign org headers. Fixtures cover numeric,
   exact and agreeing aliases; saved USD/JPY/KWD/IRR labels keep 1250 as 1250;
   all source kinds resolve actual owned posted/approved records and reject
   foreign lines, wrong projects, invalid states/currencies/rates. Preview users
   exclude password/auth fields. REST/MCP profitability envelopes agree.
3. Shared strict inputs and bigint rational time/markup/fixed-percent/signed-cost
   calculations prevent silent loss; sources and outputs are range-checked.
   Bad batches, conflicting aliases, unsupported exact money, overflow products,
   unsafe sums/scaled percentages, foreign roots/references, invalid dates,
   wrong policy selections and periods preserve complete snapshots. Audit faults
   exercise every billing writer in both transports. Returned-unsafe invoice and
   milestone triggers roll back invoices/lines, numbering, source allocations,
   project totals and audit. Organization/project and period table locks protect
   adopted writes. Keyed retries replay without writes; cross-transport keyed races
   return one invoice, while unkeyed source races and fixed 60%+60% races permit
   one allocation. Billed sources are immutable. Fixed totals use stable project
   IDs, exclude on-billed costs, survive rename and reject overbilling/name-only
   untagged legacy history. Existing zero time rates stay zero. Signed manual
   null-source journal cost/reversals are included; bill journals are excluded.

project-master.ts now includes projectBillableItem in the existing currency-change
reference guard, protecting expense-only registrations. Actual REST/MCP fixtures
assert this guard, and the complete MON-093 worker passes unchanged. Progress UI
uses bigint preview sums and exact decimal percent products/validation and surfaces
preview load failures. README, manifest, CI runbook and source-hash inventory record
adoption. No schema/migration, stored rescale or production currency flag change.

## Verification

All commands ran in D:/Projects/dubbl. A new synthetic PostgreSQL 18 cluster bound
only to 127.0.0.1:55494 with UTC timezone used explicit TEST_DATABASE_URL. Harnesses
created/migrated/dropped random fixture databases. The configured application DB
and .env credentials were not read/migrated/reset/seeded. Final random database
count was zero, then the new cluster was stopped; temporary cluster files remain.

| Actual command/check | Result | Scope/limits |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0; MON-094 selected | Structural orchestration only |
| node --import tsx --test tests/project-billing-wire.test.ts tests/integration/project-billing.test.ts tests/integration/project-master.test.ts (final) | Exit 0; 6/6, no skips; 37189.7235 ms | Four pure groups, all billing pairs/adapter and MON-093 regression, random migrated DBs |
| pnpm test | Exit 0; 297/297, no skips; 20769.2373 ms | Full pure regression suite; final service/reference/date changes verified above |
| pnpm typecheck (final) | Exit 0 | Fumadocs plus tsc --noEmit; no full build |
| pnpm lint | Exit 0; zero errors, 127 existing warnings | Same baseline warning count |
| pnpm exec eslint on all changed TS/TSX files (final) | Exit 0; one preexisting milestone UI unused-variable warning | New services/schemas/routes/MCP/fixtures clean |
| money_inventory.py --write, then verification | Exit 0; 415 columns, 1702 scanned files, 1302 consumers, 25626 occurrences | Source hashes and line/column coverage only |
| verify_money_inventory.mjs | Exit 0; 415 columns and 1302 consumer hashes/lines verified | Not runtime financial qualification |
| verify_legacy_money.mjs | Exit 0; nine checks | Legacy import regression gate |
| git diff --check | Exit 0 | Git LF/CRLF notices only |
| PostgreSQL fixture count/pg_ctl stop | Zero random DBs remaining; cluster stopped | No broad filesystem cleanup |
| git fetch origin / rev-list HEAD...origin/master | Exit 0; 0/0 at entry verification | Authorized commit/push verified after closure |

Early fixtures caught a nonexistent approved bill enum (actual status received),
a negative API-key fixture needing the dk_ prefix, and the existing REST period
error status being 422. Corrected fixtures and all affected checks passed.
A Windows Python pipeline could not match a Unicode comment; subsequent edits
used ASCII anchors and UTF-8 file reads, preserving existing product Unicode.
Self-review added period-table race protection, returned allocation validation,
legacy name-only fixed-history rejection, expense-only currency guarding and
Gregorian default-due overflow preflight. No full builds, dev server, screenshot,
Docker, provider/FX request, schema generation or deployment was run.

## Review and handoff

See MON-094-review-1.md for actual self-review. All three criteria are supported
within the documented safe-number fixed-cents scope. No blocker remains in this
slice. Full-int64, currency-scale/FX costing, legacy repair, invoice reversal
allocation policy, high-volume performance and independent financial/production
IRR qualification remain parent/later gates. No acceptance is claimed for MON-027.
All four split children are now implemented; parent MON-027 needs final integrated
review and cross-writer qualification before its own completion. Complete controller
checks/submission/self-review/done, hand off parent integration, commit only owned
files and push origin/master as authorized, then stop after this implemented task.
