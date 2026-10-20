# Payroll run list and creation catalogs - LOC-083

71 paired `PayrollRuns` messages; 7,337 compatible keys per locale. Persian
wording is provisional. LOC-067/008/002 retain independent integration
acceptance, followed by native terminology, RTL and release qualification.

## Owned presentation

| Source | Coverage |
|---|---|
| `app/(dashboard)/payroll/runs/page.tsx` | Document title, empty-state timeline/help/actions, status/type tabs and badges, search, clear/sort accessible names, sort choices, filtered absence, pay-period connector, gross/deduction/net labels, regular creation dialog, success and finite read/create/organization feedback |
| `app/(dashboard)/payroll/runs/off-cycle-dialog.tsx` | Final-pay/bonus/correction titles, approval explanation, completed-run and employee choices, period/amount/PTO/notes controls, input examples, correction explanation, busy/create action, success and finite choice/create/organization feedback |

The checked `payrollRunJson` reader delegates all supplied money and currency
validation to existing `payrollJson`; run list/parent responses also reuse the
overview reader's required exact totals, status and Gregorian-date checks.
It checks nonempty IDs, run types, pagination, employee display fields and
completed-parent items before adopting state. Creation permits the minimal ID
and known-status envelope used for navigation and lifecycle feedback; any supplied
money must still have matching canonical aliases. Unknown server, JSON parser,
storage and network prose never enters visible feedback.

Initial list reads release loading on missing organization and failures.
Off-cycle choices retain existing page-100 traversal, checking each returned
page/limit, and adopt results only after all pages succeed. Effect cleanup ignores
late fulfillment/rejection and stops further page requests. Opening a choice
dialog clears earlier choices. Failed mutations retain forms, release busy,
and avoid closing, success or navigation. Approval-required creation retains its
distinct success message. Closing a busy off-cycle dialog remains guarded.

## Explicit exceptions and unchanged contracts

- Shared `BrandLoader` and the local pending-search loader use `SharedUI.loading2`.
  `employeeOption` is deliberately the same data-only `{name} · {currency}` in
  both catalogs: its interpolated values are caller data/currency codes, with no
  authored prose. All other new Persian leaves contain Persian script.
- Employee names, notes, run/employee IDs and currency codes remain escaped data.
  Parent choices retain the first eight ID characters. Canonical date-only
  strings, layout numbers and technical input types/DOM IDs are unchanged.
  Human-facing numeric examples have translated introductory text; the literal
  decimal examples retain ASCII syntax matching the existing cents parser.
- Machine statuses `draft`, `processing`, `completed`, `void`, `pending_approval`,
  types `regular`, `termination`, `bonus_only`, `correction`, `off_cycle`, URL
  suffix `bonus-only`, sort values `date`/`gross`/`net`, and `asc`/`desc` remain.
  Existing date/status search and client sorting/filtering are unchanged. The
  list still reads its existing default first page; no pagination redesign.
- Payroll keeps fixed-two cents independently of ISO scale. Display uses
  `payrollMoneyDisplay`, null run currency still defaults to USD, and mutations
  keep `payrollCentsInput` and canonical cents strings. Corrections preserve
  signed `grossAdjustmentMinor`; bonus-only preserves the existing magnitude
  input behavior. PTO remains a boolean, not money. No new calculations.
- Regular creation sends only pay-period dates. Final pay sends employee,
  dates, `includeUnusedPto`, and notes. Bonus creation sends dates, notes and
  `bonuses[{employeeId, bonusType: "other", amountMinor}]`; correction sends
  `parentRunId`, notes and `adjustments[{employeeId, grossAdjustmentMinor}]`.
  Existing routes, methods, org/content-type headers and navigation remain.
- Existing org-scoped `list_payroll_runs`, `create_payroll_run`,
  `create_bonus_payroll_run`, `create_termination_payroll_run`,
  `create_correction_payroll_run` and `list_payroll_employees` cover this UI through the
  existing shared services. No REST/MCP definition, authorization, schema,
  migration, statutory identifier, FX/IRR flag, provider or Stripe change.

## Verification and handoff

The focused suite renders production JSX through real next-intl and
PresentationProvider in both locales. Hooks/IO and portal boundaries are
controlled; this does not claim mounted browser or keyboard qualification.
Checks cover status/type/sort values, filtering and navigation, empty/failed/busy
states, escaping, exact money, choice pagination and stale reads, all creation
payloads, negative failures, field retention, success variants and copy audit.
The payroll money source guard follows the new reader back to `payrollJson`.

The migrated run worker checks real regular/bonus/termination/correction create
responses from REST and registered linked MCP, run list and completed-parent
choice responses (with explicit MCP list adaptation), and actual employee REST
choices. Existing independent SQL, lifecycle, authorization, isolation, audit,
balanced-ledger, rollback and migration-preservation checks remain intact.

See [attempt evidence](../evidence/LOC-083-attempt-1.md) and
[Codex self-review](../evidence/LOC-083-review-1.md) for actual results.
Native Persian, full RTL/numerals/calendar, run detail/output translation,
hosted CI, deployment and production acceptance remain independent.
