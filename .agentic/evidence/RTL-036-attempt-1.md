# RTL-036 quote and sales-credit bidi acceptance

## Identity and ownership

Codex, 2026-10-26, `codex-batch-task03`, baseline `c77765198f806d15382f80d5c511ba29c6e5b812` on master. Live controller validate/status/next selected RTL-036 with no unmet dependencies; tree was clean and synchronized with origin/master. This is one task and the first local commit of the owner's next sequential fresh-agent pair. No push is performed by this agent.

Read AGENTS, START_HERE, controller/project/repository map, frontend role, task, RTL-006/007 reusable foundation evidence and the exhaustive ownership registry. DEC-005 permits behavioral/accessibility/CSS acceptance without screenshots; DEC-008 freezes Stripe. No financial, provider or production qualification is inferred.

## Exhaustive four-source audit

| Owned source | Result and contracts retained |
|---|---|
| `app/(dashboard)/sales/quotes/page.tsx` | Isolate document IDs, canonical issue/expiry dates, caller customer names, unknown status codes, full exact money strings and sample IDs/amounts. Logical alignment/icon spacing/automatic margins, wrapping CTA and statistics, bounded locale-directed scrolling tabs, and minimum-width/long-text containment replace physical or overflowing presentation. Keep existing raw status values, organization-scoped abortable list reads, exact summaries grouped by currency, empty/error/loading branches, row navigation and quote drawer operation. |
| `app/(dashboard)/sales/quotes/[id]/page.tsx` | Isolate translated date/status strings, use logical icon spacing, mirror back arrow, wrap narrow action text and contain long page content. Existing qualified PageHeader already isolates title/description. Keep quote fetch/adaptation/stale-context guards, accept/decline paths, conversion POST and returned raw invoice-ID navigation, send dialog raw ID/number/customer/email/date/currency/bigint amount and history refresh. |
| `app/(dashboard)/sales/credit-notes/page.tsx` | Isolate document/date/customer/status/money rows and empty sample values. Use logical amount alignment, search placement/padding, icon spacing and use-case accent borders. Locale-directed bounded tabs and sorting; search has auto direction and accessible name, sort trigger has accessible name and unclamped text, date filters retain named groups, example ledger rows wrap. Preserve pagination/context and abort guards, exact currency summaries, client search semantics, filter/sort/date raw callbacks, list count and drawer/row routes. |
| `app/(dashboard)/sales/credit-notes/[id]/page.tsx` | Isolate complete invoice option, remaining credit, empty-currency, issued/status and caller-note strings; preserve note whitespace. Locale-directed locally scrolling application dialog and invoice selector, associated invoice label/trigger, explicitly named existing amount control, wrapping actions and logical/mirrored back control. Preserve org/customer/currency/status/balance eligibility, canonical exact decimal parsing, amountMinor-only application payload, disabled/error boundaries, issue/send/history/cancel/confirm and unmount protections. |

All four owned sources were read end to end. `QuoteMoneyDetails` and `CreditNoteMoneyDetails` are separately assigned to RTL-048, not silently accepted or modified here; their line descriptions/account/quantity/summary isolation and physical alignment remain for that task. Shared editors remain RTL-021. Shared PageHeader/StatCard/DataTable/amount/date/control primitives are reused. Imported money/status/currency helpers are unchanged. PageHeader's string interface and existing localized interpolations are preserved; complete translated strings are isolated without injecting Unicode controls, changing catalogs or altering copyable values.

No REST/MCP operation, HTTP route, financial algorithm, schema, migration, stored value, document output builder or Stripe file is changed. Existing operations retain MCP parity; presentation adoption introduces no new operation requiring a new tool. RTL-015/010/008/002 and RTL-048 retain independent acceptance.

## Checks and acceptance mapping

Commands run in `D:\Projects\dubbl` with installed dependencies and synthetic fixtures; no application database writes, dev server or full build.

- Retained baseline: `node --import tsx --test --test-concurrency=1 tests/quote-catalogs.test.ts tests/quote-ui-money.test.ts tests/quote-wire.test.ts tests/credit-note-catalogs.test.ts tests/credit-note-ui-money.test.ts tests/credit-wire.test.ts tests/sales-catalog-integration.test.ts`: 40/40 passed.
- New `tests/rtl-sales-quotes-credits.test.ts`: four production component/provider/callback/CSS cases passed across en-US/fa-IR x latn/arabext. Test boundaries control own state scheduling/effects, navigation/drawer/confirmation, dialog/select portals and separately owned send/history widgets; production JSX, providers, money, shared tables/fields and actual operation callbacks execute. Synthetic long escaped Persian/English callers, mixed technical IDs, canonical dates, exact low digits at 4000000000000001, status/sort/search/navigation, invoice selection/amount callbacks, named/directed controls, dispatch props, quote conversion and credit application org-scoped POST payload are asserted. Installed Tailwind compilation proves logical inset/padding/margins/alignment/borders, wrap/min/max widths, local scroll/max height, mirrored back arrow and unclamped selector text utilities.
- Final combined command adds the new test file to the seven retained suites above: 44/44 passed, zero failures/skips/cancellations.
- Final `pnpm exec tsc --noEmit`: passed. Full `pnpm lint`: passed with zero errors and 21 existing unrelated warnings; scoped ESLint on the four owned pages and new test also passed.
- `pnpm i18n:check`: 10723 matching keys per catalog; `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine regression checks passed.
- `python .agentic/scripts/money_inventory.py --write` then `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed, 417 unchanged schema columns, 1896 consumers, 2517 scanned sources; only owned current source/test hash/occurrence inventory changes.
- Controller completion/validation, changed-file review and whitespace checks run before the local scoped commit. Final handoff reports the generated commit, clean tree and next task.

Acceptance 1 maps to the complete four-source table and preserved callback/wire/money tests. Acceptance 2 maps to actual page/provider/callback tests and installed CSS. Acceptance 3 maps to explicit ownership and limits here plus the attributed self-review.

## Fixture corrections

The initial credit-application fixture wrongly expected a numeric `amount` alias alongside `amountMinor`; the existing operation deliberately sends only the canonical `amountMinor` and invoice ID. Its assertion now matches that exact pre-existing contract; production payload construction was not changed. The initial isolated CSS fixture lacked the blue theme color token, so the compiler omitted the color utility; supplying the theme token verifies the existing logical accent class. These corrections do not weaken production guards or existing tests.

## Limits and next action

No mounted browser geometry/caret/keyboard/assistive-technology/zoom review, native Persian linguistic/accounting/legal approval, live REST/MCP/SQL integration, email/PDF/print/dispatch qualification, provider execution, production IRR enablement, deployment or hosted CI replacement is claimed. Compiled CSS and static component evidence do not establish browser clipping or native-language acceptance. Shared RTL-048 widgets and all integration parents remain open independently. Finish self-review/controller closure and create one local scoped commit; return to supervisor for a completely fresh next-task agent, without pushing.
