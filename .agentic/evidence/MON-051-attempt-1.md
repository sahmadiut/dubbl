# MON-051 attempt 1 - exact supplier debit-note contracts

## Identity and selection

2026-10-03 through 2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry
HEAD `9989a0d`, clean master working tree. User requested the next task followed
by commit/push after full completion, then requested continuation after an
interruption. Controller selected and started MON-051. This evidence records
verified working changes before commit; self-review only.

Read root/nested AGENTS, START_HERE/controller/project/repository map/backend
role, MON-051/MON-020/MON-021, dependency MON-011 and MON-048 attempt/review,
ADR-006, money manifest, source migration/API requirements and actual debit-note,
credit/bill/stock/journal/FX/schema/API/MCP/email and integration harness sources.
No delegation, build or dev server.

## Implementation

- New debit-note-wire reuses qualified exact price/amount/DTO primitives, retaining
  REST decimal-major and MCP integer-minor numeric prices with additive exact
  major/minor aliases. Strict header/line schemas, Gregorian dates/UUIDs, bounded
  list filters and safe numeric workflow limits reject lossy inputs. Header/line/
  supplier money gains exact *Minor aliases; quantities remain hundredths and
  discounts basis points. Stored discount-adjusted amounts preserve the existing
  debit-note-line schema, which has no discount column.
- Shared debit-notes direct-DB service supplies eight operations across real REST
  handlers and registered MCP tools. New update/delete/send tools complete parity;
  existing MCP void now actually reverses accounting. Removed the obsolete unused
  floating/non-atomic createDebitNoteJournalEntry helper. Draft edits whitelist
  fields and replace lines/totals together; soft deletion retains lines.
- Organization/document/journal/reference locks and guarded precommit responses
  protect numbering, header/lines, posting, inventory, carrier allocations, bill
  balances and audit in one transaction. Invalid saved state/line sums and unsafe
  money fail before committed mutation; audit failures roll back business effects.
- Expense recognition posts exact AP/expense/input-VAT legs, with standard fully
  recoverable VAT. Standalone historical issue-date FX and linked saved bill FX
  use qualified posting primitives with persisted exact/millionths metadata.
- Complete matching linked non-GRNI stock bill returns mirror original saved GL
  amounts/FX/dimensions and remove original receipt quantity/value. Average/FIFO
  stock and warehouse balances are guarded; FIFO requires unconsumed exact layers.
  Void mirrors saved debit-note legs, restores actual stock and original FIFO
  layers, refuses missing/altered movement history or changed costing method.
  Bill void now refuses active linked notes to prevent double reversal.
- Application requires recognized matching supplier/currency/saved AP/FX and
  proportional carrying values. Positive amount/amountMinor aliases produce paired
  noncash made/other carrier allocations with exact note and supplier due updates,
  without a second AP journal. Void validates/unwinds complete pairs and bill
  balances and removes qualified carriers; orphaned/foreign/bank/provider/journal-
  linked history fails. MON-021 Handoff records remaining settlement interactions.
- REST validates requested email before recognition, then sends after accounting
  commit. Delivery failure returns 502 with the sent note. Repeated recognition
  fails instead of double-posting; existing document-email tools provide delivery
  retry. PDF attachment remains disabled as before (MON-034).
- Added pure and actual PostgreSQL/full SDK fixtures; contract registry, API/MCP/
  bill module docs, money README/manifest, test matrix and refreshed source inventory.

## Acceptance mapping

1. DEBIT_NOTE_WIRE_CONTRACTS inventories all selected operations/envelopes, units,
   aliases, safe ranges, state/permission/org rules, exact rounding/FX, stock,
   allocation, legacy history, email and errors. Unsupported partial/GRNI/tracked/
   standard stock, specialized expense taxes and differing/rounded carrying FX
   fail explicitly; full-int64 is not advertised. These limits remain assigned
   parent/inventory/settlement qualification rather than silently accepted math.
2. debit-notes-worker invokes real REST authentication/handlers and registerAllTools
   through actual in-memory MCP SDK transports. Legacy/exact/dual clients cover
   every operation; API keys/custom roles/invalid keys/conflicting org headers/
   foreign IDs and contact/account/tax references reject without business changes.
   Fixtures cover above-int32/safe-max amounts, exact discounts/tax/subminor prices,
   JPY/KWD scales, live-rate changes versus saved KWD posting/reversal, complete
   average/FIFO warehouse stock return/restoration and allocation unwind.
3. SQL-text snapshots compare every relevant business table around malformed
   aliases/JSON/list inputs, mass assignment, invalid dates/ranges/references/
   saved money/state/history, missing accounts/FX, unsupported partial stock/tax,
   consumed FIFO/differing carrying FX and period/closed-year failures. Injected
   debit-line, journal-line, allocation, stock and void-audit failures establish
   full rollback. Concurrent first/subsequent numbering, send/full apply/void
   avoid duplicate effects. Numbering exhaustion rejects with unchanged state.
   Numeric response aliases remain safe and exact strings preserve stored units.

## Verification

All commands ran at D:/Projects/dubbl with installed dependencies. Initialized
a synthetic PostgreSQL 18.6 trust-auth cluster at
`D:/Temp/dubbl-mon051-pg-6c416dc88b994d6b873e7800351d7fd4`, loopback port 55461,
synthetic dubbl_ci role. Hidden pg_ctl launch redirected output. Explicit
TEST_DATABASE_URL selected only this server. The harness created/migrated/dropped
random dubbl_ci_* databases; connection target/configured application DB were
not migrated or reset. The server was stopped across the interruption, then
restarted for final regression; zero fixture databases and final shutdown verified.
No environment credentials were printed/persisted; worker Stripe/Resend keys blank.

| Actual command/procedure | Actual result | Limits |
|---|---|---|
| Controller validate/status/context/start MON-051 | Exit 0; valid 104-task graph and selection | Structural tracking only |
| node --import tsx --test tests/debit-note-wire.test.ts | Exit 0, 3/3 | Pure exact contracts |
| Final TEST_DATABASE_URL=... node --import tsx --test tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/credits.test.ts | Exit 0, all 3 workers pass | Real handlers/full SDK, synthetic migrated PG18.6 |
| npm test, final full suite | Exit 0, 159/159 | Units, not independent financial qualification |
| npx tsc --noEmit, final run | Exit 0 | Installed dependencies/existing generated sources |
| npm run lint, final full run | Exit 0, 0 errors/155 existing warnings | Matches previous slice warning count |
| npx eslint affected services/helper/routes/tools/unit/integration fixtures | Exit 0, clean | All changed TypeScript sources |
| money_inventory.py --write, then without --write; verify_money_inventory.mjs | Exit 0, 410 columns/1423 paths/1171 consumers/22761 occurrences | Lexical/Drizzle/hash validation, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | No new deprecated money usage |
| pg_isready; remaining fixture database count; pg_ctl fast/wait stop | Ready during tests; zero fixture DBs; stopped exit 0 | Synthetic server only |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows closure |
| git diff --check | Exit 0 | LF/CRLF notices only |

Initial integration failed when a role-denial fixture sent fractional legacy MCP
unitPrice 12.5: SDK input validation preceded the role handler, returning no JSON
status. Corrected that fixture to valid integer-minor input; subsequent and final
workers pass. Also corrected negative MCP reference fixtures to use valid integer
prices so they reach actual reference checks. No initial failure is claimed passed.
Self-review added proportional carrying-value checks, stock movement/cost-method/
dimension guards, bank-linked carrier barriers, historical read compatibility,
bounded supported sorts and postcommit email-failure state. Final regression covers
the implementation, including injected stock/void rollback and legacy history.

No schema change/migration generation, configured-DB migration, build/dev/Docker,
live provider/browser/session/OAuth/deployment or IRR enablement. Fixture migrations
establish isolated runtime tests, not production migration safety. Partial/GRNI/
specialized expense-tax, base-currency regime changes, cross-writer settlement/
idempotency/report classification, full-int64 and independent financial/security/
linguistic/release/IRR gates retain their assigned qualification.

## Review and handoff

See MON-051-review-1 for honest implementing-assistant self-review. No supported
slice blocker. Complete controller check/submit/self-review/done, validate, commit
and push as requested, then stop. MON-020 retains combined procurement acceptance.
Next task: MON-052, exact goods-receipt contracts.
