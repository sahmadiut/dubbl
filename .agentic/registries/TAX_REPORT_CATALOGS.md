# Tax report catalogs

LOC-110 owns 1099/page.tsx, tax-summary/page.tsx and vat-return/page.tsx under
app/(dashboard)/reports, with 64 paired TaxReports messages. All authored headings,
descriptions, help, table headings, empty states, threshold/withholding/form
badges, refund/due phrases, VAT box explanations, official-label prefix, raw-data
link, drill-down label and finite failure copy use the catalog. Persian wording
is provisional pending native financial terminology review.

## Preserved contracts and explicit exceptions

- Vendor names, tax identifiers, tax rate names and VAT official labels are
  escaped data. Statutory official labels remain verbatim; they are not replaced
  with translations. The nine box identifiers and US/EU statutory meanings remain.
  This is localization of the existing reports, not Iranian statutory compliance.
- 1099 CSV columns name/taxIdentifier/totalPaid/paymentCount/reportable/currencyCode,
  filename 1099-{year}, boolean values and exact integer strings remain canonical.
  The raw VAT URL, report keys, year/startDate/endDate/basis query keys and values,
  organization header, drill-down dates and links remain unchanged.
- Gregorian year/date inputs, numeric counts/box IDs, basis machine values,
  currency scales/codes, exact money formatting and fixed-two percentage
  formatting remain data/format exceptions. Shared BackToReports, BrandLoader,
  DateRangeFilter, BasisToggle and ExportButton retain their existing ownership.
- Existing checked money readers validate aliases and report arithmetic before
  state adoption. No amount is converted to floating point for display or export.
  Failure copy is finite and localized; request cleanup and missing-org behavior
  remain. VAT expansion now exposes its existing open state via aria-expanded.

Existing report_1099, tax_summary and vat_return MCP tools cover these operations
with scoped direct service/DB access. No REST/MCP, permission, DB schema/migration,
ledger, FX, IRR readiness/activation flag or Stripe changes are part of this slice.

## Verification and handoff

Production JSX tests use real next-intl, PresentationProvider and shared UI with
controlled page hooks, IO and animation. They cover all copy, escaping, exact
amounts/CSV, threshold branches, due/refund branches, nine VAT boxes, expansion,
date/year/basis callbacks, URLs, loading/empty/failure states, unsafe response
rejection, cancellation and missing organization. Existing migrated PostgreSQL
fixtures exercise actual REST, linked MCP operations and independent SQL checks.

See [evidence](../evidence/LOC-110-attempt-1.md) and
[self-review](../evidence/LOC-110-review-1.md). LOC-070/008/002 retain independent
combined acceptance. Native linguistic, full RTL/date/numeral/browser, adjacent
output, hosted CI and release qualification remain separate. Next: LOC-111.
