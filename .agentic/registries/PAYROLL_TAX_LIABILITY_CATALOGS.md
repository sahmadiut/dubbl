# Payroll tax liability catalogs

LOC-091 owns `app/(dashboard)/payroll/tax-liabilities/page.tsx` and 52 paired
`PayrollTaxLiabilities` messages. They cover titles, liability/paid/outstanding
cards, agency descriptions, history columns, empty state, payment sheet,
placeholders, jurisdiction labels, outstanding notice and finite feedback.

## Preserved contracts and explicit exceptions

- Allocation buckets `income_tax`, `fica`, `pension` and their `income_tax`,
  `941`, `benefits` taxKind defaults remain machine values. Federal/state/local
  values, saved jurisdiction/taxKind codes and EFTPS remain statutory identifiers.
  Descriptions translate existing US-oriented concepts; this task introduces no
  Iranian statutory compliance or new tax rates.
- References, notes and jurisdiction/tax identifiers remain escaped saved data.
  Unknown taxKind values retain the existing income-tax agency-total fallback;
  history displays their literal identifier. Translations do not infer or rewrite
  historical allocations.
- Gregorian periods, UTC timestamp date slices, month/today defaults, punctuation,
  dashes, currency codes and fixed-two payroll-cent input/display remain. Currency
  is never inferred from locale. Calendar/numeral and complete RTL qualification
  are separate.
- Paid rows alone contribute to totals; bigint sums and outstanding clamp remain.
  Unlike paid currencies show translated unavailable totals. The existing report
  and payment-history coverage remains; this is not new reconciliation behavior.
- URLs, methods, organization header, JSON fields, optional omission rules,
  retry-key normalization/reuse and paymentDate posting contract remain. Failed
  posting or malformed success retains form fields and the retry key. Checked
  success closes the sheet, clears the key and refreshes reads. Changed normalized
  input gets a new key. Server posting, rounding, authorization and locks remain.
- Shared BrandLoader, DataTable, CurrencyInput, DatePicker, sheet/select controls,
  icons, styles and numeric values retain their existing ownership.

`payrollTaxPaymentJson` checks HTTP/JSON/envelopes, exact aliases, currencies,
displayed fields, dates, finite jurisdiction/status values, duplicate IDs and
matching created journal identity. Liability reads reuse `payrollAnalyticsJson`.
Both reads validate before atomic adoption. Failures release loading, clear
payment rows and hide totals behind translated feedback. Cleanup ignores obsolete
fulfillment/rejection. Missing org or inaccessible storage cannot leave loading
stuck. Raw server, network, parser and money-adapter diagnostics never display.

Existing `get_payroll_tax_liability`, `list_payroll_tax_payments`,
`create_payroll_tax_payment` and legacy `record_payroll_tax_remittance` tools
cover these operations. No REST/MCP/service/auth, schema/migration, stored amount,
provider, IRR flag or Stripe source change is needed.

## Verification and handoff

Production page JSX and real next-intl/PresentationProvider render in both
locales. Controlled hooks/IO and inline portal/table wrappers expose production
callbacks and column renderers; this is not mounted browser qualification.
Checks cover exact cents through aggregate values above Number.MAX_SAFE_INTEGER,
escaping, bucket/jurisdiction values, pending/currency behavior, malformed
responses, atomic reads, obsolete replies, validation and retry keys. Migrated
fixtures apply the reader to real REST and linked MCP envelopes alongside
existing independent SQL, authorization, locks, idempotency and migration checks.

Persian wording is provisional pending native terminology review. LOC-067/008/002
retain independent combined acceptance. Complete RTL, keyboard, calendar/numeral,
hosted CI, deployment and production qualification remain separate. See
[attempt evidence](../evidence/LOC-091-attempt-1.md) and
[Codex self-review](../evidence/LOC-091-review-1.md).
