# AI-057 bilingual immutable price and budget forms

## Identity and scope

2026-11-02 (Asia/Tehran), Codex, D:/Projects/a/dubbl, master. Entry HEAD
23937b11; entry working tree was clean. Live controller selected AI-057.
Completed only this required child; AI-011 remains open. No delegation,
push, full build, development server, deployment or activation.

Read root instructions, START_HERE, project/map/controller and frontend role,
AI-057, AI-010 handoff, AI usage budgets/product experience, actual existing
price/budget REST/MCP and authorization, management UI/client, locale parser,
organization switching, schema and disposable-database/component test helpers.
Memory supplied only the one-task/local-commit workflow; state was verified live.

## Acceptance mapping

1. Added a separate `AiUsageSettings` workspace to `/settings/ai`, with
   `PriceVersionForm` and organization/current-member `BudgetForm` cards.
   Independent permission-gated sections use existing shared AI-005 endpoints
   and matching `list_ai_prices`/`create_ai_price` and
   `list_ai_budgets`/`configure_ai_budget` operations. Existing provider,
   credential and tool-policy UI is preserved. Current member names are read
   from the existing scoped members endpoint rather than manual UUID entry.

   Extracted unchanged input schemas to browser-safe `usage-input.ts` and
   retained server re-exports. Price versions are append-only, with the latest
   200 shown using exact rates and version/evidence references. No price edit
   or delete is offered. The UI explains rate/cost units, precision, separate
   billing currencies, UTC month, both-budget/price prerequisites, restrictive
   zero/missing policies, retries/concurrency holds and unchanged past usage.
   No invented price, automatic provider test or activation is introduced.

2. Added strict browser DTOs and `UsageSettingsController` for independent
   sections, targeted validated mutations, live selected scope, generation
   fencing, revocation and unmount cleanup. Complete foreign/malformed DTO
   envelopes are rejected. Late reads, writes and A/B/A scope switches cannot
   populate another scope. Existing server permissions and optimistic budget
   versions remain authoritative; no REST/MCP input or storage unit changed.

   Controlled inputs retain edits on errors/conflicts. Reloads keep mounted
   forms and their drafts; new server budget versions are explicitly reviewed
   before loading saved values or rebinding retained edits to that version.
   Successful saves update only their own data and do not reload/remount sibling
   sections. Rapid duplicate submissions are fenced. Uncertain/unverified saves
   require an explicit reload/review before another submission, without replay.
   A confirmed save invalidates overlapping older reads and releases their
   loading state; the review-found race has a dedicated passing regression.
   Former-member budgets have no enabled save action. Scope changes clear drafts.

   The existing exact localized-decimal parser accepts Persian/Arabic/Latin
   digits with validated separators; financial rates/costs/token ceilings stay
   strings. Only bounded small concurrency/rate counts become numbers. Tested
   maxima include 999999999999.999999 rates, 999999999999.999999999999 costs,
   999999999999999999 token ceilings and 9007199254740993 per-run tokens.
   Mixed scripts, malformed values and excess precision fail without rounding.

   Added 61 paired English/Persian messages. Real production JSX renders under
   PresentationProvider with LTR/RTL roots, escaped caller data, isolated IDs
   and decimal values, associated labels/help/errors, live status, first-invalid
   focus and minimum 44px controls. Responsive grids, min-width/break handling
   and wrapping actions were reviewed in source. Actual viewport/zoom, browser
   keyboard/screen-reader and native linguistic approval remain unqualified.

Contract: [AI_PRICE_BUDGET_FORMS](../docs/AI_PRICE_BUDGET_FORMS.md).
No DB schema, migration, provider settings, transcript, rollout or Stripe edit.

## Verification

Created a randomized dubbl-ai057-* PostgreSQL 18 cluster on a random ephemeral
127.0.0.1 port, trust authentication. An explicit TEST_DATABASE_URL fed the
existing fixture harness, creating/dropping random databases. Application DB
and provider credentials were not used. Session acquisition alone is stubbed;
actual current SQL membership/custom-role authorization and linked MCP SDK run.
The browser controller uses fetch dispatch into real REST handlers, including
members and delegated catalog. No network provider request occurs.

| Command/check from repository root | Actual result |
|---|---|
| Final unit/component/catalog command below | 28/28 passed in 2.8s; no failures/skips |
| Combined PostgreSQL integration command below | 3/3 passed in 16.6s; no failures/skips |
| Final ai-usage-settings integration after the overlap-race correction | 1/1 passed in 5.8s |
| node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed, zero errors; 20 existing warnings |
| Focused ESLint across all nine owned TS/TSX files | Passed without warnings |
| node --import tsx scripts/validate-messages.ts | Passed: 10837 keys per locale |
| node scripts/audit-ai-capabilities.mjs | Passed: 111 modules, 829 tools, 592 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 822 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine checks |
| Money verifier and current/HEAD TS-source-overlay comparison | Both exit 1 with 1447 identical ordered diagnostics; not a green gate |
| python .agentic/agent.py validate; git diff --check | Passed |

```text
node --import tsx --test tests/ai-usage-settings.test.ts tests/ai-management.test.ts tests/localized-money.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/ai-usage-settings.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-tool-registry.test.ts
```

The new component suite exercises real translated JSX and controlled handlers,
error retention, precision, conflicts/reapply, member selection, revoked/denied
sections, assembled rendering, duplicate submission, delayed scope responses,
foreign/malformed DTOs and private diagnostic suppression. Hook state and
browser IO are controlled; this is component evidence, not browser acceptance.
An initial fixture numeral count and CommonJS/ESM error-class identity were
corrected. Exploratory timed-out runs were stopped, not counted as passed.
The first Unicode catalog-writing pipeline was corrected using a UTF-8 file;
final Persian text/script, renderer and full catalog checks pass.

The new integration suite runs the actual browser client/controller against
real handlers and PostgreSQL, plus linked MCP reads/writes. It proves immutable
prices and exact large budgets, restrictive zero limits, REST/MCP version
conflicts, foreign member/org rejection, independent price-only/budget-only/chat
roles and revoked already-loaded controls/tool closures. Full provider and usage
rows are compared before/after and remain identical. Existing AI-005 concurrent
budgets/reconciliation and AI-006 guarded dispatch regressions also pass.

Final SQL inspection found zero dubbl_ci_* databases; pg_ctl stopped only the
owned cluster and status reported no server running (expected exit 1). Stopped
temporary data/scripts remain for local diagnosis. No shared service stopped.

## Review and handoff

Codex self-review is in AI-057-review-1.md; no peer/human/native approval is
claimed. Remaining money inventory, real-browser/accessibility/native Persian,
production session/provider/deployment and activation gates are not waived.
Next is AI-058 scoped quota/run operations; AI-059 and AI-011 assembled dashboard
acceptance remain open. No further controller task was started in this turn.
