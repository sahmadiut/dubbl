# MON-067 attempt 1 - exact bank transfer contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator codex; entry HEAD b97cfdb, clean master
tracking origin/master. User requested the next task followed by commit/push on
full completion. Controller validate/status/context/next selected MON-067, then
start claimed it. Read root/nested instructions, controller/project/repository
map/backend role, task/parent handoff, MON-011 evidence, ADR-006, source migration/
compatibility sections and banking contract/source paths. Self-review only.

## Implementation

- bank-transfer-wire.ts preserves decimal-major REST and integer-minor MCP
  amounts with agreeing amountExact/amountMinor. Reuses qualified expense decimal
  parsing and currency rounding, with transfer positivity, strict fields, UUIDs,
  Gregorian dates, bounded memo, canonical int64 strings and safe-number bridge.
- bank-transfers.ts is the scoped direct-DB implementation of standalone and
  statement matching. One historical exact-FX journal and two signed reciprocal
  bank links share transaction/numbering/GL allocation/audit. Receiving GL debits;
  sending GL credits. Both banks must be live/active/same currency with exclusive
  active owned denomination/type-compatible GL accounts.
- Tenant-first ownership lookup, organization/bank/movement locks, both dates'
  period/fiscal checks, statement/payment/expense/import history and safe decoded
  amounts/balances prevent invalid state or duplicate exclusive matches. Exact
  FX uses the transaction executor; unrepresentable inverse, missing/future-only,
  zero rounded base or overflow rejects. Lines retain migration-trigger exact
  rate/version/direction/status/provenance alongside numeric compatibility.
- Both REST handlers use shared created/error responses and unchanged 201
  envelopes. Two dedicated strict described wrapTool MCP registrations replace
  the old duplicated writers and are registered in index.ts. Same-currency UI
  targets reflect the new matching guard; existing null counter requests work.
- Wire registry, public API/MCP/module docs, money README, manifest, test matrix
  and generated money inventory updated. No schema/migration-file/flag/unit change.

Saved bank balance and existing provider running balance remain statement
snapshots, preserving the existing contract. Synthetic transfer amounts affect
movement/GL totals; they do not invent provider running balances. Standalone
repeats intentionally create new economic events, while statement matches reject
repeats. No replay key or response replay is advertised. MON-068 owns undo/session
qualification; MON-021 retains combined banking/expense/payment acceptance.

## Acceptance mapping

1. BANK_TRANSFER_WIRE_CONTRACTS inventories both boundaries, operation/envelope/
   permission, major/minor units and four scales, rounding/alias agreement, safe
   range, FX direction/capacity, saved balances, errors, retry/concurrency policy
   and explicit unsupported cases. Pure tests cover malformed syntax/date/UUID,
   conflicts, ties, safe maximum, larger exact input and currency scales.
2. bank-transfers-worker executes actual exported REST handlers and SDK tools via
   InMemoryTransport on migrated PostgreSQL. Numeric-only/exact-only/dual REST
   and MCP inputs, incoming/outgoing mirrors, existing counter matching, null/
   omitted counter, API-key expired/invalid/foreign/viewer/custom banking auth,
   spoofed org headers and two organizations are verified. Tool descriptions and
   strict schemas are inspected, with no duplicate names alongside old tools.
3. SQL-text before/after snapshots assert financial/numbering/link/GL/audit state
   unchanged for rejected values. Tests cover safe maximum, unsafe own/foreign
   saved statement amounts and running balance, sign/magnitude/currency/state/
   import mismatches, linked payment/expense/journal history, shared/foreign/
   inactive/deleted/wrong-type/wrong-currency GL, inactive/deleted banks, both
   dates' locks/custom bypass and closed years. USD/JPY/KWD/IRR use exact scaled
   balanced postings, as-of rates/inverse and explicit missing/overflow/zero-base
   failures. Final audit faults roll back standalone, mirror, existing-counter
   and MCP paths, including GL self-linking. Same-source/common-counter/opposite
   matching/category-vs-transfer races leave one successful exclusive journal;
   independent concurrent creates produce separate balanced transfers.

## Verification

All commands ran in D:/Projects/dubbl with installed dependencies. PostgreSQL 18
synthetic loopback cluster port 55477 at
D:/Temp/dubbl-mon067-pg-4b561caac4bd4ac4bcabac9969cda6e2/data, trust-auth fixture
only. Explicit synthetic TEST_DATABASE_URL creates/migrates/drops random isolated
databases; the configured .env database was not read/migrated/reset. Worker
provider keys blank. Final disposable database count 0; fast/wait shutdown passed.
Cluster files remain outside the repository.

| Actual command/check | Result | Limit |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0; valid 119-task graph, MON-067 claimed | Structure only |
| node --import tsx --test tests/bank-transfer-wire.test.ts | 2/2 pass | Pure contracts |
| npm test | Exit 0; 195/195 pass | Unit coverage |
| node --import tsx --test --test-concurrency=2 with bank-transfers, bank-document-matches, bank-categorization, bank-accounts, bank-transaction-reads and bank-imports under tests/integration | Exit 0; 6/6 pass | Actual migrated DB/REST/SDK, synthetic PostgreSQL18 |
| Final bank-transfers integration after expanding existing-counter audit rollback | Exit 0; 1/1 pass | Updated operation fixture |
| npm run typecheck; final npx tsc --noEmit | Exit 0 | MDX/TypeScript, no build |
| npm run lint | Exit 0; 0 errors, 148 baseline warnings | Existing warnings retained |
| npx eslint changed TS/REST/MCP/test paths, separate changed banking UI/old MCP and final worker | Exit 0; no warnings | Affected code |
| Money inventory --write and read-only verification | Exit 0; 410 columns/1518 scanned/1230 consumers/24060 occurrences | Lexical inventory |
| verify_money_inventory.mjs / verify_legacy_money.mjs | Exit 0; 410 schema/1230 hashes and 9 regression guards | Structural/legacy gates |
| git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin master; divergence query | Exit 0; 0 ahead/0 behind before commit | Requested fork |
| psql disposable count / pg_ctl shutdown | 0 databases; server stopped successfully | Synthetic fixtures only |

Development failures were repaired: fixture missing required payment contact and
audit user, incorrect claim/exchange-rate field names caught by types/runtime,
and a fixture's assumption that setting review_required would survive the
dual-write trigger. The latter assertion was replaced with actual future-only/
unrepresentable inverse and zero-base fixtures. A Windows-default encoding read
changed punctuation in the old MCP file; rebuilt that edit from UTF-8 Git source
so the final diff only removes replaced code/imports, then regenerated inventory.
These intermediate failures are not passing results. Final code/types/fixtures
and documented contracts pass the checks above.

No full build, Next dev server, Docker, production migration/deployment, provider
requests, browser/session/OAuth, PostgreSQL16 or independent accounting/security
review occurred. No full-int64, production currency, IRR enablement or parent
integration completion is inferred. Period-configuration/legacy writers outside
the adopted lock protocol remain separately qualified.

## Review and handoff

Actual self-review is MON-067-review-1.md. No bounded task blocker remains. Close
through controller, commit/push as authorized, verify synchronization and stop.
Next task MON-068 exact bank undo and statement reconciliation contracts. It must
use the shared bank_transfer journal and reciprocal paired movements, preserve
statement snapshots and coordinate payment/expense/session state without reposting.
