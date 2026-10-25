# RTL-017 payroll bidi and resilient controls

## Selection and boundary

Live controller selected RTL-017 on master at 215777ea12b09429f038298611c06ae4ccd742b8. All 27 payroll census sources were audited and this existing task was completed whole. No split, priority change, new operation or MCP tool was needed. RTL-010/008/002 retain independent acceptance. Initial unrelated staged drawer/onboarding changes and their generated consumer hashes are preserved and excluded from the task commit.

## Assigned-source audit

- payroll/layout and loading: audited canonical TabLayout routes, exact overview matching, detail hiding and shared loading boundary; no source repair needed. Shared shell qualification remains separate.
- employees list: isolate escaped caller names/positions/initials and ordered employee numbers/fixed-two salaries, logical search/clear geometry and end alignment, wrapping rows/tabs/actions and accessible search/sort names. Filters, sorting, IDs and drawer/navigation callbacks remain unchanged.
- employees detail: isolate name/position/member linkage, employee identifiers, deduction names, fixed-two salaries/deductions/band money and physical percentages. Native profile/tax fields gain associated IDs/labels and auto/LTR direction, with unchanged email/date/number semantics and exact drafts. Activation, profile/tax save, deletion, bigint ratios and disabled historical dates retain their contracts.
- contractors list/detail: isolate caller/company/email metadata, currency, invoice references and fixed-two hourly/payment displays. Logical search/alignment/icons, wrapping list/actions and associated native form labels/direction preserve pagination, current currency semantics, payment process/create/save and deletion contracts.
- runs list and off-cycle dialog: logical search/action geometry, wrapping filters/tabs and growing translated controls. Employee/parent choices isolate name, number, dates and currency in approved rich tags. Existing regular/off-cycle/correction/bonus/termination enums, signed cents, parent IDs, PTO and date/form callbacks are unchanged.
- runs detail: isolate employee numbers/names/descriptions, exchange rates and exact gross/tax/deduction/net/bonus displays. Period/processed timestamp and journal summary interpolate ordered fragments independently. Bonus native labels/direction and growing employee/type choices preserve every lifecycle, approval, reject, bonus, generation and output navigation callback.
- payslips: isolate employee names/numbers, deduction names and fixed-two amounts, use logical end alignment and disclosure spacing. Existing detail toggle, viewed request and saved payslip contracts remain unchanged. No issued output was rewritten.
- time-leave, timesheets list/detail and leave list/detail: isolate employee/policy/reason text and individual dates/physical hours, including translated rejection and range summaries. Logical search, growing tabs/segmented view/actions, wrapping rows and associated native date/hour/reason/select controls preserve fractional-hour steps, canonical dates, pagination, shift/status enums and exact create/submit/approve/reject/add/delete payloads. View-animation/event bodies remain unchanged; mounted interaction is not claimed.
- self-service: isolate employee number/position, payslip period/money and policy/hour summaries; associated email/bank fields retain raw edits and explicit native direction. Existing ten-payslip/five-timesheet display limits, profile PATCH and saved history contracts remain unchanged.
- settings: isolate caller configuration names, account-code/time/percent drafts and salary-band values. Approved rich tags independently isolate bracket jurisdiction/money/rate, shift times and band level/pricing. Associated native labels, logical action spacing and wrapping actions preserve all five create forms, seven checked reads, save/delete behavior, statutory enums and basis-point/fixed-two settings units.
- compensation list/review detail: isolate caller band/review/employee/reason data, employee number and fixed-two money. Effective date and signed percent interpolate ordered fragments. Logical search/alignment, wrapping filters/actions and associated native salary/date fields preserve exact band/review payloads and current adjustment semantics.
- analytics, forecasting, reports list/detail: isolate exact monetary totals, month/department/employee values, grow translated actions and associate date/physical numeric scenario controls. Explicit positive sign and monetary text share one ordered group. Report routes, Gregorian filter values, physical headcounts/percent, grouping, currency separation, scenario payload and CSV download bytes remain unchanged; no chart/data builder changed.
- tax liabilities: logical column alignment, isolate references/jurisdiction/fixed-two allocations and period fragments; associated native reference/notes/amount/account controls and labeled date-picker groups. Liability bucket mapping, exact allocation/payment/idempotency behavior and machine statutory values remain unchanged.
- tax forms list/detail: isolate recipient names, ordered years/masked tax IDs/dates and fixed-two tax boxes/metadata; logical table alignment, growing year/actions and directional navigation. Original masking, year choices, generation/download request, saved formData and JSON artifact contracts remain unchanged.

Catalog wording and keys are retained except two paired accessible Sort by labels in PayrollEmployees/PayrollCompensation. Approved em/code tags select BidiText/IdentifierText in display-only messages; catalog contents are never interpreted as HTML. Paired catalogs contain 10,707 keys; the payroll namespace count increases from 1,043 to 1,045 and compensation count from 82 to 83. Persian new labels use actual script and UTF-8-safe writes.

## Verification

Final combined command passes 131/131, exit 0:

`$payrollTests = (Get-ChildItem tests/payroll-*-catalogs.test.ts).FullName; node --import tsx --test --test-concurrency=1 @payrollTests tests/payroll-catalog-integration.test.ts tests/rtl-payroll.test.ts tests/payroll-ui-money.test.ts`

The six new regressions execute actual production JSX, next-intl/PresentationProvider, native controls and edit/navigation callbacks across en-US/fa-IR with latn/arabext. They verify escaped long mixed caller text, exact employee/statutory identifiers, large fixed-two KWD/USD money, field-label IDs, raw bank edits, canonical dates/fractional hours, tax masking and grouped positive/negative forecasts. Installed Tailwind evidence covers logical geometry/alignment, wrapping actions/tabs, directional arrows and select height/value-clamp overrides. State/IO and unowned picker/portal boundaries are controlled; this is source/SSR/callback/CSS evidence.

Initial 115 pre-refinement regressions passed. Rich interpolation introduced expected string-only translator/contiguous-markup assertion failures; test-only catalogText strips reviewed tags for expected text and visibleText compares rendered text only for rich messages, while raw markup, placeholder, navigation and attribute assertions remain. Statutory text exceptions and key pins were updated explicitly. New regressions independently assert actual bdi markup, avoiding self-fulfilling text-only coverage. The final rerun passes all affected component/callback/catalog/consumer tests, including failure paths and output downloads.

Independent AST comparison verified all 27 non-JSX logic trees and every JSX event-attribute body match HEAD after normalizing only newly isolated JSX, display-only rich calls and logical column-class tokens. The final sign-group repair changes JSX grouping only. No REST/MCP/service/schema/migration or generated output builder was edited.

- pnpm typecheck: exit 0.
- Scoped ESLint over all payroll TSX, affected catalog suites, new RTL suite/helper: exit 0, no diagnostics.
- pnpm lint: exit 0, zero errors and 20 existing warnings outside owned changes.
- pnpm i18n:check: exit 0, 10,707 keys per locale.
- Legacy money lint gate: all nine regression checks pass.
- Money generator and Drizzle/source verifier: 417 columns, 1,877 consumer hashes and occurrence lines pass after temporary audit scripts were removed. Working inventory preserves staged unrelated consumer/schema records. The private candidate merges only owned consumer changes, preserves HEAD schema and unrelated hashes, and verifies all candidate hashes against index blobs before commit.
- Exhaustive ownership remains 417 original paths with unchanged task assignments. Controller structural validation and whitespace/scope checks pass before local commit.

## Qualification and handoff

No mounted browser/caret/selection/keyboard/focus/AT, pixel clipping/zoom/text-spacing, native Persian/accounting, PDF/print/email, hosted CI or deployment qualification is claimed. Native date widgets and shared selectors retain separate qualification. No full build/dev server, DB access/write, IRR enablement or Stripe work occurred. Tests composing shared drawer/widgets run against the current working tree; excluded concurrent drawer/onboarding work is not qualified by this task. A private Git index protects the task commit from concurrent staging; only unchanged task-owned shared-index entries are synchronized afterward, preserving unrelated entries and per-record inventory state. Supervisor owns the paired push; next selection follows the live controller.
