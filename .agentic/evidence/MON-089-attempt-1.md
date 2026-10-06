# MON-089 attempt 1

## Identity

2026-10-06, Asia/Tehran. Operator coding-assistant; implementation and self-review
by the same assistant. Entry HEAD 0db402c0b6d138287161c5944bddfc424edca0ac,
master, clean tree, origin/master synchronized again by fetch before closure.
This evidence describes the verified uncommitted implementation; no fabricated
commit, independent accountant, human review or deployment approval.

## Implementation

Read root and nested AGENTS, START_HERE, controller/project/repository/backend
instructions, MON-089/088 handoff, MON-011 review, ADR-006 and source migration/
compatibility sections. Controller selected MON-089 and claimed it. Source showed
independent REST cost/list/capitalization and MCP capitalization, no MCP cost
parity, unsafe Number summation, absent capitalization period check and
out-of-transaction audit. No new schema/migration is needed.

Shared `lib/api/asset-cwip.ts` and strict described schemas now implement three
operations directly through Drizzle. Thin REST handlers use guarded JSON helpers;
`lib/mcp/tools/asset-cwip.ts` replaces the last legacy fixed-assets tool module
and registers one tool per operation through index/wrapTool/AuthContext. Existing
capitalize_cwip_asset name and numeric REST envelopes remain; additive cost
list/add tools, Minor aliases and inServiceDate/retry input parity are explicit.

Costs are positive integer cents in the safe numeric range. Exact alias agreement,
bigint accumulation, sum/root/GL guards and exact identity-rate metadata prevent
rounding or bigint JSON crashes. Dashboard construction cost entry uses exact
fixed-cents parsing and history sums bigint. Capitalization preserves the entire
recorded cost including opening CWIP basis, instead of replacing that basis with
only tracked costs. Saved holding-account consistency is enforced, including
master edits of nonzero CWIP before child costs exist. Service starts at the
capitalization date unless an equal/later explicit date is supplied.

Organization-first/asset locks coordinate masters/lifecycle. Category/account
scope and base currency, cost root/state/history, linked journal scope/source/
date/amount, period tiers/closed years and distinct GL accounts are preflighted.
Missing cost journals/inconsistent history fail closed without repair. Costs,
root, default accounts, journal lines and transactional audit/output preflight
commit together. Optional cost retry keys and stable capitalization retry keys
replay saved cross-transport results once and reject conflicting inputs.

`ASSET_CWIP_WIRE_CONTRACTS.md` records every actual input/output, unit, alias,
supported range/error, concurrency/retry/compatibility correction and limitation.
MONEY_MANIFEST, money README, CI runbook/test matrix and regenerated inventory
record this adoption. No monetary schema, migration or rollout flag changed.

## Acceptance mapping

1. Three REST/MCP operations are mapped in ASSET_CWIP_WIRE_CONTRACTS, with strict
   input schemas, explicit cents/Minor fields, safe-range/derived limits, exact
   identity FX and preserved numeric envelopes. Counts/dates/IDs are not money.
2. `asset-cwip.test.ts`/worker invokes actual handlers with synthetic API keys and
   conflicting org header, and full MCP SDK registration/transports. Legacy,
   Minor and dual aliases, max-safe posting, two tenants/custom permissions,
   expired/invalid keys, scoped accounts/category/history, default accounts,
   periods, opening basis, no-tracked/zero capitalization and GL figures are
   asserted. Parent asset master/depreciation/valuation workers pass too.
3. Pure failures and whole-table snapshots prove syntax/date/range/alias/scope/
   state/history/period failures do not mutate. Derived max-plus-one rejects.
   Keyed same/changed retries, concurrent keyed/unkeyed costs, concurrent
   capitalization and cost/capitalization races preserve once-only totals.
   Protected master edits and stale legacy snapshots reject. Both mutation
   operations through both transports roll back audit/unsafe root/unsafe GL
   faults, including on-demand default accounts in the second tenant.

## Verification

All commands ran in D:/Projects/dubbl. A disposable PostgreSQL 18 cluster bound
to 127.0.0.1:55489, timezone UTC, synthetic local test identity, supplied the
explicit TEST_DATABASE_URL. Existing integration harness creates/migrates/drops
random databases; .env application credentials/database were not read, migrated,
seeded or reset. No credentials are persisted in evidence.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start and pre-closure validate | Exit 0; 140 valid tasks, MON-089 selected | Structural tracking |
| node --import tsx --test tests/asset-cwip-wire.test.ts tests/integration/asset-cwip.test.ts tests/integration/asset-master.test.ts tests/integration/asset-depreciation.test.ts tests/integration/asset-valuation.test.ts (final) | Exit 0; 6/6, zero skips; 13443.4 ms | Two pure groups, four actual PostgreSQL transport/regression workers |
| pnpm typecheck (final) | Exit 0 | MDX generation and TypeScript, no build |
| pnpm lint | Exit 0; zero errors, 129 existing warnings | Later review edits covered by final changed-file ESLint |
| Changed-file pnpm exec eslint (final) | Exit 0; no warnings | Shared service/wire/master, tools/index, routes, dashboard and fixtures |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1671 scanned files, 1275 consumers, 25530 occurrences | Lexical inventory/source hashes |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import regression gate |
| git diff --check | Exit 0 | LF/CRLF checkout notices only |
| Random-database count and pg_ctl stop | Count zero; stopped successfully | Temporary cluster files retained in system temp |

Initial typecheck/fixture found an incorrect JSON helper import and nullable
helper narrowing; fixed and reran. First full worker assertions passed but its
new cleanup tried to close an unexported pool; changed to the existing worker
process-exit convention and reran successfully. Review added nonzero opening
holding-account protection, missing-history/date checks and nonzero/default
account fault coverage; final checks include these. Inventory generation first
saw the cached deleted legacy module; staging that deletion resolved its existing
git ls-files source enumeration without changing the generator.

No full build, unrequested dev server, Docker, live providers, full repository
test suite, browser/session/OAuth, independent financial review, deployment or
production IRR/full-int64 qualification ran. No controller implementation change.

## Review and handoff

See MON-089-review-1.md for actual self-review. No bounded slice blocker remains.
Finish controller check/submit/self-review/done, validate/status, authorized
commit/push to origin/master and verify remote SHA/clean tree; stop after one
task. Next task MON-090 covers loan schedule/payment contracts. MON-026 retains
combined lifecycle/currency/history/performance/financial acceptance. Opening
CWIP funding is a precondition, not inferred or reconstructed here; implicit
historical currency and legacy balance remediation remain separate work.
