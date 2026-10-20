# LOC-081 Codex self-review

Reviewer: Codex. Kind: self. Date: 2026-10-20 (Asia/Tehran).
Scope: employee detail catalog extraction and presentation response checks.
This is not an independent peer, human, native linguistic or accounting review.

Reviewed the production diff, 92 paired messages, actual REST/MCP envelopes,
money inputs/display, fixture changes and
[attempt evidence](LOC-081-attempt-1.md). Final verification: 1,159 unit/static tests, 14 focused checks and five
migrated checks passed; final typecheck, catalog validation, owned/full lint,
money guards, controller validation, diff and local-path checks passed. Full
lint has zero errors and 59 pre-existing warnings; owned files have none.

## Findings and disposition

- All authored detail copy is catalog-backed. The AST source-copy audit checks
  JSX text and display attributes; enum values/URLs/headers/identifiers stay
  canonical. Caller names and saved policy/deduction/band names remain escaped
  data. The inventory explicitly retains structural symbols, money/date/count
  presentation and shared-control ownership.
- Confirmed the leave route returns data, whereas the old page inspected
  leaveBalances. The new reader consumes the actual REST envelope; migrated
  MCP tests explicitly adapt its existing balances wrapper and flattened
  policyName/leaveType fields without changing either transport contract.
- Confirmed employee PATCH omits member relations while GET includes them;
  checked responses permit the omitted relation and validate it when present.
  Required displayed fields and money aliases are checked before state adoption.
- Raw backend/parser/network prose no longer reaches the page or toast. Failure
  callbacks retain profile/tax form fields, release saving flags and never
  navigate or claim deletion success. Missing-org/storage paths finish loading.
  Read-effect cleanup suppresses late state adoption and does not launch
  secondary reads after an unmounted initial employee response.
- Exact canonical cents strings, basis points, allowance counts, fractional
  hours, statutory codes, Gregorian dates, currency/ID/header/route/method
  values and shared authorization/services are preserved. No schema/migration,
  ledger calculation, statutory rule, FX/IRR flag or Stripe change occurred.
- Focused tests render real production JSX through PresentationProvider and
  exercise callbacks, rather than merely asserting catalog strings. Portal/
  currency controls and hooks/IO are controlled, so these are not mounted
  browser, keyboard or complete RTL tests.
- Checked generated money inventory sections: only scanned paths and source
  consumers changed; schema_columns, method and pattern classifications match
  entry HEAD. Parent completion is not inferred from this child.

Disposition: approve for this bounded child, supported by the completed
verification above and the documented limits. The controller records this as
honest self-review. Persian wording and complete native/RTL/browser/output/
release qualification remain separate.
