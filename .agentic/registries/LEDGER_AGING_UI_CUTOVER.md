# Ledger, cash-flow and aging UI money - MON-166

Bounded child of MON-162. MON-162, MON-158 and MON-008 retain independent
combined acceptance. Runtime adapter: `lib/money/ledger-aging-ui.ts`.

| Consumer under app/(dashboard)/reports | Existing REST / registered MCP | Adopted behavior and units |
|---|---|---|
| general-ledger/page.tsx | general-ledger / general_ledger | Numeric raw minor-unit aliases validated against canonical Minor strings. Natural debit/credit account sign, opening + period = closing, complete-page totals and deterministic running balances validate with bigint. Initial report and subsequent pages validate before adoption. Pages must retain date range, dimension, currency, summary totals and offset; repeated line IDs fail. Request versions discard obsolete pages; a changed snapshot becomes an explicit retry error. |
| cash-flow/page.tsx | cash-flow / cash_flow_statement | Flat saved numeric raw minor-unit amounts validate before display. Bigint operating/investing/financing row sums agree with section totals and net cash flow. Negative outflows retain sign. Current direct/indirect and reconciliation accounting semantics remain unchanged. Unconsumed nested fields are not adopted by the UI. |
| aged-receivables/page.tsx | aged-receivables / aged_receivables | Numeric document minor units with exact aliases; one response currency, no FX. Validate each document currency/number/identity, bucket order/count/sum and grand total. Historical asAt semantics remain in shared aging service. Mixed-currency response fails; existing backend supports a single currency filter. |
| aged-payables/page.tsx | aged-payables / aged_payables | Same validation with required billNumber and bills array. No mixing with invoice fields or implicit zero for missing money. |

Display uses `reportUiMoney` at explicit currency scale: USD two, JPY/IRR zero,
KWD three. No rescaling stored history. Backend legacy numeric range remains
safe integer; client arithmetic uses bigint. Counts, offsets, dates, entry
numbers and UI selectors are nonmonetary numeric exceptions. Ledger legacy
runningBalance/balance remain period-only natural-sign amounts; additive
ledgerBalance/closingLedgerBalance include opening history.

CSV uses currencyCode and explicit canonical Minor columns. Ledger exports the
currently loaded entries (existing behavior), including period and opening-
inclusive balances; it does not claim complete server-side export. Existing
server PDF/XLSX operations and tools remain unchanged.

Every initial load and ledger page checks HTTP success and parses saved aliases.
Invalid/error responses render ErrorState with retry, never a successful empty
or zero report. Original tables, navigation, drilldown and controls are retained.
No new REST/MCP operations, migrations, posted-history changes, IRR activation,
provider or production action.

Behavior: `tests/ledger-aging-ui.test.ts`. Real authenticated REST, linked
registered MCP, independent SQL-text and read-only snapshots:
`tests/integration/ledger-aging-ui.test.ts` and its worker. Existing ledger-detail,
cash-flow and aging backend suites cover auth/query/dimension/export contracts.
No live browser, printer/PDF layout, native wording or production qualification.

Remaining independent families: MON-167 tax/tracking/consolidation/custom,
MON-168 analytical/bank, MON-163 contact/dashboard/shared presentation.
