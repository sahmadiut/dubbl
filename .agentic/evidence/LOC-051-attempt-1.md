# LOC-051 attempt 1 - Expense catalogs

2026-10-19 (Asia/Tehran), Codex/coding-assistant. Selected by current controller
next with a clean master working tree. This is one bounded child of LOC-026;
LOC-026/007/002 retain separate combined acceptance.

## Implementation and ownership

Extracted the expense list/detail/recurring routes, receipt viewer, embedded edit
and recurring creation drawers, and only ExpenseDrawer in the shared creation
module. Added 196 paired Expenses messages, typed finite display/error mappings,
translated amount labels, mileage/tax/currency guidance, confirmation/dialog/
action feedback and safe HTTP/network/JSON fallbacks. Existing catalog namespaces
and unrelated creation drawers remain unchanged.

The [scope/exception inventory](../registries/EXPENSE_CATALOGS.md) records every
owned source, caller/technical exceptions, existing MCP coverage and financial
contracts. Existing exact expense currency scales and mileage extension,
tax-inclusive amounts, metadata identity, bigint summaries, fixed-two recurring
input and gross-only generation remain unchanged. No REST/MCP/service/schema/
migration/FX/IRR flag or Stripe file was modified. Financial inventory changes
are mechanical owned-path scan/hash/occurrence updates; all 417 column policies
and classifications remain unchanged.

Creation/edit requests keep original exact payloads and org headers. All seven
expense actions retain route/method/body and success refresh/navigation choices;
failures now display translated per-operation messages. Invalid new expense or
recurring success identities keep forms open. List envelopes and receipt responses
are checked before adoption; currency/tax reads ignore aborted work, and recurring
initial reads now cancel stale work and report failures. Unknown server prose never
enters the reviewed local-validation map. Existing preferences, caller data,
dates, codes, IDs and money representations remain canonical.

## Executed verification

All commands ran from D:/Projects/dubbl with installed dependencies. Final results:

| Gate | Result |
|---|---|
| `node --import tsx --test tests/expense-catalogs.test.ts` | 10/10 passed |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 910/910 passed; no skips |
| Explicit loopback TEST_DATABASE_URL plus three migrated suites below | 3/3 passed |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,403 compatible keys in each locale |
| Changed-file ESLint for four TSX files, helper and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 69 existing warnings |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned-path metadata |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns and 1,692 consumer hashes/occurrences |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 checks passed |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Integration command:

```text
node --import tsx --test --test-concurrency=1 tests/integration/expense-ui-money.test.ts tests/integration/expense-lifecycle.test.ts tests/integration/expense-crud.test.ts
```

PostgreSQL 18 ran on loopback port 55451 in a newly initialized temporary
trust-auth cluster. Explicit TEST_DATABASE_URL selected this test server; fixtures
created, migrated and dropped randomized databases. The test server shut down
cleanly. No application database, .env credentials, external provider, full build,
dev server or deployment was used. General unit coverage includes existing Stripe
tests; there was no dedicated Stripe work.

Production component/callback checks use real next-intl/PresentationProvider,
tables, date/currency/amount inputs, Radix selectors and money helpers, with
controlled hooks/router and sheet/dialog/picker/uploader boundaries. They cover
both locales, workflow statuses, escaped caller content, exact currency/mileage
previews and payloads, mixed-currency fallback, all seven lifecycle HTTP operations,
failed-form retention, read/settings cancellation, invalid envelopes/aliases,
receipt status/JSON/network failures, recurring fixed-two/schedule behavior,
canonical frequency values/callbacks, JSX copy inventory and Persian script.

Initial checks caught CJS/ESM provider identity in the new renderer; statically
imported real DatePicker and DataTable fixed context identity. The AST audit caught
unextracted From/To and optional description copy. Typecheck caught a missing org
binding and stale duplicate back-label key; ESLint caught the test harness module
variable name. These were corrected; final focused/full/static checks pass. No
financial assertion or runtime validation was relaxed.

## Review and independent handoff

See [honest self-review](LOC-051-review-1.md). These controlled checks do not claim
mounted browser interaction, layout approval or native Persian financial wording.
Persian remains provisional. LOC-026/007/002, native terminology, complete
RTL/font/layout, hosted CI, deployment and production IRR qualification retain
independent acceptance. ContactPicker internals remain LOC-058, shared purchasing
navigation/forms remain LOC-056, and Stripe stays unchanged under DEC-008.

Finish controller acceptance/submit/self-review/done and the authorized scoped
commit/push; verify origin/master SHA and clean tree, report the live next task
and stop.
