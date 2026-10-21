# Combined payroll catalog acceptance - LOC-067

2026-10-21 (Asia/Tehran). This parent independently audits LOC-079..092 after
their completion. LOC-008/002, native financial terminology, complete RTL,
calendar/numeral presentation, mounted-browser and release qualification remain
separate. Persian wording is provisional.

## Complete source and catalog inventory

The current payroll slice has exactly 27 route TSX components and two creation
drawers. Fourteen namespaces contain 1,043 paired messages; the full catalogs
have 8,053 compatible keys per locale. Shared controls retain their own ownership.

| Child / namespace | Messages | Actual payroll-relative components and shared ownership |
|---|---:|---|
| [LOC-079](PAYROLL_OVERVIEW_CATALOGS.md) / PayrollOverview | 44 | page, layout, loading |
| [LOC-080](PAYROLL_EMPLOYEE_CATALOGS.md) / PayrollEmployees | 46 | employees/page; EmployeeDrawer |
| [LOC-081](PAYROLL_EMPLOYEE_DETAIL_CATALOGS.md) / PayrollEmployeeDetail | 92 | employees/[id]/page |
| [LOC-082](PAYROLL_CONTRACTOR_CATALOGS.md) / PayrollContractors | 74 | contractors/page and contractors/[id]/page; ContractorDrawer |
| [LOC-083](PAYROLL_RUN_CATALOGS.md) / PayrollRuns | 71 | runs/page and runs/off-cycle-dialog |
| [LOC-084](PAYROLL_RUN_DETAIL_CATALOGS.md) / PayrollRunDetail | 99 | runs/[id]/page |
| [LOC-085](PAYROLL_OUTPUT_CATALOGS.md) / PayrollOutputs | 83 | runs/[id]/payslips/page; tax-forms/page and tax-forms/[id]/page |
| [LOC-086](PAYROLL_TIME_LEAVE_CATALOGS.md) / PayrollTimeLeave | 75 | time-leave/page |
| [LOC-087](PAYROLL_TIME_DETAIL_CATALOGS.md) / PayrollTimeDetail | 95 | leave/page and leave/[id]/page; timesheets/page and timesheets/[id]/page |
| [LOC-088](PAYROLL_SELF_SERVICE_CATALOGS.md) / PayrollSelfService | 42 | self-service/page |
| [LOC-089](PAYROLL_COMPENSATION_CATALOGS.md) / PayrollCompensation | 82 | compensation/page and compensation/reviews/[id]/page |
| [LOC-090](PAYROLL_ANALYTICS_CATALOGS.md) / PayrollAnalytics | 64 | analytics/page; forecasting/page; reports/page and reports/[type]/page |
| [LOC-091](PAYROLL_TAX_LIABILITY_CATALOGS.md) / PayrollTaxLiabilities | 52 | tax-liabilities/page |
| [LOC-092](PAYROLL_SETTINGS_CATALOGS.md) / PayrollSettings | 124 | settings/page, including its five inline creation drawers |

All component names above have `.tsx` extensions. The combined test pins the
complete filename list and audits authored JSX text, display attributes, toast
arguments and document titles in every component plus both creation drawers,
DrawerFooter and SectionLabel. Child tests additionally cover dynamic finite
labels, ICU arguments, read/mutation callbacks and negative cases. Source,
current child registries and review records were examined together; AST checks
alone do not establish complete translation or payroll correctness. No further
production source or catalog change was needed for this parent.

## Explicit exceptions and shared ownership

- Names, employee numbers, positions, company/department/policy/band/review and
  deduction names, emails, bank and tax identifiers, references, reasons, notes
  and descriptions remain saved/caller data escaped by React. The service's
  ambiguous `Unassigned` department fallback remains unchanged because it is
  indistinguishable on the wire from a real department name. It is explicitly
  retained for later output/data-contract qualification.
- Machine IDs, URLs, organization headers, methods, query/payload fields,
  statuses, frequency/type/filter/sort values, drawer names and event names
  remain unchanged. `EMP-001`, `john@example.com`, `jane@example.com` and numeric
  examples are technical placeholders. Currency codes, W-2/1099 identifiers,
  EFTPS, FICA and existing federal/state/local concepts retain their meaning;
  translation does not introduce Iranian statutory payroll compliance.
- Five Persian values have no Persian-script character: PayrollRuns.employeeOption
  (`{name} · {currency}`), PayrollRunDetail.employeeOption (`{name} ({number})`)
  and the three PayrollOutputs formType values (`W-2`, `1099-NEC`, `1099-MISC`).
  PayrollCompensation.adjustment is also a symbol-only exception (`+{percent}٪`);
  its percent sign falls within the Arabic Unicode block. Every other Persian
  value contains Persian script. Script/ICU parity is not native review.
- BrandLoader is already under SharedUI; DrawerFooter uses DocumentForms
  cancel/creating defaults with workflow-specific overrides. Section, PageHeader,
  Input, Button, Badge, confirmation, date and currency controls retain shared
  ownership. This task introduces no new picker or user operation.
- Gregorian date-only values, UTC instants, clock strings, years/months, count
  strings, physical hours, percentage symbols, separators, missing-value dashes,
  masks and existing number/date presentation retain their contracts. The
  self-service generated date still uses browser `toLocaleDateString()`; tax
  generation display uses its saved UTC date prefix. Full calendar/numeral/RTL
  acceptance is separate, and no date is persisted differently by this parent.
- Legacy payroll money remains fixed-two cents across currencies. Canonical
  `*Minor` strings, checked safe numeric aliases, bigint derived sums and
  differences, rounding, FX snapshots and historical values remain unchanged.
  Unlike currencies stay separate; locale does not select or rescale currency.
  Physical binary32 hours, premium percentages, basis points and counts keep
  their existing units. IRR production enablement remains separately gated.

## Output and error ownership reconciliation

| Source / output | Accepted ownership and preserved boundary |
|---|---|
| `lib/api/payroll-outputs.ts` payslip snapshots, YTD and saved deductions | Data displayed by LOC-085 run payslips, LOC-088 self-service and adjacent employee/run workflows; exact cents and saved data remain unchanged |
| `lib/payroll/payslip-generator.ts` buildPayslipData | Data-only helper; no current call site or authored output prose found |
| `lib/api/payroll-outputs.ts` tax form boxes, metadata and taxFormPdfData | LOC-085 owns known UI labels/statuses and finite generation/view/download feedback; statutory boxes, saved recipient data and aliases remain wire data |
| `app/api/v1/payroll/tax-forms/[id]/pdf/route.ts` and `lib/payroll/output-client.ts` | Existing `/pdf` operation returns JSON and `tax-form-{id}.json`, with no payroll PDF template. Its English diagnostic note is not rendered by the pages and remains an explicit protocol/output exception for LOC-009; this acceptance does not claim translated JSON diagnostic bytes |
| Payroll CSV report export and `downloadPayrollCsv` | LOC-090 owns visible export actions and finite failure feedback. Backend CSV header/order/data, formula protection, MIME type and `payroll-export.csv` remain export contracts |
| Payroll REST/MCP/service and shared download errors | Internal diagnostics retain machine/protocol ownership. Every owned UI read/mutation/download boundary maps failures to finite catalog feedback; raw server/parser/network/storage messages are not presented |

There is no newly implemented PDF output to qualify. The existing JSON download
and CSV are tested as such. Remaining output-copy, native terminology and full
document/RTL qualification stay with LOC-009 and later qualification tasks.

## Combined behavior and transport evidence

[Combined tests](../../tests/payroll-catalog-integration.test.ts) link production
PayrollLayout and TabLayout with the overview, employee list and self-service
under one real next-intl/PresentationProvider per render. The same checked
employee feeds the workflows; tests preserve maximal safe cents and KWD's legacy
two-decimal payroll display, escaped caller data, all nine canonical navigation
routes and translated failed-read behavior that hides stale saved rows. Both
real creation drawer bodies compose their shared footer/section chrome in both
locales, retain maximum/low-digit cents input strings and disable pending submit.
Hook/IO/portal boundaries are controlled; mounted-browser behavior is not claimed.

The current child suites cover all workflows, including regular/off-cycle run
payloads, lifecycle/bonuses, payslip viewing, tax generation/JSON downloads,
binary32 time/leave mutations, authenticated self-service history identity,
compensation review/bands, forecasting/report/CSV callbacks, liability payments,
configuration, failed-create field retention, atomic reads and stale replies.

Eight unchanged migrated fixture files exercise real payroll master, config,
time, runs, payments, outputs, compensation and combined payroll REST handlers,
linked registered MCP tools and independent SQL assertions. They already pass
actual transport responses through the relevant presentation readers. Checks
cover exact aliases, history/migration preservation, balances/posting/FX,
authorization and tenant isolation, employee-bound self-service, audit,
idempotency and rollback. This parent reruns those fixtures and does not infer
acceptance solely from completed children or historical test counts.

Existing payroll master/config/time/runs/payments/outputs/compensation tools
remain org-scoped through AuthContext/wrapTool and shared direct-DB services.
No UI operation or REST contract changed, so no new MCP tool was required.
The pre-existing settings approval-chain summary REST read retains its separate
contract; this parent does not claim additional approval-chain MCP parity.

See [attempt evidence](../evidence/LOC-067-attempt-1.md) for actual results and
[Codex self-review](../evidence/LOC-067-review-1.md) for review limitations.
No production application, catalog, REST/MCP/service/auth/schema/migration,
stored money, payroll calculation, statutory, provider or Stripe file changed.
