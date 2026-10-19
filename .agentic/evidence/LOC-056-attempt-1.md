# LOC-056 attempt 1 - Shared purchasing catalogs

2026-10-19 (Asia/Tehran), Codex. The live controller selected this bounded child
from clean master at `a1c0386f` (LOC-055). No unrelated changes existed at entry.
LOC-026/007/002 retain independent combined integration acceptance.

## Implementation and acceptance mapping

1. Extracted all eight purchasing navigation labels and four explanatory titles
   into 12 paired PurchasingNavigation messages. Original English text, routes,
   order, icons and exact matching are preserved. Purchasing loading already
   uses the cataloged BrandLoader; no duplicate messages or implementation were
   added. [Scope registry](../registries/SHARED_PURCHASING_CATALOGS.md) reconciles
   shared forms, drawers, money details, previews and errors with LOC-047,
   LOC-048..055 and LOC-033, and explicitly records adjacent ownership.
2. Real bilingual production rendering checks routes/order/icons/tooltips,
   every active list tab, detail-page tab suppression, escaped children and the
   existing loading label. Existing shared document/payment and purchasing-child
   suites verify reused forms, errors, previews, callbacks and exact amounts.
   Executed checks are recorded below.
3. Registry and task Handoff preserve provisional Persian wording and independent
   parent, native financial-language and RTL qualification. Honest self-review
   is recorded separately.

The sole runtime source change is purchases/layout.tsx. Shared form implementations,
financial calculators, exact units, saved money, FX, dates, schemas/migrations,
REST/MCP tools/services, authorization, IRR flags and Stripe remain unchanged.
Existing org-scoped purchasing tools already cover the navigation destinations;
no new operation or REST change requires an MCP addition.

## Executed verification

All checks ran from D:/Projects/dubbl with installed dependencies.

| Gate | Actual result |
|---|---|
| Focused purchasing/shared suites (command below) | 84/84 passed; zero failures/skips |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 950/950 passed; zero failures/skips |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,788 compatible keys per locale |
| Changed-file ESLint on purchases/layout.tsx and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 68 warnings confined to unchanged files |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned consumer/source metadata |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns, 1,698 consumer hashes |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| JSON/source comparison with HEAD | All existing namespaces, 417 column policies and unrelated consumers unchanged; exactly 12 paired keys; all original English strings preserved |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Focused command:

```text
node --import tsx --test tests/shared-purchasing-catalogs.test.ts tests/shared-document-catalogs.test.ts tests/bank-payment-catalogs.test.ts tests/goods-receipt-catalogs.test.ts tests/bill-catalogs.test.ts tests/recurring-bill-catalogs.test.ts tests/expense-catalogs.test.ts tests/debit-note-catalogs.test.ts tests/requisition-catalogs.test.ts tests/purchase-order-catalogs.test.ts tests/landed-cost-catalogs.test.ts
```

The first focused run exposed an incorrect test assumption that BrandLoader has
a status role. The assertion was corrected to check its actual unchanged
localized aria-label and loader markup. The first Persian catalog write lost
Unicode through the Windows shell pipeline; a Persian-script assertion detected
it immediately. Rewriting with ASCII Unicode escapes and explicit UTF-8 output
restored the intended text; final script and catalog validation passed.

## Review and handoff limits

See [self-review](LOC-056-review-1.md). These are production static rendering and
controlled callback checks; mounted-browser, font/layout and native Persian
approval are unverified. Complete RTL, parent integration, hosted CI, deployment
and production IRR qualification remain independent. Shared sending/history and
picker/uploader internals retain the adjacent ownership in the registry.

No database tests were rerun for this label-only runtime change; this task makes
no new REST/MCP/SQL claim. Earlier purchasing child evidence retains its own
disposable PostgreSQL results. No application database, full build, dev server,
provider request, deployment or dedicated Stripe work was performed.

Complete controller review/done and the authorized scoped commit/push, verify
origin/master SHA and a clean tree, report the live next task and stop.
