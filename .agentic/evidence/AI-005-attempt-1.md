# AI-005 metering and budgets - attempt 1

## Identity

2026-10-27, Codex task_005, repository `D:\Projects\a\dubbl`, baseline
`4a9b013a911d9584ccaef3559ca4694d52dfa4a3`, branch `fresh-start`. Clean at claim.
The ignored local AUTH_SECRET configuration was neither read nor modified.
This evidence was written before the task commit; no invented commit ID.

## Implementation

- `lib/db/schema/ai-usage.ts` and generated Drizzle migration
  `0018_bright_layla_miller.sql`/snapshot add immutable price-version records,
  organization/user budget policies and scoped per-provider attempt ledgers.
  Checks cover positive versions/nonnegative amounts/token subsets/states,
  organization/user subjects, run ownership and organization price references.
- `lib/ai/usage.ts` provides exact fixed-point price/budget arithmetic, atomic
  admission/dispatch/settlement/cancellation primitives, and shared scoped
  administration/report services. Every actual retry requires a distinct key;
  duplicate reservation and settlement are idempotent. Price/config/budget
  references are captured per attempt. No cross-currency sum or FX conversion.
- Costs use 10^-12 major billing-currency atoms, separate from accounting cents.
  Price inputs have six decimal places per million tokens, producing exact
  category multiplication by BigInt. Cached input and reasoning output replace
  their base categories. Unknown counts remain null; unknown totals retain the
  reservation/concurrency, partial overages raise the debit, and late details
  reconcile conservative estimates. Costs are always estimates, not invoices.
- Required org and member budgets enforce UTC-month token/currency-specific
  cost limits, rolling rate, concurrency and per-run ceilings under one
  org-scoped PostgreSQL advisory transaction lock. Current live identity and
  policy are rechecked at dispatch. Actor revocation does not discard a trusted
  provider settlement callback. No settlement/count-writing REST/MCP exists.
- `app/api/v1/ai/{prices,budgets,usage}/route.ts` and five registered
  `lib/mcp/tools/ai-usage.ts` tools share these services. Organization usage
  permission is distinct from own history and transcript access. Four
  administration tools have explicit chat-exclusion markers; AI-006 consumes them.
- `lib/ai/providers.ts` now meters the pre-existing connection test before
  transport, including conservative unknown failures. The fixture provider
  regression is explicitly funded with synthetic rates/budgets. No live prices
  or live requests are supplied or claimed.
- `lib/ai/persistence.ts` prevents expiry of otherwise terminal run metadata from
  removing unresolved usage reservations; content erasure still proceeds.
- `AI_USAGE_BUDGETS.md` documents exact units, partial/unknown usage, trust
  boundaries, admission/retry integration and later runtime/retention duties.
  The generated source inventory matches 804 tools/107 modules/568 routes.

## Acceptance mapping

1. Each attempted connection request and future executor reservation is stored
   with org/user/run (null only for administrative test), provider/model and
   price/config references; nullable input/output/cached/reasoning observations
   survive retries and delayed callbacks. The new DB suite checks same-key
   races, distinct retries, duplicate settlement, changed-count rejection,
   null/partial/delayed usage and settlement after membership removal. Existing
   provider test asserts successful and failed request ledger coverage.
2. Immutable prices, explicit billing currency, BigInt arithmetic and currency
   grouped reports are exercised using synthetic fractional prices; a category
   example settles to exactly `0.000172000200` USD, without binary rounding.
   New price versions do not change prior costs, category discount is not
   double-counted, and a run cannot switch billing currency. No invoice/ledger
   posting or real provider pricing qualification is claimed.
3. Org and user quota policies, concurrency/rate/per-run limits, atomic admission
   races, stricter-policy dispatch denial, pre/post dispatch cancellation,
   unknown reservations and observed overages are verified by real PostgreSQL
   transactions. Pending usage remains reserved after run cancellation/expiry.
   Worker scheduling and general execution remain later tasks, not fake features.
4. Real REST and linked in-memory MCP transport share the actual DB services.
   Tests verify owner/member/admin/foreign-org policies, own vs org aggregates,
   live custom-role revocation on an existing server, denied forged report
   scope, optimistic budget conflicts and database constraints. Reports contain
   no prompts, outputs, credentials, internal price/config snapshots or transcript
   payloads, and currencies remain separate.

## Verification

All commands ran from the repository root. A fresh task-owned PostgreSQL18
cluster at loopback port55486 hosted randomized disposable `dubbl_ci_*`
databases created/migrated/dropped by the existing harness; no application DB,
production DB, privileges or configuration were changed.

- `npx drizzle-kit generate`: generated additive migration0018 and snapshot.
- `TEST_DATABASE_URL=<isolated loopback> node --import tsx --test
  tests/integration/ai-usage.test.ts`: passed on first execution, including full
  current migrations and real REST/MCP/SQL behavior.
- Same isolated server, four suites `ai-usage.test.ts`, `ai-providers.test.ts`,
  `ai-persistence.test.ts`, `execution-identity.test.ts`: 4 passed, 0 failed.
- Final provider/metering rerun after partial-usage lower-bound fixes and ledger
  assertions: 2 passed, 0 failed. Both DNS failures retain reservations; two
  successful requests have settled usage, and errors retain unknown counts.
- Focused ESLint on all changed services/schema/MCP/routes/tests: passed. An
  initial unused test import warning was removed; final focused run clean.
- `npm run lint`: exit0, zero errors and 20 pre-existing unrelated warnings.
- `npx tsc --noEmit`: full initial and subsequent incremental checks passed;
  final check covers final test assertions and unchanged-text encoding repair.
- `node scripts/audit-ai-capabilities.mjs --write`, then no-argument source
  check: passed; new module/operations/routes inventoried without enabling chat.
- `git diff --check`, controller validation: passed during implementation and
  again during final acceptance. No full build or dev server was run.
- Final `npx drizzle-kit generate` reports no schema drift. Final incremental
  typecheck completed exit0. The task-owned cluster contained zero `dubbl_ci_*`
  databases and was stopped successfully after all checks.

## Review and limitations

Self-review by Codex task_005 in separate review evidence; no peer/human,
accounting, native-language, hosted-CI or production acceptance asserted.
No live provider request, provider account/model selection, invented price,
deployment, application migration, general generation worker, dashboard/UI,
Stripe work or feature/IRR activation. Rates in tests are plainly synthetic.
General runtime must bind internal attempt IDs/scopes and encoded token ceilings,
persist before dispatch and normalize verified adapter usage. Missing usage is
not free and has no automatic expiry. Retention scheduling/reconciliation for
content-free administrative attempts is later runtime/operations work. The
installed provider remains default-off independently of metering setup.

## Handoff

Use the shared primitives and immutable references in AI-007; ordinary chat
must exclude price/budget mutations in AI-006. AI-010/011 own policy/usage UI;
AI-012/013 retain security/provider/deployment qualification. Stop the task-owned
cluster was stopped after verifying no disposable databases remain. Make a scoped
local task commit. Parent owns the paired push and next fresh-agent selection.
