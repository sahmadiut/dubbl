# RTL-041 purchase debit notes technical acceptance

Codex (`codex-batch-task08`), client date 2026-10-27. Selected live next RTL-041 from clean `7259f537`, one local RTL-040 commit ahead of origin. Second task of owner-authorized sequential pair; scoped task commit followed by one pair push. Read AGENTS, START_HERE, project/map, frontend role, task and ownership registry; DEC-005 removes screenshot prerequisites and DEC-008 freezes Stripe.

## Exhaustive ownership audit

| Registry source | Repairs and preserved behavior |
|---|---|
| `app/(dashboard)/purchases/debit-notes/page.tsx` | Isolated document identifiers, canonical dates, supplier caller/status and complete exact total/remaining/count/sample-money tokens. Logical numeric alignment, icon/search spacing and use-case borders. Locale-directed tabs and sort, named auto-direction search and date filter groups, locally scrolling tabs and wrapping actions/sample rows. Preserved exact currency overview grouping, loaded org/filter contexts, cancellation, pagination/stale-read guards, search, raw sort/status values and row/create callbacks. |
| `app/(dashboard)/purchases/debit-notes/[id]/page.tsx` | Shared qualified PageHeader already isolates original string title/supplier description and wraps action area; retained its API. Isolated status, issued/reference/remaining-credit phrases, bill-option text and whitespace-preserved notes. Logical icon spacing and mirrored back arrow. Directed height-bounded scrolling application dialog and bill selector, associated/named bill trigger, existing amount input's translated accessible label retained, wrapping action text. Preserved supplier/currency/status/balance bill eligibility, exact amount parser/application payload, canonical IDs, org scope, reload/unmount and failure guards, void confirmation, send document props/URL and email history. |

All two assigned sources independently audited. Shared overview/money-detail widgets remain separately owned RTL-048; shared editors and send/confirmation internals remain their own qualified boundaries. No money calculation, API/MCP operation, schema/migration, provider/Stripe, issued/output builder or caller value change. No new operation means existing MCP parity stays intact. RTL-015/010/008/002 retain independent acceptance.

## Behavior and verification

`tests/rtl-purchases-debit-notes.test.ts` executes actual production list/detail functions with real presentation providers, next-intl, bidi primitives, data table, money adapters, amount input and installed Tailwind CSS. Own state/effect scheduling, navigation, portal rendering and out-of-scope send/history/confirmation boundaries are controlled. Cases run en-US/fa-IR x latn/arabext with long escaped mixed caller strings, identifiers/dates, exact low digits, signed empty samples, raw status/search/sort/row/create/selection/amount callbacks, retained dispatch props, actual application POST with `{billId, amountMinor: "1"}`, invalid-over-balance rejection and directed named controls. CSS compilation verifies logical start/end positioning/margins/borders/alignment, wrapping, local scrolling, bounded height and mirrored arrow rules. This is source/component/CSS evidence, not browser geometry or native qualification.

Executed from repository root:

- Retained debit catalog/UI-money/wire suite: 19/19 passed.
- New actual-page/provider/callback/CSS suite: 3/3 passed.
- Final combined command: `node --import tsx --test --test-concurrency=1 tests/debit-note-catalogs.test.ts tests/debit-note-ui-money.test.ts tests/debit-note-wire.test.ts tests/sales-catalog-integration.test.ts tests/rtl-purchases-debit-notes.test.ts`: 27/27 passed, zero failures/skips/cancellations. Retained tests include read HTTP/JSON/alias/shape failures, abort/stale contexts, bill eligibility, apply/unmount failures, void callbacks, canonical transport aliases, exact overflow/tax/discount/currency-scale policy, drawers and sales shell integration.
- Final `npx tsc --noEmit`: passed. `npm run lint`: passed with zero errors/21 existing warnings.
- `pnpm i18n:check`: 10,723 paired keys. `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine checks passed.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns/1,901 consumers verified. Structured UTF-8 comparison with HEAD confirms schema unchanged; changed consumer entries are exactly two owned pages plus new guard, no removals.
- Controller validation and whitespace checks at closeout; scoped pair log/stat/status inspected before push and remote SHA verified afterward.

Initial typecheck identified attempted ReactNode use on PageHeader's string API and an unsupported amount-input id; corrected by retaining existing header isolation/string API and existing named amount input. No shared API widened. An initial retained command named a nonexistent sales integration glob, so the final command explicitly included the existing `sales-catalog-integration.test.ts` and passed27. No production financial guard weakened.

## Limits and handoff

Browser geometry/keyboard/caret/focus/AT/zoom, native Persian linguistic/accounting/legal review, real DB/REST/MCP/output/provider execution, production IRR/deployment and hosted CI remain unverified. No full build, dev server or application DB write performed. Technical self-review is honestly Codex, not independent/human review. Commit RTL-041 separately and push the authorized RTL-040/041 pair; then fresh-agent handoff to live next task.
