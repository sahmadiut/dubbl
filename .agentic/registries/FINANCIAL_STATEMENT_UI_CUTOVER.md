# Financial statement UI money - MON-161

Bounded child of MON-158; MON-158 and MON-008 retain independent final acceptance.
Runtime adapter: `lib/money/financial-statement-ui.ts`. Existing authenticated
REST and org-scoped direct-DB registered MCP services remain the public operations.
No duplicate endpoints/tools, schema migration, posted-history rewrite, IRR flag
or production/provider action.

| Consumer under app/(dashboard)/reports | REST / MCP | Saved units and adopted behavior |
|---|---|---|
| trial-balance/page.tsx | trial-balance / trial_balance | Fixed-two decimal aliases agree with canonical Minor strings. Natural-sign debit/credit/balance splits, comparison lengths/primary fields and dates validate. Bigint per-date sums preserve digits above safe Number. CSV uses explicit currencyCode and debitBalanceMinor/creditBalanceMinor. |
| balance-sheet/page.tsx | balance-sheet / balance_sheet | Fixed-two row/section aliases, comparisons and bigint section sums validate. Saved raw units display at explicit currencyCode scale; no parsing formatted money. |
| comparative-balance-sheet/page.tsx | balance-sheet / balance_sheet with compareDates | One repeatable-read response for all dates. UTC current date and immediately preceding month ends (including prior year/leap day); accountId identifies rows, including synthetic earnings with blank code. Bigint differences and exact Minor CSV columns with currencyCode. Missing columns fail as a whole. |
| income-statement/page.tsx | income-statement / income_statement | Fixed-two aliases for accounts/section totals/netIncome; check sums and revenue minus expenses. Explicit report currency display; dates/year selectors are nonmoney. |
| profit-and-loss/page.tsx | profit-and-loss / profit_and_loss | Numeric minor and canonical Minor pairs; validate rows/totals/netIncome and optional comparison. Bigint state; explicit report currency; CSV balanceMinor and currencyCode preserve raw units. Existing basis and filters stay intact. |
| pnl-comparison/page.tsx | pnl-comparison / pnl_comparison | Numeric minor and Minor pairs for rows/totals/changes; verify changes against previous period. Percentage fields remain finite numeric nonmoney outputs under the existing backend rounding/range policy. Approximate chart coordinates derive from explicit currency scale; tooltips use original bigint values. |

## Boundaries and failures

Saved money remains in the existing +/-9007199254740991 numeric compatibility
range. Fixed-two REST strings are aliases of those raw integers independently
of ISO scale: `12.50` with `1250` remains 1250 raw units for USD, JPY, IRR and KWD.
Display alone applies the explicit report currency scale. There is no inferred
currency, rescaling, FX or mixed-currency client aggregation. Backend aggregation
retains its existing current-base/raw-history convention; this is not a repair
or qualification of legacy cross-currency ledger history.

Bigint UI sums/differences can exceed safe Number without narrowing. Display
uses exact integer/fraction formatting. CSV monetary cells are canonical raw
Minor text with an explicit currency column; no numeric spreadsheet precision
promise is added. PDF/XLSX services and their existing export bounds are reused.
Only chart coordinates/axis abbreviation, percentages, month/year and period
counts remain numeric. Tooltips, cells and financial totals never read chart floats.

All six pages validate successful responses before state. Non-OK responses,
missing/conflicting/noncanonical/unsafe aliases, bad currencies, inconsistent
totals/splits and comparison dimensions produce English ErrorState with reload;
they cannot become zero/partial report rows or leave stale exports visible after
failure. Pending stale responses cannot replace current state after cancellation.
Tables retain horizontal overflow, filter labels and English controls. DEC-005
allows source/accessibility review; no live browser or screenshot claim.

Trial balance preserves the backend's assigned natural-sign presentation defect:
revenue/liability natural-positive balances still appear in the debit column.
PAR-008/QA-001 retain the accounting correction. No parent criterion is removed.

## Evidence and guards

- `tests/financial-statement-ui.test.ts`: exact safe-edge display in USD/JPY/KWD/
  synthetic IRR, negative subunits, bigint sums, aliases/aggregates/columns/deltas,
  exact CSV/chart source values, failed JSON/HTTP and UTC calendar behavior.
- `tests/integration/financial-statement-ui.test.ts` and worker: real five REST/
  linked registered MCP responses compose through the browser adapters; literal
  SQL text asserts 9007199253000001; four report currencies, exact comparisons/
  sums/CSV/tooltips, foreign/denied access, corrupt DTO rejection, persisted
  overflow and unchanged ordered SQL-text journal/account/audit snapshots.
- Existing cumulative-statement, period-statement and financial-report-integration
  workers independently retain auth/query/history/base/export compatibility.
- Scoped source tests prevent monetary floats/unvalidated JSON and chart-tooltip
  narrowing. Removed legacy helper allowances prevent reintroduction; regenerated
  MONEY_BOUNDARIES ownership/hashes preserve generator and Drizzle checks.

Other reports remain MON-162; contacts/dashboard/shared helpers remain MON-163.
Public/provider/general export/render qualification remains MON-160. Parent,
full-int64, native Persian wording and production acceptance remain separate.
