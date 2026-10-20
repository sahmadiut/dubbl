# Payroll payslip and tax form catalogs - LOC-085

83 paired flat `PayrollOutputs` messages; 7,519 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance, followed by native terminology, RTL and release qualification.

## Owned presentation

- `app/(dashboard)/payroll/runs/[id]/payslips/page.tsx`: title, navigation,
  period connector, empty/missing payslip guidance and ICU plural, money and
  deduction/YTD headings, finite status/category labels, view/hide actions,
  not-found state and checked read/view feedback. Shared BrandLoader continues
  to use `SharedUI.loading2`.
- `app/(dashboard)/payroll/tax-forms/page.tsx`: title/help, year picker and
  unchanged generation choices, busy/success/error feedback, generation and
  recipient table headings, statuses, empty state and accessible download label.
- `app/(dashboard)/payroll/tax-forms/[id]/page.tsx`: title, not-found/back states,
  heading templates, recipient type, statuses, summary headings, known W-2 and
  1099-NEC box labels, known metadata labels and download feedback. Unknown
  field names no longer become labels through underscore replacement.
- `i18n/payroll-output-presentation.ts`: checked envelopes/displayed fields,
  finite saved enums and known tax metadata, exact-alias validation delegated
  to existing `payrollJson`, and safe organization lookup. Run detail reuses
  the already checked run-detail reader.

Reads reject HTTP/JSON/envelope, field/enum and money errors before adoption.
Payslip run/list reads adopt together after link/duplicate checks. Opening a
payslip retains the existing GET that marks it viewed, but adopts viewed status
only after a valid matching response. Initial effects ignore obsolete results;
missing organization/storage failure releases loading. Detail 404 responses
retain their not-found states. Generation requires valid generation/count and
a checked list refresh before showing success; failures preserve year/list/
expanded state and release busy. Refresh failure may follow a committed batch,
so feedback explicitly asks for list reload before another generation attempt.
Download failures use finite translated feedback at both page boundaries.

## Adjacent generated output ownership inventory

| Source/output | Ownership and treatment |
|---|---|
| `lib/api/payroll-outputs.ts`, `generatePayslips`/`slipDto` | Existing snapshots, exact cents/aliases, saved deduction names/categories and YTD values remain data; no generated prose was added or changed. The run page owns generation controls in LOC-084; this child owns presentation of the snapshots. |
| `lib/payroll/payslip-generator.ts`, `buildPayslipData` | Data-only helper; repository search finds its declaration with no current call sites. No authored visible prose to extract. |
| `lib/api/payroll-outputs.ts`, `generateTaxForms`/`taxDataDto` | Existing W-2/1099-NEC boxes, saved recipient metadata, statuses and USD cents remain unchanged. This child translates their UI labels; statutory calculation/compliance is outside this extraction. |
| `app/api/v1/payroll/tax-forms/[id]/pdf/route.ts`, `taxFormPdfData` | Existing endpoint returns JSON, not a PDF. Preserve field names, form identifiers and its English diagnostic `note`; broader API/output-copy audit belongs to LOC-009 and combined ownership to LOC-067. The pages do not render this note. No PDF template was found in this workflow. |
| `lib/payroll/output-client.ts`, `downloadTaxFormData` | Preserve authenticated `/pdf` request, JSON blob and `tax-form-{id}.json` filename. Both owned consumers catch helper/server/blob errors with translated feedback. Helper implementation and file bytes remain unchanged. |
| `downloadPayrollCsv`, report routes, self-service/employee history | Separate LOC-090 reporting and LOC-088 self-service/LOC-081 employee workflows. Not duplicated in this child; shared helper errors in other consumers remain for their owners. |
| REST and MCP protocol descriptions/errors | Existing machine/diagnostic contracts remain. Owned pages expose finite catalog feedback. No REST/MCP definitions changed. |

## Exceptions and preserved contracts

- Statutory `1099-NEC`, `1099-MISC`, `W-2` catalog values deliberately match
  across locales; every other Persian leaf contains Persian script. Saved
  names, deduction names, emails, employee numbers, masked tax IDs, currency
  codes, IDs, `-`, canonical dates/years and data filenames remain data.
- All three payslip statuses and all five tax statuses, including `corrected`,
  have finite labels. Empty historical 1099-MISC batches remain readable;
  the service still rejects 1099-MISC generation and populated unsupported
  payloads. No additional generation option is introduced.
- Known metadata gets labels while values remain escaped. Matching `*Minor`
  aliases stay out of detail presentation. The existing exclusion of
  `box13_retirement_plan` from this detail UI remains; it stays in JSON output.
- The year picker remains 2020..2026 with default 2025. Pay-period strings and
  tax years remain canonical Gregorian data. Generation date presentation now
  shows the saved UTC date prefix (`YYYY-MM-DD`) instead of an implicit host
  locale/timezone conversion. Full calendar/numeral presentation is independent.
- Legacy fixed-two payroll cents, `payrollMoneyDisplay`, bigint deduction
  differences, USD tax forms, saved money/FX, calculations, authorization,
  organization headers, GET/POST paths, POST fields, navigation, snapshots,
  schema/migrations, IRR enablement and Stripe remain unchanged.
- Existing org-scoped registered `get_payroll_run`, `list_payslips`,
  `get_payslip`, `generate_tax_forms`, `list_tax_forms`, `get_tax_form` and
  `get_tax_form_pdf_data` already cover the owned operations through shared
  services. No new user operation or tool is needed.

## Verification boundary

The focused suite renders production JSX via real next-intl and
PresentationProvider in both locales. Hook/IO and portal boundaries are
controlled; mounted browser/keyboard qualification is not claimed. Tests cover
copy/status/box/metadata coverage, plural and empty/loading/error/busy states,
escaped caller data, maximal cents and bigint differences, masking, navigation,
year values, checked initial reads/cleanup, viewed status, generation payloads/
refresh/failures, actual JSON download helper and finite errors, and Persian
script/statutory-code exceptions.

The migrated output worker passes successful real REST and linked registered
MCP list/detail/generation responses through this reader. Its independent SQL,
authorization/isolation, exact history/YTD/tax, rollback, audit, idempotency and
migration-preservation assertions remain. See
[attempt evidence](../evidence/LOC-085-attempt-1.md) and
[Codex self-review](../evidence/LOC-085-review-1.md) for observed results.

Native Persian, full RTL/numerals/calendar, parent integration, remaining
payroll/output translation, hosted CI, deployment and production acceptance
remain independent. No full build or unrequested dev server was run.
