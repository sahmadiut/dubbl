# MON-135 self-review 1

2026-10-11, Asia/Tehran. Reviewer: codex; kind: self. This is the same
implementation operator, not independent peer/human/accounting review.

Reviewed actual diff, ownership registries, adopted wire/REST/MCP implementations,
adapter/rendered tests, disposable SQL fixture and observed command results in
MON-135-attempt-1.md. Result: approve this bounded child.

- Every scoped money read validates canonical Minor aliases against safe legacy
  raw units before bigint UI arithmetic/display. Legacy-only fallback is checked;
  conflicting/unsafe input fails rather than rescaling or coercing. Display and
  input explicitly use source/base/document currency, preserving JPY/IRR/KWD
  scales and large USD low digits. Nullable base values and rejected summaries
  remain unavailable instead of invented totals.
- Payment history is deliberately document-currency allocation money, unlike
  recent payment-list money with its own currency. No FX is repeated. Bigint
  min/sums/ratios and bounded percentage conversion preserve arithmetic.
- Existing amountMinor/unitPriceExact schemas accept the new payloads. Actual
  authenticated REST and registered MCP operations agree with independently read
  SQL amounts and saved copy/PATCH dimensions. Custom fees are checked in all
  four currencies through real transports. Backend settlement guards remain
  unchanged and their existing domain workers passed.
- Inputs reject malformed/nonpositive/fractional-minor/unsafe text; buttons and
  handlers both validate. Real rendered output proves labels, decimal mode,
  aria-invalid, English alerts and exact source/base display. Generic input
  aria-invalid forwarding was corrected after the failing render assertion.
- Main detail money and credit fetches are context guarded/aborted, old context
  credit actions are hidden and balance mutations await complete refresh. These
  effects are source reviewed, not browser-interaction tested. Other metadata
  fetch behavior is not qualified by this child.
- Actual existing Edit sheet is a nonmoney snapshot editor; no nonexistent
  monetary UI edit path is claimed migrated. Copy uses saved raw prices plus
  source currency and preserves tax/discount/dimensions. PATCH/MCP draft editing
  is tested with that exact payload. Quantity/basis-point controls stay nonmoney.
- Shared numeric/currency-less compatibility callers remain explicit. Registry
  ownership and tests do not complete MON-131, MON-129 or MON-007. No schema,
  backend rounding, historical units, IRR flag or deployment changed. Initial
  fixture/type errors were corrected, with final scoped checks passing. Lint
  has zero errors and only existing warnings.

Limitations: SSR and source review are not live browser testing; safe numeric
workflow remains the backend limit. Synthetic IRR fixtures do not authorize
production enablement. No human financial or native Persian review is claimed.
