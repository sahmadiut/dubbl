# RTL-035 invoice and sales shell bidi acceptance

## Identity and scope

Codex, 2026-10-26, baseline 60d08ec87b6f191f4cf2189328615060f0c9ab98 on master. Live validate/status/next selected RTL-035; clean tree and one prior authorized RTL-014 commit ahead of origin/master. Claimed by codex-batch-task02. This is the second task of the owner-authorized sequential fresh-agent pair; this task creates its scoped commit, then pushes both commits once. No second task is performed by this agent.

Read AGENTS, START_HERE, controller/project/repository map, frontend role, live task/context and RTL-006/007 foundation history. DEC-005 removes screenshot blocking; DEC-008 freezes Stripe. Existing foundation evidence supplies reusable primitives, not proof of this slice's module acceptance.

## Exhaustive four-source ownership audit

| Source | Findings, repair and preserved contracts |
|---|---|
| app/(dashboard)/sales/page.tsx | Isolate complete invoice/payment identifiers, canonical date strings, exact monetary strings, customer names, unknown status labels, empty preview values and aging count/amount fields. Replace physical icon/search/automatic-margin/alignment classes with logical equivalents. Status tabs follow locale direction and scroll within the available width; search has an accessible name and auto-direction; sort has a named unclamped trigger and locale direction. Recent payments, aging and count rows wrap; caller names can wrap instead of clipping. Preserve selection/bulk eligibility, raw IDs, filter/sort/status values and queries, pagination/search behavior, org-scoped reads, summaries, bigint ratios/bar widths, success-only refreshes and drawer/row callbacks. |
| app/(dashboard)/sales/[id]/page.tsx | Isolate document/payment/account IDs, email/phone, existing English date display, complete quantity/deposit/tax/paid percentage tokens, caller descriptions/names/references/notes and saved snapshot fields. Exact monetary formatting and already-isolated DualAmount remain unchanged. Unknown status/credit/method labels are isolated. Use logical spacing/alignment, wrapping header/credit/payment rows and multiline credit action. Preserve the locally scrolling invoice table and minimum width; mirror back glyph and snapshot-sheet side for Persian. Dialog/sheet direction follows locale with local vertical scrolling. Associate all ten snapshot fields plus reject reason, payment method/bank and date group labels. Caller names/addresses/rejection use auto-direction; email/phone/tax/registration drafts remain LTR. Preserve snapshot values (no trimming added), issued history, create-copy/PDF/send/payment/approval/interest/credit/write-off/void payloads, integer scales/quantity/basis-point arithmetic, org scoping, abort/stale reads and lifecycle guards. |
| app/(dashboard)/sales/layout.tsx | Audited unchanged. Actual TabLayout retains isolated translated nav labels, local horizontal scroll, exact active route and hidden navigation on invoice/quote detail routes. All eight canonical routes, hints and child content are unchanged. Four-presentation composition test verifies real layout/PathnameContext behavior. |
| app/(dashboard)/sales/loading.tsx | Audited unchanged. Actual BrandLoader retains the localized SharedUI loading aria-label through the real presentation providers. No unsupported status-role claim is made. |

Imported invoice UI/money/presentation helpers, shared editors, dispatch/output builders and PDF/email implementations remain unchanged. Shared editor adoption stays RTL-021 and other sales/purchasing slices remain independently owned. No API route, MCP tool, schema/migration, provider or Stripe file changes. No new operation requires a new MCP tool. No catalog key/wording/interpolation changes.

## Verification and acceptance mapping

All commands ran in D:\Projects\dubbl; no application database writes, full builds or dev server runs.

- `node --import tsx --test --test-concurrency=1 tests/rtl-sales-invoices.test.ts tests/invoice-catalogs.test.ts tests/invoice-ui-money.test.ts tests/invoice-ui-components.test.ts tests/invoice-bulk-wire.test.ts tests/invoice-lifecycle-wire.test.ts tests/invoice-read-wire.test.ts tests/invoice-write-wire.test.ts tests/sales-catalog-integration.test.ts`: final 39/39 passed, zero failures/skips/cancellations. This includes 36 retained financial/lifecycle/catalog tests and three new production component/callback/CSS cases. Initial retained-only baseline passed 36/36.
- New tests execute the production list/detail components, actual shared fields/tables/money/provider controls, actual layout and loader for en-US/fa-IR x latn/arabext. Controlled boundaries are component state scheduling, effects, routing/drawer/confirmation, dialog/sheet portals and separately owned send/email/attachment widgets. No production JSX is reconstructed. Long escaped Persian/English caller text, canonical IDs/date strings, 4000000000000001 low digits, full percentages/quantity, exact currencies, bar widths, label associations/directions, raw filter/status/sort/navigation/drawer/method and snapshot edit callbacks are asserted. The actual snapshot save callback sends the unchanged org-scoped PATCH body; saved invoice/snapshot fixtures remain unchanged. Existing tests additionally retain error/abort/load, payment/credit/PDF/copy/approval/lifecycle and exact-money guards.
- Installed Tailwind compilation verifies logical inset/padding/margins/alignment, wrap, min/max width, independent scroll, max-height, isolation-compatible wrapping, mirrored arrow, unclamped selector height/text and the existing 500px table minimum. This is compiled CSS evidence, not mounted browser geometry.
- Final `pnpm exec tsc --noEmit`: passed. Scoped ESLint passed earlier; `pnpm lint`: passed with zero errors and 21 existing unrelated warnings.
- `pnpm i18n:check`: passed, 10723 keys per locale. `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine regression checks passed.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed, 417 unchanged schema columns / 1895 consumers / 2516 scanned files. Changes record only current owned source/test hashes and occurrence lines plus the new focused test consumer; no schema/financial reclassification.
- Controller completion/validation and `git diff --check` are performed before commit. Pair staging/commit scope and remote SHA are verified before/after the authorized push; see final agent handoff for generated commit identity, rather than inventing a future SHA here.

Acceptance 1 maps to the complete four-row audit and retained wire/money/callback tests. Acceptance 2 maps to two repaired active views and four-presentation real component/CSS evidence. Acceptance 3 maps to the explicit ownership/preservation/limits here and the attributed review. RTL-015/010/008/002 keep independent acceptance.

## Corrected fixture issues

The initial new shell assertion assumed href preceded aria-current; React emitted the opposite order. It now locates the actual anchor and checks both attributes without weakening route/active-state coverage. The initial loader assertion assumed role=status; the unchanged loader actually exposes translated aria-label, now asserted directly. The initial typecheck found the new shell test omitted the provider's required fixed now; the fixture now supplies it. Final suite/typecheck pass. No runtime behavior, financial guard or existing assertion was weakened to satisfy these fixture corrections.

## Limits and handoff

No mounted browser/caret/keyboard/AT/zoom/clipping review, native Persian linguistic/accounting/legal review, live REST/MCP/SQL integration, payment provider execution, PDF/print/email/dispatch output qualification, production IRR enablement, hosted CI replacement or deployment was performed or claimed. Existing English date/technical numeral conventions are preserved, with complete directional isolation; this is not new date/financial behavior. Inventory and exact-display tests do not replace accounting qualification. Stripe files/functionality remain untouched.

Complete honestly attributed self-review, controller closeout and one scoped commit. Push the RTL-014 + RTL-035 pair once and verify remote HEAD/clean tree, then return to supervisor for a completely fresh next-task agent.
