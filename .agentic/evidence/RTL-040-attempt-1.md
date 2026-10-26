# RTL-040 expenses and recurring purchasing technical acceptance

Codex (`codex-batch-task07`), client date 2026-10-27. Selected live next RTL-040 from clean `0b9b8a20`, after the RTL-038/039 pair was pushed. First task of the owner-authorized sequential pair: local scoped commit only. Read AGENTS, START_HERE, project/controller/map, frontend role, task/registry and RTL-006/007 foundation evidence. DEC-005 removes screenshot prerequisites; DEC-008 freezes Stripe.

## Exhaustive ownership audit

| Registry source | Repairs and preserved behavior |
|---|---|
| `app/(dashboard)/purchases/expenses/page.tsx` | Isolated exact total/summary/caller/status/date/count tokens, including complete parenthesized status counts and empty-pipeline step numbers. Logical amount alignment, icon/search/skeleton spacing and pipeline separators. Locale-directed tabs/sort, named auto-direction search and date filter groups, wrapping actions. Preserved count currency buckets, exact summaries, org/filter/sort/pagination/error/cancellation semantics, row navigation and create callback. Symmetric full-width decorative `left-0 right-0` remains appropriate. |
| `app/(dashboard)/purchases/expenses/[id]/page.tsx` | Isolated escaped caller titles/descriptions/reasons/category/file names, account code/name, item dates, timeline/mileage/currency phrases and complete exact money/count tokens. Logical spacing/alignment, mirrored back arrow, wrapping header/actions/summaries, responsive summary grid, local item-table and dialog scroll. Receipt dialog and local edit drawer explicitly directed. Associated title/description/item-date/item-description/category/rejection/payment-date labels; native date LTR and caller fields auto-direction. Preserved item identity/receipt metadata, exact edit preview, reimbursement/rejection/approval/recall/reversal/delete callbacks, receipt URL encoding/download and original amount labels. Local editor belongs to this owned source; shared editors remain unchanged. |
| `app/(dashboard)/purchases/expenses/recurring/page.tsx` | Isolated caller template/supplier, frequency/status/next date and complete preview phrase. Logical icon spacing, wrapping header, minimum-width locally scrolling table; directed height-bounded sheet and named directed frequency selector; associated name/native dates/occurrence-limit labels and named auto-direction line description. Responsive date/line grids and shrinkable line area. Preserved fixed-two recurrence inputs, preview/error logic, supplier/account IDs, validation, raw schedule/create payload, retry/reset/read cancellation and org scope. |
| `app/(dashboard)/purchases/bills/recurring/page.tsx` | Isolated template/supplier/date/frequency/status/currency/full exact gross money tokens. Logical numeric alignment, wrapping header/actions and locally scrolling minimum-width table; directed height-bounded sheet, named directed frequency selector and associated name/reference/date/limit fields. Preserved canonical source reference and exact saved gross arithmetic, editor validity gates, raw exact price/schedule/create payload, error/reset/cancellation/org scope. |

All four owned sources audited. No schema/migration, money calculation, REST/MCP operation, issued/output builder or provider/Stripe change. Existing MCP parity is retained; presentation repairs introduce no new operation. Shared picker/editor internals remain RTL-021 and separately owned money widgets RTL-048; RTL-015/010/008/002 retain independent acceptance.

## Acceptance mapping and checks

1. Exhaustive source census above and retained lifecycle/wire/exact-money suites cover the four-source scope and preservation of financial/output contracts.
2. `tests/rtl-purchases-expense-recurring.test.ts` executes actual owned production components with real presentation providers, next-intl, bidi primitives, field/table/select/money components and installed Tailwind CSS. Only own state/effect scheduling, navigation, portal rendering and external contact/file-picker boundaries are controlled. Cases run en-US/fa-IR x latn/arabext with long escaped mixed caller strings, exact low digits, isolated account/date/complete counts/gross amounts, raw search/sort/status/row and editor callbacks, unchanged reimbursement/rejection POST bodies, canonical recurring bill/expense POST inputs, schedule fields and directed portal props. Installed CSS asserts logical positioning/spacing/alignment/separators, arbitrary wrapping, responsive grids, local scroll, height bounds and mirrored arrows. Retained suites cover malformed/negative/overflow money, mileage, cancellation/network/server failures, receipt URL response guards, exact edit metadata and fixed-two recurrence behavior.
3. Evidence/self-review records ownership and unperformed qualification honestly; no independent parent closed.

Executed from repository root:

- Retained expense/recurring suite: `node --import tsx --test --test-concurrency=1 tests/expense-catalogs.test.ts tests/expense-ui-money.test.ts tests/expense-wire.test.ts tests/expense-lifecycle.test.ts tests/recurring-bill-catalogs.test.ts tests/recurring-bill-ui-money.test.ts tests/recurring-payable-wire.test.ts`: 33/33 passed.
- New actual-page/provider/callback/CSS guard: `node --import tsx --test tests/rtl-purchases-expense-recurring.test.ts`: 4/4 passed.
- Final combined command adds that new guard to the retained command: 37/37 passed, zero failures/skips/cancellations.
- Final `npx tsc --noEmit` and `npm run lint`: passed; lint zero errors/21 existing warnings.
- `pnpm i18n:check`: 10,723 paired keys. `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine checks passed.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 unchanged schema columns, 1,900 consumers. Inventory refreshed after final edits; structured UTF-8 comparison bounds source changes to four owned pages and the new test.
- Controller validation and whitespace check passed at closeout. Scoped task commit only; no push in this first task of the pair.

Initial scripted wrapping attempted to wrap enclosing conditional JSX and nested expressions; corrected before final checks by limiting wrapping to non-JSX values. Review caught overly broad physical-border replacement and restored color classes before acceptance. New guard fixtures initially used unsupported raw bigint amounts and lacked an external picker context; corrected to canonical numeric/Minor fixtures and explicit picker boundary. No production financial logic or failure guard weakened.

## Limits and handoff

Bounded source/component/CSS acceptance. Browser geometry, keyboard/caret/focus/AT/zoom, native Persian language/accounting/legal review, real DB/REST/MCP/output/provider execution, production IRR/deployment and hosted CI remain unverified. No build, dev server or application database write performed. Commit locally; supervisor assigns the next live task to a fresh agent and pushes after its second scoped commit.
