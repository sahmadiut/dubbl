# MON-103 tax and regulatory report contracts

Verified 2026-10-07 from actual source and migrated PostgreSQL REST/MCP fixtures.
Technical self-review; existing jurisdiction heuristics are preserved. No new
statutory compliance, tax rates, filing rules or historical accounting repair.
MON-029 retains independent report integration acceptance.

| REST GET boundary under /api/v1/reports | MCP tool | Monetary outputs and aliases |
|---|---|---|
| 1099 | report_1099 | threshold/thresholdMinor; vendors[].totalPaid/totalPaidMinor; reportableTotal/Minor, grandTotal/Minor |
| tax-summary | tax_summary | rates[].outputTax, outputNet, inputTax, inputNet, netTax and matching Minor strings; totalOutputTax, totalInputTax, netTaxPayable and matching Minor strings |
| sales-tax | sales_tax | breakdown[].taxableAmount/taxableAmountMinor, taxCollected/taxCollectedMinor; exemptAmount/exemptAmountMinor |
| vat-return | vat_return | boxes[].amount/amountMinor; existing nine box numbers, labels and flatRate envelope |
| vat-return/transactions | vat_return_transactions | transactions[].debit/debitMinor, credit/creditMinor, amount/amountMinor; total/totalMinor |
| bas | bas | fields[].amount/amountMinor; existing eight field identifiers/labels |
| schedule-c | schedule_c | lines[].amount/amountMinor; totalIncome, totalExpenses, netProfit and matching Minor strings |

Every result adds currencyCode. Existing result envelopes, IDs, names, period,
recognition basis, vatScheme, reportable flags and count fields remain. Monetary
values are numeric integer cents with additive canonical signed integer strings.
Aliases append Minor to the complete existing field name (grandTotalMinor etc.).
Numbers such as counts, taxYear, entryNumber, rate, taxRatePercent and percentBp
remain numbers without money aliases. Tax rates and percentBp are basis points,
not FX or monetary amounts. quantity is stored in hundredths (100 = one unit).

## Inputs and errors

- 1099: optional year is an integer 2000..2100, defaults to prior UTC calendar
  year. Optional threshold numeric safe nonnegative integer cents and/or
  thresholdMinor canonical nonnegative signed-int64 string must agree. Default
  is the existing 60000 cents. Exact input above MAX_SAFE_INTEGER fails with
  422 LEGACY_NUMERIC_RANGE; unsafe numeric input is invalid (400).
- tax-summary: optional startDate/endDate default independently to current UTC
  year January 1 / UTC today. Other reports require both dates except drill-down
  with an owned periodId. Dates are real Gregorian YYYY-MM-DD, years 0001..9999,
  inclusive and ordered. No permissive parseInt/Number parsing of query strings.
- VAT/BAS/drill-down: optional basis is cash or accrual, defaults to current org
  vatScheme. VAT optional flatRatePercent is integer basis points 0..10000; zero
  disables it, positive values activate the existing gross-turnover method.
  Flat-rate cents use exact rational Math.round semantics (ties toward positive
  infinity, including negatives). Fractional, nonfinite and out-of-range basis
  points reject; rates are caller data, not a live statutory-rate recommendation.
- Drill-down: box is 1/4/1A/1B; optional periodId is a scoped UUID that overrides
  supplied dates. A period does not change the basis default or load frozen filed
  lines. Foreign/missing IDs return 404; invalid UUID/box/date returns 400.
- Both transports validate strict schemas; unknown/duplicate REST parameters,
  empty values, whitespace/exponent/fraction/leading-zero numeric query syntax,
  alias conflicts and negative zero reject with 400. MCP inputs are typed numbers
  for legacy numeric fields and described canonical strings for exact aliases.
- Every operation requires view:data. API-key REST uses real getAuthContext;
  registered MCP uses the supplied AuthContext and wrapTool. Missing/invalid
  authentication returns 401, denied permission 403. No new mutation or approval
  operation is added.

## Exact range, currency and scope

getTaxReport is the shared direct-Drizzle service. All components, organization
configuration, dates from periods and related metadata use one repeatable-read,
read-only transaction. SQL SUM is text and all monetary intermediate calculations
use bigint. Totals above signed int64 or Number range may cancel exactly; only
final exposed monetary fields must fit absolute 9007199254740991 cents. Exposed
drill-down debit/credit legs must each fit even if their difference is small.
No number is used to recover a rounded monetary value, no bigint reaches raw JSON,
and no exact-only/full-int64 public mode or deprecation deadline is invented.

Document reports require included non-draft/non-void/non-deleted documents to use
the current organization currency; otherwise 422 LEGACY_NUMERIC_RANGE. 1099
similarly checks included non-card supplier payments to owned flagged vendors.
There is no qualified historical FX conversion for combining currencies. Ledger
legs retain existing base-ledger cents; original journal-line currency tags do not
rescale amounts. CurrencyCode is a supported uppercase organization currency;
unsupported saved currency fails with 422. USD/IRR/JPY/KWD value 1250 stays 1250.
Changing an organization currency cannot silently combine old foreign documents.
Historical currency remediation remains an independent qualification gate.

Entry/account, document and payment owners are enforced in both relevant join
directions. Cash bank-account existence is scoped; a foreign bank cannot activate
cash recognition. Cross-border contacts are scoped, so foreign contact metadata
does not enter EC totals. Foreign rate metadata is never disclosed: tax-summary
only projects live owned rates; sales-tax has null metadata for unmatched/foreign
rate references, distinct from its separate truly unassigned exemptAmount.
No report, audit or ledger write occurs; normal REST API-key authentication may
update lastUsedAt independently. No schema/migration, historical rescale or
production IRR flag changes.

## Preserved report semantics and limits

- 1099 sums actual made payments by flagged, non-deleted contact. Card, received,
  deleted and out-of-year payments are excluded. Zero-paid flagged contacts remain
  visible; totals sort descending with ID tie-break. No claim of new US compliance.
- tax-summary uses line tax and the existing per-line integer truncation of
  quantity * unitPrice / 100, before discount. Numeric SQL multiplication avoids
  bigint product overflow. Active rates retain outputTax > 0 or inputTax > 0;
  negative-only rates are still omitted. Soft-deleted documents now match the
  exclusion used by the other report services.
- sales-tax preserves grouping including the null tax-rate group, its invoice
  counts and a separate unassigned-line exemptAmount; it does not subtract that
  group from the breakdown or change saved line amounts.
- VAT control accounts 2200/1500 provide posted, non-deleted period movement.
  Reverse charge is still identified by an output line on an entry with positive
  input VAT debit, on accrual date even when cash is requested. Box 1 subtracts
  that amount; boxes 2/3/4/5 retain existing definitions. Fully non-recoverable
  reverse charge without an input leg remains a known gap.
- Cash uses existing cash-source types OR an owned bank/cash contra account.
  Document boxes remain document-date totals on either basis. EC boxes remain
  tax-registered cross-border contact heuristics, not legal EU classification.
- Flat rate uses gross invoice turnover, with boxes 2/4 zero. Live output
  drill-down returns full control movement and includes reverse charge: its total
  does not equal split/flat-rate VAT box 1. This pre-existing mismatch is documented
  explicitly; no new reconciliation claim or frozen-filing interpretation.
- BAS preserves G1/G11 gross documents, G2 cross-border subtotal, 1A/1B movement,
  NET difference and zero G3/G10 placeholders.
- Schedule C preserves the existing subtype-to-line mapping and revenue credit
  natural sign versus other debit natural sign. NetProfit remains line 1 income
  minus expenses excluding lines 1/2; returns line 2 is not newly deducted.

## Fixtures

tax-report-wire.test.ts covers strict inputs, aliases, final numeric bounds and
signed exact flat-rate rounding. tax-report.test.ts/worker execute all seven
API-key REST handlers and registered MCP SDK pairs on a migrated randomized
database. Assertions cover defaults, line truncation, every VAT/BAS box, cash,
flat rate, reverse charge, all drillable boxes/periods, vendor exclusions, Schedule
C, currencies, two organizations, malformed references, permission denial,
SQL cancellation above int64, per-line exposed limits, unsafe final totals,
foreign currencies and read-only snapshots. Existing tax-rate/profile, tax-period
filing/settlement and cumulative-statement regressions also pass. Session/browser,
large-history performance and independent accounting/statutory qualification
remain separate.
