# RTL-039 bills and purchase shells technical acceptance

Codex (`codex-batch-task06`), client date 2026-10-27, selected live next RTL-039 from clean HEAD 29f22b4c49e8a925f97a0ff1badfa1cf83c5a125, one local RTL-038 commit ahead of origin/master. This is second task of the owner-authorized sequential pair. Read AGENTS, START_HERE, controller/project/map, frontend role, task and exhaustive registry. DEC-005 removes screenshots as prerequisite; DEC-008 preserves frozen Stripe.

## Exhaustive ownership audit

| Registry source | Result and preserved contracts |
|---|---|
| `app/(dashboard)/purchases/page.tsx` | Isolated canonical bill IDs/dates, escaped supplier names, status/due labels, exact totals/balances/aging amounts and parenthesized counts. Logical numeric alignment, search/icon spacing, skeleton margin and aging-bar end radii. Explicit locale-directed tabs/sort; named auto-direction search, sort and date filter groups. Wrapped summary/aging/due-soon/new-bill controls. Preserved request generation/abort/org boundaries, pagination/filter/sort codes, dates, billUiAging and exact arithmetic, row/drawer routes and errors. |
| `app/(dashboard)/purchases/[id]/page.tsx` | Isolated document IDs/dates, supplier/due phrase, caller descriptions/account codes/names/notes/rejection, quantities, full exact money/approximate base/percentage/order-match tokens. Logical table/metadata spacing/alignment, mirrored named back control, wrapped long actions/metadata/totals/match rows; responsive payment summary. Directed scrollable payment/reject dialogs, associated native date/rejection labels and auto-direction reason. Retained original currency-aware amount aria-label. Preserved original receive/approve/reject/pay/void/supplier-credit payloads, payment bounds, confirm/error/refresh/org/context semantics, attachments and financial calculations. |
| `app/(dashboard)/purchases/layout.tsx` | Audited unchanged: existing TabLayout independently handles root direction, wrapped/scrollable navigation and canonical route/detail semantics. Real shell tested across four presentation combinations and list/detail paths. |
| `app/(dashboard)/purchases/loading.tsx` | Audited unchanged: existing BrandLoader exposes translated accessible loading name; actual composition verified in both locales/numeral settings. |

All four assigned sources audited. Shared editors remain RTL-021; BillCurrencyAmounts/DualAmount/RateNote internal qualification belongs to RTL-048. No API/MCP operation, schema/migration, issued/output builder, provider/Stripe or accounting algorithm changed. Existing operations retain MCP parity. Parent RTL-015/010/008/002 acceptance remains independent.

## Acceptance mapping and executed checks

1. Four-source audit above plus retained exact financial and lifecycle regressions establishes bounded source coverage and unchanged caller/REST/MCP/output contracts.
2. `tests/rtl-purchases-bills.test.ts` executes real list/detail components, presentation providers, shared fields/table and installed Tailwind CSS across en-US/fa-IR x latn/arabext. Controlled own state/effects/navigation/dialog portals expose actual callbacks. Long escaped mixed caller text, exact low money digits, full percentage/order-match tokens, raw search/status/sort/row callbacks, canonical payment POST and invalid upper bound, native date/rejection input callbacks, shell route selection/detail hiding and translated loader are exercised. CSS compilation verifies logical spacing/alignment/radii, wrapping, local table/dialog scroll, narrow geometry hooks and arrow mirroring.
3. Ownership and unverified qualification boundaries are explicit here and in attributed technical self-review; no parent gate closed.

Executed from repository root:
- `node --import tsx --test --test-concurrency=1 tests/rtl-purchases-bills.test.ts tests/bill-catalogs.test.ts tests/bill-ui-money.test.ts tests/bill-ui-components.test.ts tests/bill-lifecycle-wire.test.ts tests/bill-read-wire.test.ts tests/bill-write-wire.test.ts tests/bill-bulk-wire.test.ts`: 31/31 passed, zero failures/skips/cancellations. Includes exact aliases/ranges/currency scale, partial/reverse-charge tax, rejection/recognition/settlement guards, foreign reference rejection, base display, supplier-credit dimensions, lifecycle HTTP/network outcomes and saved-read stale/error boundaries.
- Final account/count isolation follow-up: `node --import tsx --test tests/rtl-purchases-bills.test.ts`: 3/3 passed.
- Final `npx tsc --noEmit`: passed. `npm run lint`: passed, zero errors/21 existing warnings.
- `pnpm i18n:check`: 10723 paired keys. `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine checks passed.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 schema columns, 1899 consumers, 2520 scanned files. Explicit UTF-8 structured comparison confirms schema columns unchanged, changed consumers exactly two owned pages, only added scanned consumer the new test.
- Controller/whitespace checks executed at closeout; pair scope and remote SHA checked before/after authorized push.

Initial scripted wrapping accidentally included template/style syntax, corrected before final passing checks. A retained catalog test caught an unnecessary amount aria-label override; original currency-aware label was restored. An initial structured comparison decoded git output with the host default encoding; explicit UTF-8 confirmed schema equality. No failed check concealed or financial logic weakened.

## Qualification limits and handoff

Bounded source/component/CSS acceptance only. Browser geometry, actual keyboard/caret/focus/AT/zoom, native Persian language/accounting/legal review, real DB/REST/MCP/output/provider execution, production IRR/deployment and replacement hosted CI remain unverified. No build/dev server/application database write performed. Complete controller and commit this task, push paired RTL-038/039 once, verify remote equality/clean tree, hand next live task to supervisor.
