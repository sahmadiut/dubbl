# MON-086 attempt 1 - exact asset/category master contracts

## Identity and selection

2026-10-06, Asia/Tehran; actual operator coding-assistant. Repository
D:/Projects/dubbl, master, entry HEAD 533eba993b01d9ac0e8acf41412d209a5c1577b8.
Initially clean; origin/master matched after fetch. Owner requested "complete and
push next task". Controller validate/status/context selected MON-026. Source
inspection verified 15 asset/category/loan route files, separate depreciation
calculations, CWIP/valuation/disposal and amortization/payment writers. Claimed
MON-026, then split per controller into MON-086..090, retaining unchanged parent
criteria and integrated acceptance. Claimed and implemented MON-086 only. These
results were recorded before commit; no invented commit, peer or human approval.

## Implementation

`lib/api/asset-master-wire.ts` centralizes strict described schemas, Gregorian
dates, int32 months/units and basis-point ranges, canonical cents aliases and safe
saved DTOs. `lib/api/asset-master.ts` implements all ten category/asset root
operations through scoped direct-DB transactions. Four root REST files and
`lib/mcp/tools/asset-master.ts` call them; index registration preserves existing
tool names and adds the three absent asset get/update/delete tools. Removed only
the adopted master handlers from fixed-assets.ts; financial-action tools remain
with MON-087..089. No DB schema edit or new migration.

Numeric cents and matching Minor strings coexist. Alias conflicts, noncanonical
syntax, unsafe Numbers, valid int64 outside the safe consumer range and unknown
fields reject without mutation. Nullable saved revaluation/disposal values stay
null; signed child changes/surplus retain their signs. Nested depreciation,
revaluation and CWIP history gain explicit aliases. Counts remain numeric and
pagination retains REST/MCP envelopes, with a documented common 200-row ceiling.

Both transports enforce manage:assets. Reads close the prior REST-read/MCP
permission difference. New/retained posting links must be live active accounts
owned by the organization. Detail category/account/journal joins fail closed for
foreign links. Historical inactive/deleted owned accounts and deleted categories
remain readable. API-key organization scope ignores a contradictory supplied
organization header. Scoped queries use deterministic ordering.

Category defaults apply only on create; explicit values win and null accounts
clear defaults. Updates retain omitted amounts and never reapply category
defaults. Residual plus accumulated depreciation is compared using bigint.
Service date cannot precede purchase; usage-based assets need positive expected
units; useful life is required directly or through category. CWIP root patches
cannot bypass capitalization. Economic settings cannot change with child history
or root history markers, including accumulated depreciation when legacy detail
is missing. Soft deletion preserves children and journals.

All adopted writers lock organization before master rows, preflight saved and
returned DTOs, and await audit in the same transaction. Faults roll back writes
and audit together. Concurrent master deletion has one successful result. Master
creation retains its existing non-idempotent semantics and posts no acquisition
journal. Master metadata operations do not rewrite posted journal/child amounts.

`lib/money/asset-display.ts` and master dashboards/drawer parse cents without
floating multiplication, retain maximal-safe decimal input/display, reject
fractional months/excess percentage precision and sum loaded rows with bigint.
The existing USD/two-decimal display and loaded-page summary scope remain.
Financial-action editors/calculations stay with their children. The full wire
registry records the implicit-currency limitation; no new currency is invented.

## Acceptance mapping

1. ASSET_MASTER_WIRE_CONTRACTS.md documents ten REST/MCP pairs, existing/additive
   envelopes, exact aliases, signed/nullable values, input/output ranges, default
   and null semantics, permissions/errors, units and transactional limitations.
   MONEY_MANIFEST, inventory, money README, test matrix and CI runbook are updated.
2. Five pure groups and the migrated PostgreSQL worker exercise actual ten pairs,
   registered full MCP SDK transport, synthetic API keys/custom roles, two
   organizations, legacy/exact/dual/zero/max-safe clients, category default/clear
   behavior, authorization failures, scoped history and malformed saved links.
3. No-mutation snapshots cover all master/child/journal/audit tables. Twelve
   audit-fault operations (six writers in each transport), post-insert unsafe
   returned money and invalid/range/auth/history inputs roll back. Concurrent
   deletion retains history. Final focused 6/6 and typecheck/changed ESLint pass;
   broad regression passes 347/347, including migration and dump/restore checks.

## Verification

All commands ran from D:/Projects/dubbl. A fresh disposable PostgreSQL 18 cluster
at loopback port 55486 used synthetic fixture identity and UTC timezone; each
integration case created/migrated/dropped its own random database. The connection
target and configured application .env database were not migrated, seeded or
reset. No environment credentials were printed or stored in evidence.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/next/start/split | Exit 0; initial 135 and post-split 140 tasks | Structural tracking only |
| node --import tsx --test tests/asset-master-wire.test.ts tests/integration/asset-master.test.ts (final) | Exit 0; 6/6, no skips | Five pure groups and one substantial actual transport/PostgreSQL case |
| pnpm typecheck (final) | Exit 0 | MDX/tsc only; no full build |
| pnpm lint | Exit 0; 0 errors, 129 existing warnings | Final master UI and schemas included; subsequent history guard also checked by changed-file lint |
| Changed service/tool/fixture/display eslint (final) | Exit 0, no warnings | Explicit changed implementation list |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts tests/integration/*.test.ts | Exit 0; 347/347, no skips, elapsed 311776 ms | 269 pure and 78 PostgreSQL cases; final small history/input guards separately rerun in focused fixtures/typecheck/ESLint |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1654 scanned files, 1268 consumers, 25536 occurrences | Source hashes/lexical inventory, not full dataflow |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import guard |
| python -m unittest discover -s .agentic/tests -v | Exit 0; 32 cases, 31 passed/1 skipped, elapsed 536.515 s | Full 140-task graph and added synthetic-child graph resolve; Windows symlink privilege skip remains for Linux CI |
| git diff --check | Exit 0 | Checkout LF/CRLF notices only |

Initial typecheck caught generic-record typing and merged optional residual
typing; corrected and rerun. The first PostgreSQL run exposed a fixture's invalid
viewer enum, corrected to an actual member with an empty-permissions custom role.
No implementation defect was hidden by changing a financial assertion. Review
added saved rate/life and foreign-category negative cases, exact whole-month and
percentage input, and protection for root history markers without child rows.
All final focused cases pass. Controller tests also pass with the single stated Windows symlink skip. The disposable cluster had zero remaining fixture databases before it was stopped successfully.

## Review and qualification limits

See MON-086-review-1.md for the implementing assistant's actual self-review.
Safe Number business support does not imply full-int64 support. Assets/templates
have no saved currency/FX snapshot; implicit base-currency history needs parent
and subsequent financial qualification. Lifecycle writers still need shared
locks, period locks, exact calculations and retry protection in MON-087..090.
Browser/session/OAuth, native financial review, large-history performance and
production/IRR qualification remain unclaimed. No full build, Next dev server,
Docker, live provider request, production migration/deployment or rollout ran.

## Handoff

No MON-086 blocker remains. Finish controller acceptance, honest self-review and
done, commit/push to origin/master as explicitly authorized, verify synchronized
SHA/clean tree and stop. Next bounded task is MON-087. Parent MON-026 retains
unchanged integrated acceptance and all five child dependencies.
