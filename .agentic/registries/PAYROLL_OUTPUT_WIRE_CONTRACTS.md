# Payroll output wire contracts (MON-085)

## Operations

Paths below are relative to `/api/v1/payroll`. All operations call shared scoped
direct-Drizzle services in `lib/api/payroll-outputs.ts`. MCP registration uses
`registerPayrollOutputTools`, AuthContext and wrapTool. Every input property has
a description; objects reject unknown properties. API-key organization scope
overrides conflicting headers. Existing envelopes and tool names remain.

| REST | MCP | Input / result / permission |
|---|---|---|
| GET reports/summary | get_payroll_summary | optional startDate/endDate; summary; view:payroll-reports |
| GET reports/labor-cost | get_payroll_labor_cost | optional dates; data grouped by department and item currency; view:payroll-reports |
| GET reports/tax-liability | get_payroll_tax_liability | optional dates; data/totalTax/currency; view:payroll-reports |
| GET reports/yoy | get_payroll_yoy | no MCP input; data by Gregorian pay-period-end month; view:payroll-reports |
| GET reports/export | export_payroll_csv | optional dates; REST CSV attachment, MCP csv/filename/contentType; view:payroll-reports |
| POST runs/:id/generate-payslips | generate_payslips | owned run UUID (MCP payRunId), empty REST body or {}; count of new snapshots; manage:payroll |
| GET runs/:id/payslips (new REST parity) | list_payslips | owned run UUID (MCP payRunId); payslips with employeeName; manage:payroll |
| GET payslips/:id | get_payslip | owned UUID (MCP id); payslip with employee/payrollRun/payrollItem; view:payslips; atomically marks viewed |
| GET employees/:id/payslips | list_employee_payslips | owned employee UUID (MCP employeeId); data; view:payslips |
| GET self-service/profile | get_payroll_self_profile | no input; employee; self-service:payroll |
| PATCH self-service/profile | update_payroll_self_profile | optional email/bankAccountNumber only; employee; self-service:payroll |
| GET self-service/payslips | list_payroll_self_payslips | no input; data for authenticated member's employee only; self-service:payroll |
| POST tax-forms/generate | generate_tax_forms | taxYear/formType; generation/formsGenerated (REST 201); manage:payroll |
| GET tax-forms | list_tax_forms | optional page/limit/taxYear/formType; data/pagination of batches with forms; manage:payroll |
| GET tax-forms/:id | get_tax_form | owned UUID; form with generation; manage:payroll |
| GET tax-forms/:id/pdf | get_tax_form_pdf_data | owned UUID; existing JSON form data/note, not a PDF; manage:payroll |

Dates are valid Gregorian YYYY-MM-DD, years 0001..9999, inclusive ordered bounds.
Reports include completed nondeleted runs wholly inside the requested period;
YoY retains its all-history semantics. No implicit date parsing or localized
digits. Tax-year input is numeric integer 2020..2099; formType is w2, 1099_nec or
1099_misc. The last remains filterable for old empty batches but generation now
returns 422 before writes instead of creating a misleading empty successful
batch. Pagination defaults page 1/limit 50, bounded to 1..1000000 / 1..100.
Malformed query numbers, JSON, UUIDs and unknown body/tool fields reject. REST
query adapters consume the documented filters; unrelated query parameters are
ignored, with no undocumented representation switch.

Self-service resolves an organization member by ctx.userId and exactly one live
linked employee. Missing profiles return 404; ambiguous profiles return 422.
Email must be valid; bank account strings max 10000 characters. Empty patches
return the current profile. Salary, currency, member/employee identifiers and
other users' profiles cannot be edited through this boundary. The explicit
view:payslips grant preserves organization-wide read access; self-service grants
remain restricted to the caller's employee. Tax list/detail previously lacked
payroll permission checks; these now consistently require manage:payroll.

## Money and saved currency

Existing numeric money remains signed integer payroll cents, max absolute
9007199254740991, with additive canonical FIELDMinor decimal strings. No input
money is added to report/generation operations: they consume saved payroll data.
String aliases do not advertise full-int64 business/number-ORM support. Nullable
money remains null with null aliases. Hours, counts, years, flags and timestamps
retain their original units. No magnitude, locale or current-rate rescaling.

Summary: totalGross, totalDeductions, totalNet, avgCostPerRun. Labor: totalGross,
totalNet. Tax liability: per-employee totalGross/totalTax and overall totalTax.
YoY: totalGross/totalNet. Every field adds a matching Minor alias. Bigint sums
and rational half-away-from-zero averages guard final safe bounds. Header-based
reports use saved run.baseCurrency; historical null headers use the documented
current organization base bridge, coordinated with MON-082/084. Different saved
base currencies reject, including across YoY months. Labor groups item.currency
separately; tax liability's single overall total rejects mixed item currencies.

Payslip: grossAmount, netAmount, taxAmount, ytdGross, ytdNet, ytdTax gain aliases.
Currency comes from the immutable linked item, not today's employee currency.
Nested employee salary/hourlyRate, run totals and item/tax/deduction amounts reuse
MON-079/082 DTOs, including exact saved item FX and approximate binary32 fxRate.
Unsafe, quarantined or ambiguous legacy history fails; no guessed FX conversion.
Deduction JSON accepts null or arrays of name/amount/category plus amountMinor;
known numeric money is checked, aliases agree, category is pre_tax/post_tax.
Unsupported fields/shapes and unsafe opaque numbers reject before status writes.

Tax-form payloads explicitly enumerate numeric cents fields; each adds FIELDMinor.
W-2 fields: box1_wages, box2_federal_tax, box3_ss_wages, box4_ss_tax,
box5_medicare_wages, box6_medicare_tax, box12_retirement_deferrals, box14_other,
box17_state_income_tax, box19_local_income_tax. NEC: box1_nonemployee_compensation.
Known text metadata stays text/null; box13_retirement_plan stays boolean. Exact
alias-only saved payloads are accepted within safe bounds; conflicting aliases,
unsafe numeric fields, unknown payload shapes/fields and unsupported form types
reject. New payloads snapshot currency USD; old payloads without currency retain
their existing explicit USD tax-form contract, never today's base currency.

## Generation and history

Payslip generation requires completed live runs. YTD includes only completed,
nondeleted same-year runs wholly contained between January 1 and this run's end;
all items for the employee at that cutoff count. Signed correction items retain
their values. YTD never adds unlike currencies. Current amounts copy the saved
item; actual saved deduction rows populate the breakdown. Existing snapshots
are preserved and validated; only missing payrollItemId snapshots are inserted.
Duplicate legacy snapshots fail for explicit remediation. New and repeated
REST/MCP requests serialize on the same organization lock, so concurrent retries
insert once and return count 0 when nothing is missing. No uniqueness migration
or protection against arbitrary SQL/unadopted external writers is inferred.

W-2 generation preserves the existing bounded mapping: gross minus saved pre-tax
deductions for box 1, gross capped by configured SS wage base (legacy default
16810000 cents) for box 3, gross for box 5. Withholding uses actual saved taxKind/
jurisdiction breakdowns, including additional Medicare and state/local/other;
MCP no longer estimates withheld SS/Medicare from flat percentages. Saved tax and
deduction totals must reconcile, with complete pre/post detail; nonzero legacy
withholding without details rejects before inserting a batch. Pre-tax totals
remain the existing single box-12 aggregate; post-tax and other tax use box 14.
Negative corrections sum exactly; unsupported negative final annual boxes reject.
This is not a new statutory classification, wage-base policy or filing approval.

1099-NEC consumes paid saved USD payment amounts grouped by owned contractor.
Adopted paymentDate determines the Gregorian year; null legacy dates retain
paidAt's UTC-year selection with an exclusive next-year boundary. Totals below
60000 cents are omitted; exactly 60000 qualifies. Deleted contractor masters do
not erase paid historical amounts. Other currencies/null saved currency and
nonpositive/unsafe payments fail rather than applying today's FX or threshold.
Each generation call intentionally creates a new batch; it is not an idempotent
filing command. Repeated generation never edits earlier snapshots or payroll.

## Transactions, presentation and limits

Reads use repeatable-read snapshots. Ownership of run/employee/item, nested
project/milestone/timesheet/deduction/member and form/generation/recipient joins
is checked. Writers share organization locks with other adopted payroll services.
Input/history/range/DTO checks, payslip snapshots, viewed status/profile edits,
tax-form batches/forms and awaited audit all commit together. Audit faults roll
back; self-profile audit records changed field names, not bank details. These
output operations do not post journals or bypass posting period locks.

REST errors: malformed input 400, missing/foreign 404, auth 401/403, unsupported
history/currency/range 422, unexpected DB failure 500. MCP uses SDK validation and
wrapTool's matching classified errors. Numeric compatibility never falls back
to strings, rounded numbers or null. No raw bigint crosses JSON serialization.

CSV retains the first eight columns and exact legacy two-decimal payroll cents
presentation, adding Currency last. Text cells quote commas/quotes/newlines and
neutralize leading spreadsheet formulas; money formats from bigint, including
safe-max and negative cents. Dashboards use exact fixed-cents presentation with
explicit saved currencies, bigint differences/totals and visible incompatible
currency/error states. Downloads send the organization header. Run payslips use
the shared run list rather than one request per employee. Form-data download is
labeled accurately as JSON; the /pdf compatibility endpoint still returns its
existing JSON envelope. A real PDF renderer and general locale/ISO display-scale
cutover remain MON-034/locale/parent qualification, not a falsely completed PDF.

No schema, migration, historical rescale, posting, current tax-policy/provider,
IRR flag or deployment change. Full-int64 consumers, general PDF output,
large-dataset performance (reports currently materialize qualified history),
browser/session/OAuth/network transport and independent financial/security review
remain parent/downstream qualification. Actual synthetic PostgreSQL REST/API-key
and MCP SDK fixtures cover all 16 pairs and full registration; they are not those
broader production gates.
