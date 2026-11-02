# AI-059 scoped bilingual usage and operations dashboards

Date: 2026-11-02 (Asia/Tehran). Operator: Codex. Entry HEAD f092b346,
clean working tree in D:/Projects/a/dubbl. Live controller selected AI-059;
completed only this child. AI-011 retains independent assembled acceptance.
No delegation, push, full build, dev server, provider request, deployment or
rollout activation. Stripe and existing provider/price/budget forms are preserved.

Read root instructions, live task/controller/frontend role, dependency evidence,
product/usage/operations contracts, actual services, REST/MCP registrations,
organization selection, presentation and existing component/database fixtures.
Memory supplied the one-task/local-commit convention; repository state was
verified live. No prior completion status was assumed.

## Acceptance mapping

1. `/settings/ai/usage` is linked in existing settings navigation. Its distinct
   My usage/organization views use scoped reporting and operations endpoints.
   `/admin/ai` embeds a separate site-session dashboard that needs no organization
   and loads only global aggregate reporting/export endpoints. Server denial
   yields no data; independent configuration-control denial does not suppress
   an ordinary user's or usage auditor's permitted reports.

   Editable filters cover Gregorian UTC inclusive/exclusive dates (maximum 93
   days), exact user/provider/price IDs, model, currency and attempt state; site
   adds organization. Run filters use only dates/member/run state. Quota always
   explains the current UTC month and selected billing currency. Reset, previous/
   next pagination, reload and complete JSON exports use real contracts. Exports
   omit pagination, preserve units/partial-observation/completeness metadata and
   fail without a partial file above 10,000 groups. Full service totals never
   derive from the visible page. Counts/tokens and twelve-decimal major billing
   currency costs remain strings, including values above 2^53; no currency sum,
   FX conversion, accounting mutation or floating-point cost calculation.

2. UI labels observed partial tokens, category unknown counts, reserved,
   unresolved and settled estimates, immutable price IDs, reset timezone and
   canonical UTC instant. It explains unavailable prices, missing/zero/exhausted
   budgets and that remaining capacity does not guarantee admission. Shared
   presentation formatting honors independent locale/calendar/numerals/timezone;
   IDs/decimals are bidi-isolated. Added 136 paired flat English/Persian messages.

   Content-free operations show full filtered run/step outcomes, duration samples,
   timestamps and finite localized reasons. Drill-down adds advisory `canStop`
   identically on REST/MCP, using the final live read authorization and current
   state. Actual Stop independently rechecks permission/version transactionally.
   Authorized organization configurations can be disabled with exact versions.
   Concrete confirmation dialogs initially focus Keep unchanged. Opening them
   does not mutate. Completed effects/credentials are preserved; uncertainty is
   explicit. Conflict/uncertain writes remove the reviewed target, require fresh
   inspection/reload and never replay. Denied interventions/exports clear loaded
   data and invalidate overlapping reads.

3. Browser controller generations bind requests/results/downloads to organization
   and scope, with independent read sequencing. Tests cover delayed A/B/A reads,
   details/writes/exports, disposal, duplicate actions, conflicts/denial/network
   failures and no stale downloads. Filter edits survive reads/errors and change
   only on explicit reset/scope switch. Active-scope navigation is a no-op.

   Production JSX handler tests run in real English/Persian PresentationProvider
   contexts with controlled hook state: editing/apply/reset, pagination using
   applied filters, empty/loading/error/conflict rendering, exact separate totals,
   unknowns, escaped caller text, own/organization/site presentations, denied
   controls and cancel-focused confirmations. They invoke handlers, not static
   class/string assertions alone. Real REST/SQL role tests separately establish
   ordinary own access, organization-only auditors without history/Stop/Disable,
   owner interventions, changed custom roles, foreign organization denial and
   site admins with no organization membership plus site-admin revocation.

Contract and qualification details: ../docs/AI_USAGE_DASHBOARD.md. Updated MCP
description and generated registries: 112 modules, 834 tools, 597 routes, 211
pages; seven reviewed model-callable tools remain unchanged. No schema/migration.

## Verification

Task-owned randomized PostgreSQL 18 cluster `dubbl-ai059-*`, trust authentication
bound only to 127.0.0.1, ephemeral port 27417. Explicit TEST_DATABASE_URL fed the
existing create/drop-random-database fixture harness. No application database or
shared service was used/reset/stopped. Only session acquisition is stubbed;
SQL membership/custom-role checks, handlers, migrations and services are real.
Existing dependency suites also run linked registered MCP transports.

| Command/check from repository root | Actual result |
|---|---|
| Final unit/component/catalog command below | 27/27 passed, no failures/skips, 2.8s |
| Combined PostgreSQL regression command below | 5/5 passed, no failures/skips, 39.1s |
| Final new dashboard integration after self-review changes | 1/1 passed, 5.3s |
| node node_modules/typescript/bin/tsc --noEmit | Final source passed, exit 0 |
| npm run lint | Passed, zero errors; 20 pre-existing warnings outside owned files |
| Focused ESLint on all ten owned TS/TSX files | Passed, no warnings |
| node --import tsx scripts/validate-messages.ts | Passed: 10973 keys per locale |
| node scripts/audit-ai-capabilities.mjs | Passed, source matches registry |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, seven reviewed/827 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine regression checks |
| Money verifier and current/HEAD-source-overlay comparison | Both exit 1, 1447 identical ordered diagnostics; not a green gate |
| python .agentic/agent.py validate; git diff --check | Passed; final controller check recorded before commit |

```text
node --import tsx --test tests/ai-dashboard.test.ts tests/ai-usage-settings.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/ai-dashboard.test.ts tests/integration/ai-operations.test.ts tests/integration/ai-usage-reports.test.ts tests/integration/ai-site-usage.test.ts tests/integration/ai-tool-registry.test.ts
```

The new database worker drives the actual browser controller through real REST
handlers, independent SQL before/after comparisons, 28 matching groups across
two pages, identical full totals/export, EUR/USD separation, unknown consumption,
missing budgets, exact huge values, filtered complete exports, version conflicts,
completed-step preservation and credential preservation on Disable. Underlying
usage/provider rows remain identical. Regression suites retain actual REST/MCP
10,000/10,001-group export bounds, live authorization and operations recovery.

Exploratory failures were corrected: a synthetic settled row lacked required
observations; nested catalog objects violated existing flat-catalog contracts;
component fixture assumptions and a missing type import were repaired. The new
navigation label now belongs to AiDashboard, preserving existing catalog lines.
This also removes line-reference noise from the stale money inventory. No money
registry was rewritten; the gate still fails with the identical HEAD baseline.

SQL inspection found zero dubbl_ci_* fixture databases. Stopped only the owned
cluster; pg_ctl status reported no server running (expected exit 1). Stopped
temporary data/logs remain for diagnosis.

## Limitations and handoff

Component hook/browser IO is controlled. Actual 360/768/1280 viewport/200% zoom,
browser keyboard/focus containment, screen-reader output, native Persian review,
production session/provider/deployment and activation are not qualified here.
Responsive/accessibility structure was reviewed: min-width bounds, wrapping,
logical alignment, 44px controls, isolated mixed text and keyboard-reachable
table scrolling. Existing native/release gates and AI-011 remain independent.
Codex self-review is AI-059-review-1.md; no peer/human review is claimed.
