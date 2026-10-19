# LOC-053 attempt 1 - Purchase requisition catalogs

2026-10-19 (Asia/Tehran), coding-assistant/Codex. Live controller selected this
bounded purchasing child from clean master at
`4b0e0b4c3894ca8769a1a0c5b0c89153e74d1b90`. LOC-026/007/002 retain independent
integration acceptance; this evidence does not complete those parents.

## Implementation and acceptance mapping

1. Extracted all owned authored copy across the requisition list/detail routes,
   creation/rejection forms and line editor. Added 88 paired Requisitions messages
   and a typed finite status helper. Catalogs validate at 5,596 keys per locale.
   See [scope and explicit exceptions](../registries/REQUISITION_CATALOGS.md).
   All new Persian leaves contain Persian script; financial wording is provisional.
2. Production rendering and callback tests cover bilingual empty/list/detail/form
   states, exact displayed values, accessible line names, add/edit/remove behavior,
   status mapping, escaped data, request contracts and safe failure handling.
   Existing migrated PostgreSQL tests cover actual REST, registered MCP and SQL.
   See executed verification below and the test-boundary limits in the registry.
3. Independent parent/native/RTL handoff is recorded here, in the scope registry
   and task Handoff. Self-review is recorded separately and identified honestly.

Read errors now store finite keys and translate during rendering without adding
translation-dependent fetches. HTTP/network/JSON/parser/server prose is replaced
with reviewed operation-specific fallbacks. List/pagination envelope and exact
alias failures reject before row adoption. Failed pagination retains rows and
shows inline feedback. Creation checks saved identity before success/reset/close;
submit/approve/reject check returned status and conversion checks saved order ID.
Failed forms retain their fields, and existing busy flags guard reentry.

Organization headers, URLs, methods, query/status/sort values, nullable fields,
date-only values and exact line payloads remain unchanged. USD defaults, optional
supplier, no-tax requisition policy, currency-specific scales, canonical Minor
strings, saved quantity hundredths, exact decimal prices, extended-price rounding
and safe numeric compatibility remain intact. Shared ProcurementMoneyDetails and
all financial helpers remain unchanged. Existing MCP tools cover the operations;
no service, REST/MCP, schema, migration, FX/worker/IRR flag or Stripe code changed.

## Executed verification

All commands ran from D:/Projects/dubbl with installed dependencies.

| Gate | Actual result |
|---|---|
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 930/930 passed; no skips, including all nine new requisition catalog/rendering/behavior checks |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,596 compatible keys per locale |
| Changed-file ESLint over three owned TSX sources, helper and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 69 existing warnings |
| Disposable migrated PostgreSQL suites below | 2/2 passed, no skips |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned consumer/source metadata |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns, 1,694 consumer hashes |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| JSON comparison against HEAD | All pre-existing catalog namespaces and 417 financial column policies unchanged; inventory consumer changes limited to owned sources/catalogs/test |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Integration command, with explicit loopback TEST_DATABASE_URL:

```text
node --import tsx --test --test-concurrency=1 tests/integration/purchase-requisitions.test.ts tests/integration/procurement-ui-money.test.ts
```

A newly initialized temporary PostgreSQL 18 trust-auth cluster ran on
127.0.0.1:55453. Fixtures created, migrated and dropped randomized databases;
both actual REST/registered MCP/SQL workers passed. The server stopped cleanly.
No application DB or .env credentials were used.
The full unit suite includes existing provider tests; no dedicated Stripe work
was performed.

The focused test harness initially loaded two child components via CommonJS,
creating a second next-intl context. It now injects the same real imported editor
and shared details components as the provider. A selected date renders its value,
so placeholder assertions now use the empty-date state. The source inventory also
caught the remaining create CTA during authoring. These fixes do not weaken
financial assertions or production validation.

## Review and handoff limits

See [self-review](LOC-053-review-1.md). Rendering/callback tests use controlled
state, navigation and portal boundaries and do not qualify mounted browser,
fonts or complete RTL layout. Persian financial terminology remains provisional.
LOC-026/007/002, LOC-056/058, native/RTL acceptance, hosted CI, deployment and
production IRR qualification remain independent. No full build, dev server,
provider request or deployment ran. Stripe is preserved under DEC-008.

Complete controller disposition and the authorized scoped commit/push, verify
origin/master SHA and clean tree, report the live next task and stop.
