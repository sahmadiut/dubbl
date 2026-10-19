# LOC-054 attempt 1 - Purchase order catalogs

2026-10-19 (Asia/Tehran), Codex. Live controller selected this bounded purchasing
child from clean master at `c06a163ef242451d8434c2aadb39716c9a676d60`.
LOC-026/007/002 retain independent integration acceptance.

## Implementation and acceptance mapping

1. Extracted owned authored copy across the purchase order list/detail, creation
   and edit drawers, receiving/conversion/delete confirmations and feedback.
   Added 118 paired PurchaseOrders messages and a typed own-property status
   mapping. Catalogs validate at 5,714 keys per locale. All new Persian leaves
   contain Persian script. See [scope/exceptions](../registries/PURCHASE_ORDER_CATALOGS.md).
2. Production rendering and original-callback tests cover bilingual fields,
   lifecycle states, exact displayed amounts, accessible line names, add/edit/
   remove, hydration/reset defaults, query codes, HTTP/network/JSON/shape/alias/
   parser failures, cancellation, saved identity checks and retained failed forms.
   Existing migrated PostgreSQL suites separately cover REST/registered MCP/SQL.
   See executed verification below and the scope registry for harness limits.
3. Independent parent/native/RTL handoff is recorded here, in the scope registry
   and task Handoff. Honest self-review is recorded separately.

Read failures now use finite keys translated while rendering. Operation-specific
fallbacks replace raw server/parser/HTTP/network/JSON prose. Pagination retains
loaded rows on failure and respects stale generation guards. Creation/edit check
saved identity before close/navigation. Lifecycle callbacks validate bill/receipt
identity or delete success, retain canonical requests, restore busy state and
handle cancellation/already-received paths without mutation.

Exact prices, currency scales, safe numeric compatibility, saved quantity
hundredths, USD defaults, creation tax calculation and PATCH no-tax/no-discount
policy remain unchanged. Receiving still sends exact outstanding quantities to
goods-receipts with the current UTC date. All organization headers, routes,
methods, codes, IDs, nullable fields and canonical dates remain unchanged.
Shared components retain existing catalogs and separate acceptance. No financial
helper/service, REST/MCP, schema, migration, FX, worker, IRR flag or Stripe code
changed. Existing org-scoped direct-DB MCP tools cover all existing operations.

## Executed verification

All commands ran from D:/Projects/dubbl with installed dependencies.

| Gate | Actual result |
|---|---|
| Focused `node --import tsx --test tests/purchase-order-catalogs.test.ts` | 9/9 passed, no skips |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 939/939 passed; no skips, including all nine owned checks |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,714 compatible keys per locale |
| Changed-file ESLint over owned routes, create-drawer, helper and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 69 existing warnings |
| Disposable migrated PostgreSQL suites below | 3/3 passed, no skips |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned source/consumer metadata |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns, 1,695 consumer hashes |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| JSON/source comparison against HEAD | Existing catalog namespaces and all 417 financial column policies unchanged; consumer differences limited to owned routes/drawer/catalogs/test; shared create-drawer differences confined to PurchaseOrderDrawer |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Integration command with explicit loopback TEST_DATABASE_URL:

```text
node --import tsx --test --test-concurrency=1 tests/integration/purchase-orders.test.ts tests/integration/goods-receipts.test.ts tests/integration/procurement-ui-money.test.ts
```

A newly initialized temporary PostgreSQL 18 trust-auth cluster ran on
127.0.0.1:55454. Fixtures created, migrated and dropped randomized databases.
All actual REST/registered MCP/SQL workers passed; the server stopped cleanly.
No application database or .env credentials were used.

During test authoring, placeholder account IDs failed the existing UUID schema
before requests/preview. Fixtures now use a valid UUID; production validation and
financial assertions remain intact. The source inventory caught a remaining
add-line CTA, which was extracted before final verification.

## Review and handoff limits

See [self-review](LOC-054-review-1.md). Controlled rendering/callback checks do not
qualify mounted-browser, fonts or complete RTL layout. Persian financial wording
is provisional. LOC-026/007/002, LOC-056/058, native/RTL acceptance, hosted CI,
deployment and production IRR qualification remain independent. No full build,
dev server, provider request or deployment ran. Stripe remains preserved under
DEC-008; routine full-suite provider tests are not dedicated provider work.

Complete the evidence/review/done disposition and authorized scoped commit/push,
verify origin/master SHA and clean tree, report the live next task, and stop.
