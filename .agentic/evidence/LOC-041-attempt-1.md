# LOC-041 attempt 1: sales quote catalogs

Date: 2026-10-18. Implementer: coding-assistant (Codex). Scope: one bounded
LOC-025 child, LOC-041 only. Controller selected LOC-041 on clean `master`, with
292 structurally valid tasks. LOC-025/007/002 retain independent acceptance.

## Implementation and contracts

Added 73 paired SalesQuotes messages for quote list/detail, QuoteDrawer and
QuoteMoneyDetails; 4,458 compatible keys per locale. Added a typed finite status
display helper with own-property checks. See the complete
[source/exception inventory](../registries/SALES_QUOTE_CATALOGS.md).

Extracted authored JSX, display attributes, table/status labels, guidance,
creation validation and read/action/create/conversion outcomes. Caller data
remains escaped, unknown codes remain data, and status/filter/action values stay
canonical. Creation no longer shows raw service/parser prose. Action/conversion
network failures are caught and translated; stale context outcomes are suppressed.
Malformed creation/conversion IDs cannot cause success/navigation.

No monetary logic, REST/MCP service, route, schema/migration, stored unit, FX or
IRR-flag change. USD quote default, price-first rounding, exact decimal prices,
line quantity hundredths, canonical dates/expiryDate, nullable reference/notes,
currency-grouped totals, remaining-balance conversion, headers and request bodies
remain intact. Existing registered quote MCP operations cover the same workflows.
Shared forms/navigation/document delivery remain separately owned by LOC-047 and
other catalog tasks. Other creation drawers and all previous namespaces, including
Stripe, were compared to HEAD and are unchanged under DEC-008.

## Actual verification

All commands ran at D:/Projects/dubbl. No build, dev server, deployment, live
email/provider or application database access was used. Integration ran against
a fresh PostgreSQL 18 cluster in a randomized temporary directory, bound only to
127.0.0.1 on an allocated free port with explicit TEST_DATABASE_URL. Existing
fixtures migrated and dropped random dubbl_ci_* databases. Cleanup SQL found
zero remaining fixture databases; pg_ctl stopped the isolated cluster in finally.
This is not PostgreSQL 16 or production migration qualification.

| Check | Actual result |
|---|---|
| Focused quote catalog/UI-money/wire tests | Exit 0; 14/14 passed, no skips; 7.010 seconds |
| Full unit/static suite, concurrency 4 | Exit 0; 824/824 passed, no skips; 73.204 seconds |
| Quote and quote UI-money REST/MCP/SQL | Exit 0; 2/2 groups passed, no skips; 16.957 seconds |
| pnpm typecheck | Exit 0 |
| pnpm i18n:check | Exit 0; 4,458 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero warnings/errors |
| pnpm lint | Exit 0; zero errors, 69 existing warnings in unrelated sources |
| Money inventory generation/verification | Exit 0; 417 columns, 2,238 scanned files, 1,679 consumer hashes; occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks passed |
| Catalog/ownership audit | Exit 0; prior namespaces/other drawers unchanged, 73 paired keys; Persian-script and owned JSX/attributes checked by tests |
| Controller validation | Exit 0; valid 292-task graph |
| Fetch/divergence before commit | Exit 0; HEAD vs origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/quote-catalogs.test.ts tests/quote-ui-money.test.ts tests/quote-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/quotes.test.ts tests/integration/quote-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two quote pages> components/dashboard/quote-money-details.tsx components/dashboard/create-drawer.tsx i18n/quote-presentation.ts tests/quote-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

The initial focused run found two harness expectations: list header adapters do
not convert nested line data, and the JSX audit counted a middot entity as text.
Corrected the expectations and documented punctuation/sample-ID exceptions; the
final focused/full runs pass. Inventory changes are mechanical path/hash/line
refreshes only, without classification or monetary policy changes. Broad existing
provider tests are ordinary regression coverage, not dedicated Stripe work.

## Handoff and limits

See [self-review](LOC-041-review-1.md). Tests use real rendering and original
callback syntax with controlled state/navigation/portal boundaries, not a mounted
browser. Persian financial wording remains provisional; native/RTL/browser,
date/numeral adapters, live delivery/provider, hosted-CI, deployment and production
IRR qualification remain open. Parent/sibling tasks remain open independently.

Complete controller disposition, commit the task-owned sources/catalogs/tests,
scope/evidence/controller and mechanical inventory refresh, push origin/master,
verify remote SHA and clean tree, report the live next task and stop.
