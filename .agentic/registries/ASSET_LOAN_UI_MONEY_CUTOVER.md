# MON-156 asset and loan UI money

This slice reuses the existing asset master, depreciation, valuation, CWIP and
loan REST/MCP services. Successful responses pass through
`lib/money/asset-loan-ui.ts` before state adoption or mutation success. The adapter
requires safe numeric cents and agreeing canonical Minor strings, including
zero, nullable revaluation/disposal values, signed valuation changes and nested
histories. Recognizable master/schedule DTOs require their core money fields;
partial depreciation mutation DTOs retain their existing shape. CWIP `total` is
money, while pagination `total` is a count.

| Consumer | Behavior and arithmetic |
|---|---|
| Fixed asset list | Check saved list/filter responses and batch depreciation results; retain bigint cost/book/depreciation totals and clamped bigint chart ratios |
| Fixed asset detail | Check master, depreciation/revaluation histories, separate CWIP costs and successful mutations; bigint depreciation ratio and signed change magnitude; bigint construction cost sum |
| Asset categories | Check residual aliases before display/edit; retain exact residual, life and basis-point input; keep form text when validation fails |
| Loan list/detail | Check principal/payment/schedule aliases before display or payment confirmation; retain bigint active principal/monthly-payment sums; validate payment responses before success |
| Shared FixedAssetDrawer / LoanDrawer | Retain exact cents inputs and validate create responses before close/navigation; pickers consume account identity only |

`assetCentsInput`, `assetCentsDecimal` and `assetMoneyDisplay` preserve the historical
fixed two-decimal cents contract and USD display for these untagged DTOs. No ISO
scale is inferred, and no JPY/KWD/IRR amount is rescaled. Loan REST legacy numeric
principal remains decimal major while MCP numeric principal remains cents; the UI
submits `principalAmountMinor` and bypasses that ambiguity. Existing backend
currency qualification and production IRR gates are unchanged.

Useful life, monthly term, physical production units, basis-point interest and
depreciation rates, pagination counts and presentation percentages are nonmoney.
The bounded percentage helper converts only its clamped bigint ratio to Number.
Existing principal KPI semantics and backend schedule generation are preserved.

Malformed successful reads cannot enter state and show an English alert.
Malformed monetary mutation responses keep forms open and report errors. This
does not undo a server operation that already committed; refresh reconciles it.
No schema or REST/MCP operation change is needed.

`tests/asset-loan-ui-money.test.ts` guards alias rejection, fixed cents input,
signed low-digit output, aggregate display above Number range and all source
consumers. Six existing integration workers now validate actual successful
REST/MCP DTOs with the consumer adapter. Master/loan fixtures compose exact UI
input with independent SQL-text storage assertions at 29 and safe-max cents;
existing lifecycle, period, scope, replay and failure-snapshot assertions remain.
The inventory assigns scoped pages/helpers to MON-156, and obsolete scoped
legacy-helper allowances are removed. MON-008 final integration remains open.
