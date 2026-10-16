# MON-167 tax, tracking, consolidation and custom report UI

This child covers seven result pages. MON-162, MON-158 and MON-008 retain
independent combined acceptance. No REST/MCP schema, database schema, history,
currency metadata, IRR flag or tax policy changes are introduced.

| Consumer | Existing shared REST / registered MCP boundary | Adoption and presentation |
|---|---|---|
| `app/(dashboard)/reports/1099/page.tsx` | `reports/1099`; `report_1099`; `lib/reports/tax-reports.ts` | Required safe numeric/canonical Minor pairs, organization currency, threshold/reportability/count and exact vendor totals. CSV preserves raw minor strings and includes currency. |
| `app/(dashboard)/reports/tax-summary/page.tsx` | `reports/tax-summary`; `tax_summary`; same tax service | Required aliases for all displayed tax/net fields; signed bigint row and report totals; basis-point percentage stays numeric. |
| `app/(dashboard)/reports/vat-return/page.tsx` | `reports/vat-return`; `vat_return`; same tax service | Nine uniquely ordered boxes, aliases, signed Box 3/5 identities, explicit currency, existing basis/date drill links. |
| `app/(dashboard)/reports/tracking/page.tsx` | `reports/tracking-category`; `tracking_category_report`; `lib/reports/compound.ts` | Required aligned amount/totals/byColumn aliases, bigint row/column/section/net checks, explicit books currency; unassigned dimensions and ledger drill links remain. Server XLSX retains its existing currency-scale guard. |
| `app/(dashboard)/reports/consolidation/page.tsx` | `consolidation/groups/[id]/report`; `get_consolidation_report`; `lib/api/consolidation-report-service.ts` | Required totals and entity-map aliases, presentation-currency agreement, member-map ownership, exact summary/section/group sums. Entity figures precede elimination; consolidated totals follow elimination. CSV uses exact raw minor strings, currency and unique label/organization columns. |
| `app/(dashboard)/reports/custom/page.tsx` | `reports/run`; `run_custom_report`; `lib/reports/custom.ts` | Expanded read-only projection requests hidden numeric/Minor carriers and row currency; validates every projected monetary pair before adoption. Currency-aware displayed money; nullable limits stay unavailable. |
| `app/(dashboard)/reports/saved/page.tsx` | Same run operation using saved configuration; saved CRUD/export MCP tools remain | Same result adapter and hidden read projection, preserving saved filters/date range/configuration. Exact `Minor` columns and server CSV retain raw minor strings. |

`lib/money/report-result-ui.ts` holds pure browser-safe validation/formatting and
export helpers. `reportResultJson` rejects unsuccessful HTTP responses and
malformed money bodies before state adoption. Failed reads clear current result
state and show an English alert; tax/tracking failures do not masquerade as empty
activity. Consolidation and custom/saved runs reject superseded results; changing
builder source/columns clears results and invalidates its pending run.

## Retained units and limits

- Saved report amounts are safe numeric **raw minor integers**, with required
  matching canonical Minor strings. USD 1250 remains 1250; JPY/IRR 1250 displays
  1250; KWD 1250 displays 1.250. No stored rescaling or new FX conversion occurs.
- Derived UI sums use bigint, including sums beyond Number.MAX_SAFE_INTEGER.
  Individual saved dual carriers retain the existing safe numeric boundary.
- Consolidation translation follows its existing fixed/raw-unit backend contract;
  presentation only uses the saved group currency. Member totals need not equal
  post-elimination account totals. Existing CTA, rates and elimination behavior
  are preserved by real service regression coverage.
- Custom/saved explicit `*Minor` columns and existing CSV exports are raw integer
  strings. Normal monetary columns display each row's currency; unlike currencies
  are never summed. Projection additions are only for result reads and do not
  change saved configurations or server export contracts. Null credit limits
  remain null; quantity hundredths, counts, dates, flags and text are unchanged.
- `app/(dashboard)/tax/vat-return/page.tsx` remains the earlier MON-151 tax-workflow
  consumer; this slice changes the separate reports page. Tax periods/filings,
  statutory policy, sales-tax/BAS/Schedule-C/report-pack and other report families
  keep their existing owners. No new public feature or operation requires an MCP
  tool; the existing direct-DB registered tools remain authoritative.

## Evidence and guards

- `tests/report-result-ui.test.ts`: six behavior/static groups cover four currency
  scales, signed refunds, safe low digits, malformed/missing/conflicting aliases,
  HTTP/JSON errors, derived totals, tracking alignment, pre/post-elimination
  semantics, CSV exact strings/duplicate labels and custom nullable/Minor views.
- Extended `tests/integration/{tax-report,compound,consolidation-report,custom-reports}-worker.ts`
  consume actual authenticated REST and linked registered MCP bodies. Existing
  migrated fixtures preserve tenant/permission/input/rollback/export/concurrency
  failures and raw units. New independent SQL-text assertions reconcile 1099
  payments, tracking net income, translated low digits and custom source values;
  safe-max signed custom results feed both adapters.
- `money_inventory.py` maps these seven pages and shared adapter to MON-167;
  MONEY_BOUNDARIES/MONEY_COLUMNS are regenerated and verified. Five obsolete
  legacy UI allowances (15 allowance lines) are removed. Parent closure is not
  inferred from this child's completion.

See [execution evidence](../evidence/MON-167-attempt-1.md) and
[self-review](../evidence/MON-167-review-1.md). Browser/screenshot execution and
physical exports are not claimed; DEC-005 does not require screenshots.
