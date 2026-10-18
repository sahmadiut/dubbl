# LOC-039 attempt 1 - sales payment catalog extraction

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 1953c8be2e7c36a4ab80b08dffd49f37f8e149b0. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next selected LOC-025. Inspection found 18 sales route TSX files
(7,728 lines) plus shared forms and seven creation drawers. Split LOC-025 into
LOC-039..047 and started only LOC-039, the bounded customer payment read slice.
LOC-025/007/002 retain independent integration acceptance. No subagents used.

Read root/.agentic instructions, START_HERE, PROJECT/REPOSITORY_MAP, controller,
frontend guidance, source localization sections, message contract, LOC-006
dependency evidence, current page/money/REST/MCP source and payment fixtures.
Applied the memory controller-task skill. DEC-008 preserves Stripe unchanged.
No full build, development server or application database access occurred.

## Implementation and acceptance mapping

1. Added 60 paired SalesPayments messages, bringing each locale to 2,844 keys.
   The [scope inventory](../registries/SALES_PAYMENT_CATALOGS.md) covers all
   authored list/detail copy and explicit data, punctuation, date/money, shared
   navigation and invoice-recording/supplier-preview exceptions. New finite
   typed method/document label maps preserve canonical codes and unknown values.
   Existing list/detail English bank-transfer capitalization is retained.
2. Rendered both production pages with real React/next-intl/PresentationProvider,
   table, date picker, fields, headers and exact-money helpers. Controlled state,
   navigation, network and inline Select portals allow inspection of empty,
   loading, error, populated/filter/missing/unlinked states in both locales.
   Production callback syntax verifies org-scoped read-only requests, canonical
   method/date filtering, exact currency-first amount sorting, invoice lookup,
   malformed aliases/allocations/envelopes, network/HTTP/JSON failures and aborts.
   Exact amounts above 32-bit and sums beyond safe Number, signed noncash
   allocations, multi-currency groups, plurals and escaped caller content pass.
   Money helpers, services, REST/MCP and schema remain unchanged. Malformed list
   envelopes fail visibly and successful reads clear stale errors.
3. Scope and handoff retain provisional Persian, independent parent/native/RTL
   acceptance and unchanged Stripe. LOC-040..047 own remaining sales extraction;
   supplier-only PaymentAmountPreview remains LOC-033. No new user operation was
   added; existing list_payments/get_payment cover these reads. Existing invoice
   label link destinations are preserved without claiming route correction.

## Actual verification

All commands ran in D:/Projects/dubbl. The two integration checks used explicit
TEST_DATABASE_URL on a newly initialized PostgreSQL 18 cluster bound to
127.0.0.1 at a temporary free port. Fixtures created/migrated/dropped randomized
disposable databases; the cluster was stopped in finally. No application DB
was read, migrated or mutated. No credentials were printed or persisted.

| Check | Actual result |
|---|---|
| Controller validation, split and start | Exit 0; valid 274-task graph |
| Focused catalog/payment-money/payment-read suite | Exit 0; 13/13 passed, no failures/skips; 4.885 seconds |
| Full unit suite, concurrency 4 | Exit 0; 707/707 passed, no failures/skips; 51.171 seconds |
| Payment reads + payment UI REST/MCP/SQL integration | Exit 0; 2/2 passed, no failures/skips; 26.835 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx + tsc --noEmit |
| pnpm i18n:check | Exit 0; 2,844 compatible keys per locale |
| Changed-file ESLint | Exit 0; no errors/warnings |
| pnpm lint | Exit 0; zero errors, 75 existing warnings |
| Money inventory generation/verification | Exit 0; 417 columns, 2,212 scanned files, 1,656 consumer hashes and all occurrence lines verified |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog ownership audit | Exit 0; no authored JSX text or literal display attributes remain in owned pages; every new Persian message has Persian script; all pre-existing namespaces are unchanged |
| Fetch/divergence before commit | Exit 0; HEAD and origin/master were 0 ahead/0 behind |
| git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test tests/sales-payment-catalogs.test.ts tests/payment-ui-money.test.ts tests/payment-read-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payment-reads.test.ts tests/integration/payment-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two payment pages> i18n/sales-payment-presentation.ts tests/sales-payment-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

An inline TypeScript AST audit checked owned JSX text/display attributes, and
compared every old namespace with git HEAD for both catalogs. Its Persian-script
and 60-key checks passed. General tests include unchanged existing Stripe tests;
no dedicated Stripe work was performed.

Intermediate focused failures exposed mixed CommonJS/ESM next-intl contexts in
the test harness, then two missed list strings (document title and clear action).
The harness now imports shared translated components through the same ESM
context; both strings were extracted. Changed-file lint also caught a test-only
this-alias, which was removed. Final focused/full/static gates passed after these
repairs. No failed intermediate check is represented as passing.

## Review and handoff

See [honest self-review](LOC-039-review-1.md). Rendering/callback checks are not
mounted browser interactions. Native Persian terminology, complete RTL/font/
layout, hosted CI, deployment and production IRR qualification remain independent.
No provider calls, full builds, development servers or schema changes occurred.

Complete controller checks/submit/self-review/done, commit task-owned files,
push origin/master, verify remote SHA and clean tree, report the live next task
and stop. LOC-025 remains queued for combined acceptance after all children.
