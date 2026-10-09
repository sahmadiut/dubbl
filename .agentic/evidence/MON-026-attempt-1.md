# MON-026 attempt 1 - integrated asset and loan contracts

## Identity

2026-10-09, Asia/Tehran. Operator: coding-assistant. Entry HEAD/master:
`b14206c81cea2d97e51b8daa70bdb810e17acf7d`.
The controller already selected MON-026 in_progress, with all prerequisites done.
Entry dirty files were MON-026, asset-depreciation, organization-settings,
organization tools and the new asset-loan parent fixtures. Inspected and resumed
these task-owned changes; no unrelated entry work was overwritten or staged.
This is evidence of the uncommitted completion, not a fabricated push/commit ID.

Read root/nested instructions, START_HERE, project/repository/controller/backend
guidance, current task/dependencies, child evidence/reviews, ADR-006, source
migration/compatibility sections and actual asset/loan/settings service/tool/route
contracts. The memory workflow skill informed one-task scoped verification and
push procedure; live controller/source/tests establish current results. No agents
were delegated and no independent human/accountant review is claimed.

## Implementation and audit result

The children already implement 25 actual REST/MCP operation pairs. Parent
acceptance independently qualifies the combined lifecycle and failure boundaries
instead of treating child completion as parent evidence.

Two integration corrections are retained and verified:

- Functional-currency settings reject 409 when any fixed asset, category or loan
  history exists, including unposted/soft-deleted roots. These implicit-currency
  amounts cannot be reinterpreted by changing organization currency. The existing
  organization row lock coordinates settings with adopted root writers; journal
  and payroll protections remain. Same-currency/metadata edits still work.
- New depreciation posting accounts must match organization posting currency,
  in addition to ownership/live/active checks. Wrong-base postings reject 422
  atomically. Historical reversal accounts still retain original currency/FX,
  including after synthetic direct base edits or account inactivation.

The parent worker invokes actual API-key handlers and full registered MCP SDK
transports in one migrated fixture database. It combines numeric and Minor cost
clients, capitalization, targeted depreciation undo/retry, signed valuation and
disposal, and concurrent targeted loan repayments. Exact expected journal/root
amounts, unchanged original lines, balanced identity FX and unchanged bank
statement balance are asserted. Parent races combine capitalization/depreciation,
disposal/depreciation and initial master/currency selection. Whole-slice snapshots
qualify no-mutation failures, including batch rollback after an earlier ordinary
asset charge, permissions overriding owner fallback, foreign roots, invalid keys,
unsafe input, conflicting aliases and unknown organization fields.

All 25 asset/loan and both relevant settings tools are asserted registered with
strict schemas and descriptions for every input property. Unknown-input calls
exercise representative masters, costs, depreciation, valuation, loans and
settings. New fixtures explicitly disable production IRR/outbound providers.
The child GBP depreciation/reversal fixture now uses GBP accounts at posting.

ASSET_LOAN_INTEGRATION_CONTRACTS maps all child boundaries, exact units/aliases,
supported ranges, combined figures, currency policy and remaining qualification.
Updated organization/depreciation registries, manifest, money README, test matrix
and CI runbook describe current behavior. The money inventory is regenerated.
No schema changed and no migration generation/application to the application DB
was needed. Original GL lines and stored units are unchanged.

## Acceptance mapping

1. ASSET_LOAN_INTEGRATION_CONTRACTS joins all 25 pairs and organization settings
   to the five detailed asset/loan registries and settings registry. Their inputs,
   outputs/envelopes, fixed cents versus REST loan decimal-major input, safe
   numeric/Minor limits, null/sign rules, basis points, physical units, dates and
   exact identity rates are explicit. Unsupported valuation schedules fail closed.
2. Parent and all five child integration workers pass on migrated PostgreSQL;
   organization-settings regression passes. Actual legacy/exact REST and MCP,
   custom roles, API-key organization precedence, two-tenant roots/accounts/history
   and strict registration/input assertions cover each domain. Parent fixtures
   independently combine adopted writers and retry/concurrency invariants.
3. Whole-slice snapshots and child atomic faults qualify unsupported syntax/range/
   alias/currency/history/permission/period/output/audit behavior before commit.
   Numeric money agrees with exact aliases, intermediates use bigint, and actual
   responses serialize without bigint crashes. Wrong-base depreciation, valued
   asset depreciation/undo/batch, protected master changes, currency reinterpretation
   and paid-history deletion leave domain/GL/audit data unchanged.

## Verification

All commands ran in D:/Projects/dubbl. A fresh PostgreSQL 18 cluster used synthetic
fixture identity at 127.0.0.1:55426 with timezone UTC. Explicit TEST_DATABASE_URL
fed the existing create/migrate/drop random-database harness. No .env credentials
or application database were read, seeded, migrated or reset. Each worker's
DATABASE_URL referred only to its generated fixture database.

| Actual command/procedure | Observed result | Limit |
|---|---|---|
| Controller validate/status/context/next and pre-closure validate | Exit 0; 173 valid tasks; active MON-026 resumed | Structural workflow, not financial qualification |
| Initial serial parent + asset-master/depreciation/valuation/CWIP/loans integration run | Asset-master, valuation, CWIP and loans passed; depreciation and parent fixture mismatches identified below | Four unchanged domain workers passed; failed cases rerun after repair |
| node --import tsx --test --test-concurrency=1 tests/integration/asset-loan-integration.test.ts tests/integration/asset-depreciation.test.ts tests/integration/organization-settings.test.ts | Exit 0; 3/3, zero skips; 27264.6 ms | Final affected workers plus settings regression |
| node --import tsx --test tests/asset-master-wire.test.ts tests/asset-depreciation-wire.test.ts tests/asset-valuation-wire.test.ts tests/asset-cwip-wire.test.ts tests/loan-wire.test.ts tests/organization-wire.test.ts | Exit 0; 21/21, zero skips | Focused pure syntax/range/exact math checks |
| pnpm typecheck, including final fixture additions | Exit 0 twice | MDX generation and tsc; no build |
| pnpm lint | Exit 0; zero errors, 107 warnings | 106 warnings outside changed files; one new unused import subsequently removed |
| Final changed-file pnpm exec eslint on three changed source/tool files and three changed/new fixtures | Exit 0; no warnings | Removed unused parent impairment handler import; no further behavior change |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1887 scanned files, 1414 consumers, 27039 occurrences | Lexical inventory/source hashes |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import regression gate |
| git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead/0 behind before task commit | Final authorized push is subsequent closure work |
| Fixture database count; pg_ctl stop | Zero random fixture databases; server stopped successfully | Temporary cluster files retained in system temp |

The first integration command accidentally named nonexistent organization.test.ts;
organization-settings.test.ts is the actual path and was explicitly run in the
successful final command. The first depreciation worker failed because its GBP
posting used USD GL accounts, now correctly rejected by the new production guard.
Changed that synthetic posting to dedicated GBP accounts without weakening the
original GBP reversal assertion. The initial parent expected 409 for deleting a
paid loan; the existing documented state rejection is 400, so corrected the test.
The strengthened final parent also adds strict schema, unknown-input, permission,
unsafe-range/alias and loan isolation assertions. Lint found one unused parent
import; removed it and final changed-file lint is clean.

No full build, unrequested dev server, Docker, full repository test suite, hosted
CI dispatch, external provider, deployment or production migration was run.
Independent accounting, production IRR/full-int64, large-history performance,
browser/session/OAuth and new post-valuation schedules are not qualified here.

## Review and handoff

Actual self-review is in MON-026-review-1.md. All three bounded acceptance criteria
are supported; no remaining task blocker. Finish controller checks/submit/self
review/done, validate/status, stage only task-owned files, commit and push the
authorized change to origin/master, then verify the remote SHA and working tree.
Stop after this task. The next current ready integration parent is MON-028; do
not begin it during this closure.
