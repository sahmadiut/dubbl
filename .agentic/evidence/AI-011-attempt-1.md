# AI-011 assembled usage and operations dashboard acceptance

## Identity and scope

2026-11-04 (Asia/Tehran), Codex self-operated in D:/Projects/a/dubbl,
master, entry HEAD 8d8f319f. Entry tree was clean. Live controller selected
AI-011 after its five completed children. Claimed and completed only this
integration parent; no child evidence or completed task was rewritten.
Memory supplied the one-task/local-commit convention, verified against the
live controller and repository instructions.

Read root instructions, START_HERE, project/map/frontend/controller guidance,
AI-011 and child evidence, product-experience/usage/operations/forms contracts,
actual dashboard and settings components/controllers, REST/MCP registrations,
authorization, persistence and disposable-database fixtures.

No runtime application change was required by this acceptance. Added an
independent combined fixture and updated current contract documents and this
parent's handoff/status. No schema, migration, financial calculation, provider
call, Stripe change, build, dev server, delegation, push, deployment or activation.

## Combined fixture

`tests/integration/ai-dashboard-acceptance.test.ts` and its worker use the
production UsageSettingsController and DashboardController against actual REST
handlers and linked organization/site MCP SDK transports in one migrated database.
Only authentication session acquisition and browser fetch routing are substituted.
Current SQL membership, custom-role, session binding and site-admin checks are real.
Unexpected fetch paths fail rather than contacting any provider.

The scenario starts empty, creates an immutable price using Persian decimal
input and explicit organization/member budgets, and seeds historical unknown
usage plus a queued run with a completed step. It then exercises:

- One-budget-only missing-policy explanation; full quota after both policies;
  exact 9007199254740993 observed tokens, null output observations and
  1.000000000001 estimated unresolved cost, with REST/MCP report/export parity.
- Combined date/member/provider/model/currency/price/state filters; full scoped
  export; exact quota versus the report; immutable historical price after a new
  version; restrictive zero; stale budget rejection; explicit MCP budget update
  reflected in both browser controllers without resetting any usage.
- MCP Stop versus the dashboard's old reviewed version (409, no replay), then
  fresh cancelled details without an available Stop; completed-step preservation.
  Dashboard Disable versus MCP's old version (409), with credentials preserved.
- Ordinary own usage, denied organization usage, usage-only audit visibility
  without Stop/settings/history/transcript grants, actual history/audit REST
  denial, live revocation in an existing MCP closure, foreign organization
  clearing and denied download.
- Site aggregates with no membership/organization header, matching separate
  site MCP report/export, content-free exported fields, and site-admin revocation
  affecting both dashboard and an already registered site MCP closure.
- Independent before/after SQL equality for every historical usage field and
  the global provider catalog. No price/budget edit erases usage.

Early fixture assertions were corrected to use the browser price projection
(the wire also returns createdBy), actual quota status/reason codes, and the
report/SQL usage fields rather than a field omitted by the browser quota DTO.
These were fixture assumptions; no runtime defect was concealed or changed.

## Acceptance mapping

1. Real filters and exact full totals include token categories and per-currency
   settled/reserved/unresolved estimates. Run/state and step outcomes, active
   work, duration totals/samples, quota and scoped export use shared services.
   The 8-suite regression also covers paginated totals, separate EUR/USD values,
   all attempt states, run states and date boundaries. Duration is persisted
   run elapsed time including waits, explicitly not provider response latency.
2. Own, authorized organization and site-only views have independent authority.
   Parent fixture additionally denies actual history and audited-transcript
   handlers for a usage-only auditor. Operations/export expose no transcripts.
3. Price/budget browser mutations are visible to MCP and quota reporting;
   optimistic versions and live permissions agree for policy, Stop and Disable.
   Redacted finite run reasons contain no raw errors or tool arguments.
4. Existing component tests run English/Persian presentation contexts and actual
   JSX handlers for empty/loading/error, exact values, unknowns, separate
   currencies, denial and confirmations. Real database cases verify pagination,
   complete exports, 10000/10001-group bounds and unauthorized access.
5. My usage, organization and site aggregates remain separate. Real services
   provide filters/pages/exports with matching registered MCP operations;
   no totals are inferred from the visible page or organization credentials.
6. Observed partial categories, reservations and unknown consumption remain
   distinct. Rows retain price IDs; costs stay separate per billing currency.
   Reset is the actual UTC month boundary and renders through the configured
   timezone adapter. Missing, zero and exhausted limits and unavailable-price
   explanations are covered by regression/service/component checks. Availability
   never promises admission; missing observations never become known zero.
7. Existing localized forms create immutable exact rates per million tokens,
   preserve historical versions and require explicit org/member policies.
   Parent fixture connects these edits to quota/reporting without resetting usage;
   AI-005 regression independently tests metered admission prerequisites.
8. Component/controller regression invokes reset/filter/pagination/form handlers,
   retains non-secret drafts, reviews conflicts, fences duplicates and delayed
   A/B/A organization responses, and checks Stop/Disable confirmations in both
   locales. Database tests independently check current roles, version conflicts,
   SQL lock/revocation races, full totals and large exact values.

## Verification

Initial shared-tree unit and database runs passed. Unrelated UI edits appeared
during checks, so final verification used an isolated detached worktree at
8d8f319f plus only this task's changes: temporary dubbl-ai011-check-* directory.
The shared UI files were never edited, staged, restored or committed by this task.
These checks qualify the task snapshot, not concurrent uncommitted UI edits.
Installed node_modules/.source junctions and copied existing Next type artifacts
were reused; no build or dev server generated them. This is not a clean install.

A task-owned random dubbl-ai011-* PostgreSQL 18 cluster used trust authentication
bound only to 127.0.0.1:27419. Explicit TEST_DATABASE_URL fed the existing random
create/drop-database fixture harness. No application database or shared server
was read/reset/stopped. Provider calls were disabled in all child workers.

| Command/check | Actual result |
|---|---|
| Component/catalog command below, isolated worktree | 27/27 passed, zero skips/failures, 3.9 seconds |
| Database regression command below, isolated worktree | 8/8 passed, zero skips/failures, 61.7 seconds |
| Final parent fixture after adding explicit transcript denials | 1/1 passed, 10.4 seconds |
| Focused ESLint on both new TypeScript files | Passed, no warnings |
| node node_modules/typescript/bin/tsc --noEmit | Isolated and final incremental checks passed, exit 0 |
| npm run lint | Isolated check passed, zero errors and 20 existing warnings outside owned files |
| node --import tsx scripts/validate-messages.ts | Isolated check passed, 10973 keys per locale |
| Capability and model tool-coverage audits | Isolated checks passed, 112 modules/834 tools/597 routes/211 pages, seven reviewed tools |
| node .agentic/scripts/verify_legacy_money.mjs | Isolated check passed all nine checks |
| python .agentic/agent.py validate; git diff --check | Passed; 444 structurally valid tasks, no whitespace errors |

```text
node --import tsx --test tests/ai-dashboard.test.ts tests/ai-usage-settings.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/ai-dashboard-acceptance.test.ts tests/integration/ai-dashboard.test.ts tests/integration/ai-usage-settings.test.ts tests/integration/ai-usage-reports.test.ts tests/integration/ai-site-usage.test.ts tests/integration/ai-operations.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-tool-registry.test.ts
```

The initial shared-tree typecheck was stopped after concurrent edits appeared;
a duplicate invocation was stopped too. Neither is reported as passing. Final
typecheck runs against the isolated task snapshot. No money inventory rerun:
no inventoried runtime source or money contract changed; legacy checks passed.

Final SQL inspection found zero dubbl_ci_* fixture databases. Stopped only the
owned PostgreSQL cluster; pg_ctl status confirmed no server running (exit 1).
Stopped cluster data/logs and the isolated checkout remain outside the repository
for diagnosis; no running helper or server is left by this task.

## Review, limitations and handoff

Codex self-review: AI-011-review-1.md. No peer or human review claimed. Production
session/JWT/browser acquisition, actual viewport/zoom/keyboard focus trapping,
screen-reader output, native Persian, live providers, deployment and activation
remain unqualified by these fixtures. Existing native/financial/security/release
gates and AI-012/013 remain in force; readiness/product follow-ups remain open.
No live-price/invoice claim, production activation or permission waiver follows
from assembled technical acceptance. Next task is computed after completion.
