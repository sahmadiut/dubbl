# RTL-013 banking bidi and resilient controls

## Selection and audit

Live controller selected RTL-013 after RTL-022. Initial master HEAD was 3cf83078c79d81ca3ff5a882aa58faa714e727fc. Initial unrelated modifications were components/dashboard/create-drawer.tsx and its MONEY_BOUNDARIES consumer hash; both are preserved and excluded from this task commit. No other task or parent is accepted here. The exhaustive ownership registry assigns these eleven sources to RTL-013; ownership entries are unchanged.

Every assigned source was audited:

- banking/page.tsx: account list/onboarding/groups, caller account/bank names and masked identifiers, exact currency-group money, wrapping actions/rows and logical balance alignment. The financial direction of incoming/outgoing icons and relative balance-bar geometry remain meaningful and unmirrored; navigation chevrons mirror with the root direction.
- banking/[id]/(detail)/layout.tsx: shared context/header, account metadata, exact summary values, wrapping actions, back icon and logical tab counters. Tab destinations and context/provider identity remain unchanged. Bank metadata is escaped and isolated without rewriting original values.
- banking/[id]/(detail)/page.tsx: reconciliation overview and inherited TransactionRow/ImportRow consumers; overview counts and import action wrap, exact progress ratios remain unchanged.
- banking/[id]/(detail)/imports/page.tsx: wrapping import action and inherited isolated import rows; canonical file/format/import contracts remain unchanged.
- banking/[id]/(detail)/settings/page.tsx: logical intrinsic section tracks, explicit name/bank auto direction and ordered account-number/country fields, associated visible labels/native IDs and growing account-type select. CurrencySelect/AccountPicker retain their existing widget behavior, canonical choices and constraints; no primitive is reimplemented here.
- banking/[id]/(detail)/transactions/page.tsx: logical search icon/padding/counters, named search/sort controls, growing actions/selects and inherited isolated rows. DatePicker maintains Gregorian callback values and its own presentation; list/cash-coding selections, filters and bulk request bodies remain unchanged.
- banking/[id]/_components.tsx: all transaction/import rows, import preview, match bill/invoice/unified sheets, expense/categorization, transfer/split, cash-coding and reconciliation report/adjustment consumers were reviewed. Caller descriptions/payees/names/notes are isolated; technical reference/file/document/date identifiers keep logical order. Form fields have explicit accessible names, prose drafts use auto direction, native numeric/date controls retain LTR direction, translated actions/select values grow, and long labels wrap rather than truncate. Money displays retain the original helpers, precision, signs, currency codes and unavailable states; signs are grouped with their amount. File import/preview and cash-coding grids deliberately retain their minimum width inside existing horizontal scroll containers. No chart renderer/tooltip exists in these eleven sources; balance/progress bars are not chronological charts. Existing SVG checkmark path geometry remains unchanged.
- banking/[id]/reconcile/page.tsx: named logical search, wrapping caller labels/actions, isolated exact statement totals, responsive summary tracks, ordered native balance inputs and mirrored back icon. Session eligibility, balance checks and write payloads are unchanged.
- banking/batches/page.tsx: isolated batch/supplier/bill labels and exact amounts, wrapping selection/creation actions and logical payment-input indentation. No selection, validation or canonical batch item change.
- banking/batches/[id]/page.tsx: isolated batch/supplier/email/bill/remittance labels and exact totals, logical action spacing/back navigation and wrapping controls. Remittance dates/reference prose and payment-status semantics remain unchanged; existing native date formatter behavior is preserved rather than newly qualified.
- banking/scheduled/page.tsx: isolated suppliers/bills/notes/amounts, named schedule fields, ordered native date/decimal input, growing filters/selects/actions. Canonical week grouping, scheduling/processing/cancellation payloads and retries remain unchanged.

Imported i18n/bank-*-presentation and lib/money/bank-ui/payment-ui helpers were read at their consumers and remain unchanged. Existing CurrencyInput, DatePicker, pickers and other primitives retain their own future ownership/qualification boundaries. No new operation or public feature was added, so no corresponding MCP tool change is needed. No REST/MCP service, schema, migration, application DB, issued snapshot, export or Stripe change occurs.

## Verification

The final combined command passed 54/54 tests (exit 0). The focused command is:

`node --import tsx --test --test-concurrency=1 tests/rtl-banking.test.ts tests/banking-catalog-integration.test.ts tests/bank-workspace-catalogs.test.ts tests/bank-reconciliation-catalogs.test.ts tests/bank-payment-catalogs.test.ts tests/bank-account-catalogs.test.ts tests/bank-import-catalogs.test.ts`

The new test executes actual production JSX, native fields, Button/SelectTrigger, real next-intl/PresentationProvider, exact large KWD values and real selection/action callbacks across en-US/fa-IR with latn/arabext. Installed Tailwind declarations verify logical insets/padding/margins/alignment, intrinsic tracks, value clamp removal, wrapping and directional navigation. It controls state/navigation and unowned widget/portal boundaries; it is not a mounted browser layout test. Existing consumer suites exercise real production callback bodies for account/settings/import, reconciliation, matching, expense/categorize/transfer/split/bulk, scheduling/batches/remittance and failure paths.

An independent TypeScript AST comparison removes only JSX nodes and the new bidi component import from old/new versions; all eleven non-JSX control/data/function trees compare equal. Presentation edits include repetitive icon-margin repairs and compacted native field attributes; no transport or money logic is rewritten.

Initial new-test failures were harness identity (ESM versus loaded provider/widget context) and an overstrict prohibition on direction marks produced by the existing Intl money formatter. The harness now shares actual provider/widget identities; caller references remain byte-exact and legitimate Intl output remains unchanged. No production financial formatter was altered to satisfy the test.

## Limits and handoff

No mounted/browser selection/caret/keyboard, actual pixel clipping/zoom/text-spacing, assistive-technology, native linguistic/accounting, PDF/print/email, hosted CI or deployment qualification is claimed. DEC-005 removes screenshot requirements, not later independent behavioral/native qualification. RTL-010/008/002 remain open for their own independent acceptance. No full build/dev server/DB write/IRR enablement/provider implementation occurred. Supervisor owns the single paired push after this task's local commit. Concurrent drawer work and its generated hash remain outside this task commit.


## Final static and inventory results

- pnpm typecheck: exit 0, including the final production/native-field changes.
- pnpm exec eslint app/(dashboard)/accounting/banking/**/*.tsx tests/rtl-banking.test.ts: exit 0 with no diagnostics.
- pnpm lint: exit 0, zero errors and the same 20 existing warnings in other sources.
- pnpm i18n:check: exit 0, 10,702 keys in each locale; no catalog wording/key changes.
- node --import tsx .agentic/scripts/verify_legacy_money.mjs: all nine checks pass.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: exit 0, 417 schema columns and 1,874 consumer records. Schema/classification records are unchanged. Only the eleven banking sources and new test records belong to this task; the concurrent drawer hash is excluded from staging.
- python .agentic/agent.py validate: 394 tasks, structurally valid. Controller acceptance, honest self-review and final staged whitespace/scope checks precede the local commit.
- git diff --check: exit 0. No full build, dev startup, application/disposable DB write, external network/browser/provider operation or deployment was needed.
