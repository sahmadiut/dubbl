# MON-050 attempt 1 - exact purchase requisition contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`dd8c2b9e0f5c8965d9f20b4a2bdc47ed0ab903d4`, clean master tree. The user requested
the next task and commit/push after full completion. Controller validate/status/
context selected MON-050 and start claimed it. This evidence describes actual
working changes before commit; review is implementing-assistant self-review.

Read repository/nested rules, START_HERE/controller/project/repository map,
backend role, MON-050/MON-020, dependency MON-011/MON-049 evidence/review, ADR-006,
money manifest/source migration and API compatibility sections, and actual
REST/MCP/schema/money/PO/UI/fixtures. No delegation.

## Implementation

- purchase-requisition-wire describes shared schemas, decimal-major numeric/
  exact-major/minor price aliases, quantities, dates and supported safe bounds.
  Existing bigint ratio extension preserves signed ties and subminor prices;
  requisitions retain zero tax and optional tax reference. Header/line/supplier
  money adds named exact aliases without replacing safe numeric fields.
- purchase-requisitions shares direct-DB tenant-scoped list/detail/create/edit/
  delete/submit/decision/PO conversion. All mutations lock organization, request,
  lines and tenant references; validate saved dates/currency/zero tax/balances/
  conversion link; enforce strict request-date and generated PO-date locks.
- REQ numbering uses sequences and existing numeric labels, guards int32 capacity
  and commits with header/lines/status/link/audit. PO conversion reuses exported
  nextPurchaseOrderNumber inside the same organization-locked transaction and
  copies saved amounts instead of recalculating rounded unit prices. DTO/JSON
  preflight precedes commit. Repeated/concurrent conversion rejects the loser.
- Thin REST routes retain envelopes, with shared serialization and explicit
  malformed JSON rejection on create/edit/reject. MCP preserves six existing
  tool names and registered function, adding distinct edit/delete/submit tools.
  Fields/descriptions state units/ranges and every handler uses wrapTool.
- Source inspection found the UI issued an empty PUT then a status PUT that the
  API silently stripped; it pretended submission locally. Added the actual
  draft-to-submitted transition via the existing PUT shape, rejected arbitrary
  status changes, and made the UI send one request using the returned status.
  Draft-only edits/deletion protect submitted/approved/converted requests.
- Soft delete retains historical lines. No automatic approval routing or
  notification existed; module docs now describe actual manual transitions.
  Updated contract registry, API/MCP/module docs, money README/manifest, test
  matrix and reproducible source inventory. No schema changes/migrations.

## Acceptance mapping

1. PURCHASE_REQUISITION_WIRE_CONTRACTS inventories all REST/MCP operations and
   envelopes, units, exact aliases, signed safe monetary/int32 quantity bounds,
   date/currency/reference inputs, no-tax calculation, legacy unknown-field
   whitelisting, permissions, state restrictions, locks and conversion policy.
2. Real migrated PostgreSQL handlers/API-key/custom read-only role/full registered
   SDK compare numeric/exact-major/minor/dual clients across every operation.
   USD 1250 remains 1250; above-int32/safe-max/signed values, JPY/KWD and saved
   subminor extension round-trip/copy correctly. Pure IRR scale fixtures do not
   enable functional-currency readiness. Tenant/header/key/role/foreign ID/
   contact/account/tax/converted-link cases prove isolation before disclosure.
3. SQL-text snapshots of requisition/PO headers/lines/sequences and audit/journal/
   stock/email counts prove failures leave no business effects. Unsupported
   price/product/sum/history, alias/syntax/quantity/date/JSON, state, supplier,
   period/fiscal and numbering errors reject. Injected requisition-line,
   PO-header/line, conversion-status/link and audit constraints roll back all
   writes, including numbering. Concurrent initial REQ numbering, approve/reject,
   conversion and PO creation produce unique numbers and a single order.

## Verification

All commands ran at D:/Projects/dubbl with installed dependencies. Created a
synthetic PostgreSQL cluster using installed C:/Program Files/PostgreSQL/18/bin
binaries at D:/Temp/dubbl-mon050-pg-737b0802a07a46c38045fd8461005850, loopback
127.0.0.1 port 55460, synthetic dubbl_ci trust-auth role. pg_ctl launched hidden.
TEST_DATABASE_URL explicitly selected that server; the harness applied existing
migrations to randomly named disposable dubbl_ci_* databases and removed them.
The connection target and configured application database were never migrated or
reset. No .env credentials were read/printed/persisted; Stripe/Resend worker keys
were blank. Synthetic files remain outside the repository; the server is stopped.

| Actual command/procedure | Actual result | Limits |
|---|---|---|
| python .agentic/agent.py validate/status/context/start MON-050 | Exit 0, valid 104-task graph and selection | Structural tracking only |
| node --import tsx --test tests/purchase-requisition-wire.test.ts | Exit 0, 3/3 | Exact pure contracts |
| Final TEST_DATABASE_URL=... node --import tsx --test tests/integration/purchase-requisitions.test.ts tests/integration/purchase-orders.test.ts | Exit 0, both workers pass | Actual handlers/full SDK, synthetic migrated PostgreSQL |
| npm test, final full suite | Exit 0, 156/156 | Units, not financial release approval |
| npx tsc --noEmit, final run | Exit 0 | Installed dependencies/existing generated sources |
| npm run lint, final full run | Exit 0, 0 errors/155 existing warnings | Four prior warnings removed with replaced code/unused UI import |
| Final npx eslint over all affected TS paths | Exit 0, clean | Changed services/routes/tools/UI/tests |
| money_inventory.py --write, then verification; verify_money_inventory.mjs | Exit 0, 410 columns/1418 paths/1169 consumers/22661 occurrences | Lexical/Drizzle/hash validation, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | No new deprecated money usage |
| pg_isready; remaining fixture DB count; pg_ctl fast/wait stop | Ready during tests; zero fixture DBs; stopped, exit 0 | Synthetic server only |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows controller closure |
| git diff --check | Exit 0 | LF/CRLF notices only |

All integration runs passed. Initial affected lint found an unused copied reverse
fixture binding and the existing unused UI Input import; removed them. Final
checks include the added saved-status/link consistency guard, foreign conversion
references/link, PO-header rollback and genuine first-sequence concurrency test.
No failed check is claimed passed. No full build/dev/Docker, schema generation,
configured DB migration, deployment/provider/browser/session/OAuth or IRR
production enablement was run. Existing migrations establish isolated fixtures,
not production migration qualification.

## Review and handoff

See MON-050-review-1 for honest implementing-assistant self-review. No slice
blocker remains. Complete controller check/submit/self-review/done and validate;
commit/push as requested, then stop. MON-020 retains combined procurement
acceptance. Next task is MON-051 exact debit-note contracts. Remaining bulk/
receipt/settings/trash/configuration writers and races, full-int64, production
migration and independent financial/security/linguistic/release/IRR gates remain
assigned; none is inferred from this bounded task.
