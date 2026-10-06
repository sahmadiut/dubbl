# MON-087 attempt 1 - exact asset depreciation contracts

## Identity and selection

2026-10-06, Asia/Tehran; actual operator coding-assistant. Repository
D:/Projects/dubbl, master, entry HEAD 61e0807. Tree initially clean and
synchronized with origin/master after fetch. Owner requested "complete and push
next task". Controller validate/status/context/next selected MON-087; started
only that task. Read root/nested instructions, project/map, backend role,
MON-011/MON-086 evidence, ADR-006, relevant source and contracts. These results
were recorded before commit; no invented implementation SHA, peer/human review
or deployment. Parent MON-026 retains unchanged integrated criteria.

## Implementation

`lib/api/asset-depreciation-wire.ts` describes strict schemas, real Gregorian
dates, bounded physical readings and retry inputs; legacy empty POST remains
valid while malformed/unknown input rejects. `asset-depreciation.ts` provides
three shared direct-DB operations. REST single, batch and rollback use these;
new registered `lib/mcp/tools/asset-depreciation.ts` preserves the single/undo
names and adds missing batch parity. Only adopted handlers were removed from
the old fixed-assets MCP file. No schema edit/migration was necessary.

Known numeric cents coexist with explicit canonical Minor output strings. Saved
cost/residual/NBV, child money/dates/units and joins are preflighted. Unsafe money,
inconsistent totals and revaluation history fail closed without mutation. Exact
clients establish cost through the MON-086 master aliases; depreciation actions
compute their own amounts and accept no price/currency override. Batch counts,
dates and usage stay their actual units. No amount rescaling or generic aliases.

`lib/fixed-assets/depreciation.ts` now uses bigint ratios/intermediates with
positive ties rounding up. All four methods cap charges at remaining base.
Timing conventions retain their existing monthly meaning, with Gregorian leap
proration, full-at-purchase consuming the remaining base and final time-based
charges clearing residual exactly. Count of actual remaining schedule rows is
the period index. Posting before service/history rejects. Zero rounded charges
still do not advance a time-based schedule; this limitation is documented.

Single/batch charge once per calendar month, including old date-only rows.
Conflicting readings reject; identical monthly or keyed requests replay without
duplicate journals. Optional scoped retry keys use transactional audit JSON,
fingerprint inputs and committed results. Batch is all-or-nothing and skips
usage-driven/CWIP/future-service/exhausted/already-booked assets.

Only latest depreciation can be undone. Explicit expected entry/key makes retries
stable; legacy default selection has a daily retry guard. The detail UI sends the
displayed latest entry; detail ordering now includes creation instant and UUID.
Undo removes only the schedule row, restores exact totals, preserves the original
posted journal and posts an opposite linked journal. Original amounts/accounts,
currency, exact-rate and dimension fields are retained; scoped dimensions and
original journal/source/balance are verified. Returned reversal lines are checked
inside the transaction. Existing FX sync cannot preserve arbitrary authoritative
provenance: unsupported snapshots fail 422 and roll back, instead of quietly
rewriting them. Legacy lines with no exact snapshot can gain a losslessly derived
snapshot on the new reversal only. Original lines never change.

New GL lines use the organization's current base and exact 1:1 rate through the
existing scaled-rate FX sync, with its actual derived provenance. Later charges
reject an asset's prior depreciation GL currency disagreement, including rolled
back originals. GBP-to-USD organization changes do not reprice GBP undo lines.
Unposted/never-GL asset master currency history remains parent qualification.

Organization/asset locks coordinate adopted masters and all existing asset
lifecycle writer transactions. Legacy disposal/valuation/CWIP preflight snapshots
are compared under those locks; stale state conflicts instead of overwriting new
depreciation. Their separate money/audit contracts remain MON-088/089. Period
checks accept an optional transaction while preserving other callers' defaults.
Depreciation holds SHARE table locks on period_lock/fiscal_year (including absent
rows) while checking date tiers/closed years and writing, so period changes wait.
Undo checks schedule, original GL and reversal dates. These table locks may delay
cross-organization period edits; performance remains a qualification limitation.

Depreciation/undo/batch journals, schedule rows, totals, output preflight and audit
commit together. Both configured GL accounts must be distinct live active owned
accounts; neither retains existing non-GL tracking; partial configuration rejects.
Reversals can use inactive owned historical accounts. Documentation includes
ASSET_DEPRECIATION_WIRE_CONTRACTS, manifest, inventory, matrix, runbook and money
README. No currency flag, production migration or deployment changes.

## Acceptance mapping

1. Registry documents all three pairs, fields/envelopes, cents/Minor support,
   physical units, ranges, timing formulas, retry/error/locking behavior and the
   current revaluation/currency/zero-charge/FX-consumer limits.
2. Actual migrated PostgreSQL REST/API-key handlers and full registered MCP SDK
   transports cover all three pairs, legacy and exact-created masters, max-safe
   SYD, described strict tools, two tenants, expired/invalid credentials, denied
   custom permissions and staff/advisor tiers. Eighteen actual method/convention
   schedules close a known base exactly; usage and non-GL paths are covered.
3. Asset/schedule/GL/audit snapshots prove invalid/scoped/range/lock/history/retry
   failures preserve state. Concurrent single/batch and undo requests charge or
   undo once. Stale lifecycle snapshots reject. Six per-operation audit failures,
   two final-batch audit failures, post-write unsafe money and unsupported saved
   exact FX provenance roll back all writes. Final focused/typecheck/ESLint and
   inventory checks pass; broad regression passes 351/351.

## Verification

All commands ran from D:/Projects/dubbl. A new disposable PostgreSQL 18 cluster
on loopback port 55487 used synthetic identity and UTC timezone. Integration
cases create/migrate/drop random databases; no configured application .env DB or
connection target was migrated/seeded/reset. Credentials were not printed/stored.

| Actual command/procedure | Observed result | Limits |
|---|---|---|
| Controller validate/status/context/next/start and final validate | Exit 0; 140-task graph valid | Structural tracking only |
| node --import tsx --test tests/asset-depreciation-wire.test.ts tests/integration/asset-depreciation.test.ts tests/integration/asset-master.test.ts (final) | Exit 0; 5/5, no skips; 11491.7 ms | Three pure groups and two actual transport/PostgreSQL workers; includes final FX/history guards |
| pnpm typecheck (final) | Exit 0 | MDX/tsc only; no full build |
| pnpm lint | Exit 0; 0 errors, 129 existing warnings | Full repository; final added FX guard subsequently covered by changed-file ESLint |
| Changed service/schema/calculator/tool/fixture ESLint (final) | Exit 0, no warnings | Explicit final implementation files |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts tests/integration/*.test.ts | Exit 0; 351/351, no skips, 348967.3 ms | Includes historical migration/checksum/dump/restore; final isolated FX/history follow-ups separately rerun in the final focused suite |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs (final) | Exit 0; 415 columns, 1660 scanned files, 1270 consumers, 25496 occurrences | Source hashes/lexical coverage only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import gate |
| git diff --check | Exit 0 | LF/CRLF checkout notices only |
| Disposable cluster cleanup | Zero random fixture databases; pg_ctl stop successful | Cluster directory remains only in system temp; no app DB reset |

An initial typecheck caught duplicate lock imports from an interrupted editing
pass; repaired against original UTF-8 source and rerun. One negative fixture
selected an older entry instead of the latest; corrected ordering, without
weakening the expected rejection. A later FX snapshot probe exposed the actual
sync trigger's derived provenance policy. Changed the implementation to use the
actual bridge provenance and to compare saved reversal snapshots, adding a
negative authoritative-provenance fixture. Final checks pass. No full build,
unrequested Next dev server, Docker, provider calls, controller implementation
tests (controller unchanged), browser/session/OAuth or production rollout ran.

## Review and handoff

See MON-087-review-1.md for the implementing assistant's actual self-review.
No MON-087 blocker remains. Finish acceptance/controller done and authorized
commit/push to origin/master, verify remote SHA/clean tree and stop. Next task
MON-088 covers valuation/disposal and carrying-base policy. MON-026 retains
combined acceptance, independent financial review, implicit currency history,
large-history/batch performance, full-int64 and production/IRR gates.
