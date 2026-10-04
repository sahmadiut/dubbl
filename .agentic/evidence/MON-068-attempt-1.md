# MON-068 attempt 1 - exact bank reconciliation contracts

## Identity

2026-10-04, Asia/Tehran. Operator/reviewer: coding-assistant. Entry HEAD
7825c63 (MON-067), master, clean working tree; origin/master was synchronized.
This evidence describes the verified working diff before the requested commit.
Self-review only; no human financial/security, production or deployment approval.

## Implementation

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-068/dependency evidence, ADR-006, money manifest/source money
and API sections, and actual banking, payment, expense, journal and MCP code.
Controller selected and claimed MON-068. Existing session/proof/mark/exclude/undo
REST and MCP duplicated unsafe Number sums, int32 GL casts, partial audit writes
and generic journal/payment undo. Those verified implementations were replaced.

- Shared direct-DB bank-reconciliations service and strict described wire schemas
  implement session list/create/proof/complete/adjustment/mark/undo/exclude.
  Thin REST adapters preserve success envelopes/status; eight distinct MCP tools
  use AuthContext/wrapTool, registered once. Old module keeps its import alias.
- Signed numeric bank minor units coexist with canonical exact aliases. Text SQL
  and bigint guard sums/differences; safe numeric input/saved/converted limits are
  explicit. Foreign statement/base GL units stay separate, with null comparison;
  foreign completion/adjustment rejects rather than inventing balance FX.
- Tenant-first lookup, organization/bank/movement/session locks and owned GL,
  references, saved exact money/FX and date checks qualify transitions. Session
  windows cannot overlap; completion proves every nonexcluded accounted line,
  opening-plus-movement closing equality and the GL closing balance. Statement
  sessions now prevent bank currency/type/GL-link changes before movements exist.
- Existing manual journal and cash-payment matching only detach; their accounting
  stays. Bank-created cash uses MON-057's reversal inside the same transaction,
  restoring exact document balances and retaining allocation history. Noncash
  carriers cannot follow the cash path. Bank expense/coding/adjustment/transfer
  reversals copy saved amounts, exact FX and dimensions; original journals remain
  posted with compensating links. Expense headers soft-delete, lines stay.
- Transfer undo validates two reciprocal owned equal-opposite legs/shared journal,
  unwinds both, removes only audit-proven synthetic rows and retains real provider
  dates/amounts/balances. Selected synthetic/standalone removal is explicit in MCP.
  Completed affected sessions reopen atomically, with remaining lines attached.
- Numbering/GL allocation/postings/documents/payments/expense/movement/session/
  output preflight and awaited audits share each transaction. Synthetic final
  audit faults demonstrate full rollback, including auto-created bank GL links.
- Reconciliation form uses exact scale-aware major parsing/Minor strings, accepts
  three-decimal input and shows explicit currency labels. Bigint summary sums and
  exact signed English formatting retain large/fractional amounts. GL display
  uses base currency; unlike-currency comparison and completed-session write-offs
  are guarded. Accounted lines cannot be ignored without undo. Existing legacy
  allowance decreases; no increased allowances/new legacy imports.
- Boundary registry, API/MCP/module docs, money README/manifest/test matrix and
  generated money inventory updated. No schema/migration-file/flag/unit change.

## Acceptance mapping

1. BANK_RECONCILIATION_WIRE_CONTRACTS inventories all eight operations/envelopes,
   permissions, signed minor inputs/aliases, currency units/scales, safe limits,
   dates/pagination, state/GL/history/locks, atomicity, retry/undo corrections and
   explicit unsupported foreign/full-range/legacy cases. Pure tests cover canonical
   aliases/date/ID/strict validation and exact signed/large display.
2. bank-reconciliations-worker calls actual exported REST handlers and registered
   SDK tools through InMemoryTransport on migrated PostgreSQL. Numeric-only,
   exact-only and dual balances/adjustments, signed values and USD/JPY/KWD/IRR
   units, API-key invalid/expired/custom bank/viewer roles, two tenants and spoofed
   organization headers are exercised. Tool names/count/strict descriptions and
   existing REST pagination/transaction envelopes are checked.
3. SQL-text before/after snapshots prove no committed financial/audit effects on
   rejected range/sum/difference/history/state/date/tenant/reference/alias inputs,
   unmatched journals, noncash or unavailable allocations, invalid completion IDs,
   duplicates/overlap, period locks and closed years. Positive fixtures prove
   saved-FX mirrored journals, exact restored invoice/bill balances, retained
   allocations, existing-cash/manual detach, expense/coding/synthetic adjustment/
   reciprocal transfer undo, session reopen and unchanged provider snapshots.
   Final audit fault snapshots cover create/complete/adjustment/GL allocation/
   mark/exclude/coding/cash/expense/transfer undo, including MCP. Concurrent undo,
   completion and opposite transfer undo allow one exclusive success. Changing
   current FX does not change foreign cash reversal.

## Verification

All commands ran in D:/Projects/dubbl with installed dependencies. Integration
fixtures used synthetic PostgreSQL 18 loopback port 55478 in
D:/Temp/dubbl-mon068-pg-e34c46b4a5694011948841a72637c968/data, trust auth for
fixtures only. Explicit synthetic TEST_DATABASE_URL creates/migrates/drops random
isolated databases, not the configured .env database. Worker provider keys blank.
Final database count zero; fast/wait server shutdown succeeded. Cluster files
remain outside the repository; temporary repository path note was removed.

| Actual command/check | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119-task graph, MON-068 claimed | Structural only |
| node --import tsx --test tests/bank-reconciliation-wire.test.ts plus reconciliation integration | Final 4/4 pass | 3 pure groups and actual DB/REST/SDK worker |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 198/198 pass, none skipped | Full unit suite, limited concurrency |
| Eight integration suites with --test-concurrency=2: bank-reconciliations, bank-transfers, bank-document-matches, bank-accounts, payment-reversals, payment-settlements, expense-lifecycle, bank-categorization | Exit 0; 8/8 pass | Migrated synthetic PostgreSQL 18 |
| Final reconciliation integration after expanding no-GL audit rollback | Exit 0; 1/1 pass | Final bounded operation worker |
| npm run typecheck (MDX and tsc) | Exit 0; final run passed | No build |
| npm run lint | Exit 0; 0 errors, 148 existing warnings | Full repository |
| npx eslint all changed TS/TSX/REST/MCP/test paths | Exit 0; no warnings | Affected source |
| money_inventory.py --write | Exit 0; 410 columns, 1525 scanned files, 1232 consumers, 24176 occurrences | Lexical inventory |
| verify_money_inventory.mjs / verify_legacy_money.mjs | Exit 0; 410 columns/1232 hashes, 9 regression guards | Structural/legacy checks |
| git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin master; divergence query | Exit 0; 0 ahead/0 behind before commit | Requested fork |
| psql synthetic database count / pg_ctl fast shutdown | Zero databases; server stopped | Test fixtures only |

Initial fixture runs failed because the fixture omitted required AR/AP accounts
and used incorrect exchange-rate field names; fixed using actual schema/services.
Initial typecheck caught these fixture types and service DTO/default-account
types, which were corrected. The first npm test run, while other heavy checks ran,
failed with existing currency-rollout child-process ETIMEDOUT errors. The same
complete test suite passed with --test-concurrency=2; no tests were skipped or
timeouts weakened. These intermediate failures are not passing evidence.

No full build, Next dev server, Docker, production migration/deployment, live
providers, browser/session/OAuth, PostgreSQL 16 or independent accounting/security
review occurred. Foreign statement completion/adjustment, ambiguous legacy/
provider history and full-int64 workflows explicitly reject. Period-configuration
and other unadopted writers remain separate concurrency qualification. IRR flags
and combined MON-021/financial/migration/production gates remain unchanged.

## Review and handoff

Actual self-review: MON-068-review-1.md. No blocker remains for this bounded task.
Close through the controller, commit/push as requested, verify synchronization
and stop. Next task MON-069 other bank contracts; MON-021 retains combined
settlement/noncash/expense/banking acceptance and MON-042/045/048/051 handoffs.
