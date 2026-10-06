# MON-091 attempt 1 - exact price-list and resolution contracts

## Identity and selection

2026-10-06, Asia/Tehran; actual operator coding-assistant. Repository
D:/Projects/dubbl, master, entry HEAD 635ba9dc4e97f34260407cd102d0f1e046d52f82.
Initially clean and synchronized with origin/master after fetch. Owner requested
"complete and push next task". Read project instructions, controller, project/map,
backend role, MON-011 review, ADR-006 and actual sources. Controller selected
MON-027. Claimed it, verified independent pricing/CRM/project master/billing
workflows, then split into MON-091..094 per controller rules, retaining every
parent criterion and combined acceptance. Children priority 0 preserves bounded
execution ordering; only MON-091 was implemented. No delegation, peer/human
approval, deployment or invented implementation commit is claimed. Evidence was
prepared before the user-authorized commit/push.

## Implementation

- lib/api/pricing-wire.ts adds strict described metadata/price/resolver schemas,
  Gregorian dates, alias agreement, safe cents bridge and saved metadata/price/
  tier/JSON preflight. unitPriceMinor is additive and retains existing integers.
- lib/api/pricing.ts now owns all ten operations via organization-scoped direct
  DB services. Mutations coordinate organization locks and physical unique
  indexes, enforce owned root/row/live inventory, and commit audit with changes.
  Snapshot reads validate nested historical inventory ownership. Currency changes
  keep v1 integer prices; metadata does not introduce accounting postings.
- Four existing REST files keep their envelopes and call those services; added
  GET price-lists/[id]/resolve parity with existing resolve_price. Malformed JSON,
  repeated/unknown resolver query keys and noncanonical quantity spellings reject.
- lib/mcp/tools/pricing.ts retains existing tool names through its existing index
  registration, uses wrapTool and strict shared schemas with every field described,
  and adds list_price_list_items. Missing/foreign resolver roots now return the
  documented null response instead of failing the old MCP ownership precheck.
- lib/api/invoice-writes.ts adds saved list/tier guards to the shared invoice/quote
  lookup, retaining existing quantity/extended-price/currency/fallback policies.
- PRICING_WIRE_CONTRACTS, MONEY_MANIFEST, source-hash inventory, CI_RUNBOOK, task
  index and plan coverage record adoption/split. No schema edit or new migration.

## Acceptance mapping

1. PRICING_WIRE_CONTRACTS.md documents every operation/envelope, IDs, numeric/
   exact cents aliases, safe range, whole quantity, dates, currency reinterpretation,
   resolver null/error behavior, uniqueness, auth, audit, replay and limits.
2. Four pure groups plus pricing-worker.ts invoke all ten actual REST/MCP pairs,
   complete SDK registration and API-key auth. Fixtures assert strict described
   tool schemas, numeric/string/agreed aliases, safe maxima, zero, owned historic
   joins, tier/date boundaries, custom mutation roles, expired/invalid keys,
   conflicting organization headers and foreign roots/items/price-row parents.
3. Invalid body/query/aliases/date/range/tier/reference/schema values leave full
   list/item/inventory/audit snapshots unchanged. Actual injected audit faults
   roll back all six mutation types in both transports; injected post-insert/
   update price range faults roll back price and audit. Corrupt saved foreign
   joins, unsafe prices and currency metadata fail without leaking or guessing.
   Cross-transport duplicate tiers/names and delete/delete/add-delete races
   preserve valid uniqueness and soft-delete history.

## Verification

All commands ran in D:/Projects/dubbl. A new disposable PostgreSQL 18 cluster
bound to 127.0.0.1:55491 used synthetic test identity and UTC timezone, with explicit
TEST_DATABASE_URL. Harness creates/migrates/drops random fixture databases; no
application .env credentials or target DB were opened, migrated, seeded or reset.

| Command/check | Actual result | Scope/limitations |
|---|---|---|
| Controller validate/status/context/next/start/split/pre-closure validate | Exit 0; 144-task graph valid after split | Structural workflow only |
| node --import tsx --test tests/pricing-wire.test.ts tests/integration/pricing.test.ts (final) | Exit 0; 5/5, no skips, 7559.9862 ms | Four pure groups + actual ten-pair PostgreSQL transport worker |
| node --import tsx --test tests/integration/invoice-writes.test.ts tests/integration/quotes.test.ts | Exit 0; 2/2, no skips, 13324.7733 ms | Existing lookup/CRUD transport regression fixtures |
| pnpm test | Exit 0; 285/285, no skips, 9042.589 ms | Entire pure suite; before subsequent worker-only negative/race additions |
| pnpm typecheck | Exit 0 | Fumadocs generation + tsc --noEmit; includes new transport worker |
| pnpm lint (final) | Exit 0; zero errors, 129 existing warnings | First run found one new unused test import, resolved by added currency fixture before final run |
| pnpm exec eslint on all changed TS services/wire/MCP/routes/tests | Exit 0; zero warnings | Final changed-file lint clean |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1681 files, 1284 consumers, 25628 occurrences | Lexical/hash/Drizzle inventory, not semantic proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks | Legacy import gate |
| git diff --check | Exit 0 | LF/CRLF conversion notices only |
| Fixture DB count / pg_ctl stop | Zero random databases remain; new cluster stopped | Temp cluster files retained, no broad deletion |
| Git initial origin divergence after fetch | 0 ahead / 0 behind | Commit and push verification follows evidence closure |

## Review and remaining scope

See MON-091-review-1.md for actual self-review. No slice blocker remains. Safe
numeric coexistence does not promise full-int64 support, historical currency
regime changes, production IRR, high-volume performance, independent financial
or release approval. Project/CRM scope is tracked in MON-092..094 and parent
MON-027 retains integration acceptance. No dashboard price-list editor exists
in the inspected application, so there is no client-side editor to migrate here.
No full build, unrequested dev server, Docker, screenshot, provider or deployment
was performed. Parent accounting/release gates remain mandatory.

Complete controller check/submit/self-review/done, commit and push to origin/master
as authorized, verify matching remote SHA and clean working tree, then stop.
Next bounded task is MON-092 CRM contracts.
