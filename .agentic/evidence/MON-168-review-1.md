# MON-168 self-review 1

Reviewer: Codex, self-review, 2026-10-16. No peer/human review is represented.

Reviewed all eleven page diffs, shared validators, saved backend contracts, seven
REST/MCP/SQL fixtures, CSV/tooltip sources, source ownership and legacy allowances.
Verification results are in [attempt evidence](MON-168-attempt-1.md).

Findings resolved:

- Required numeric/Minor aliases now validate before projection and state.
  Missing, noncanonical, conflicting or unsafe money cannot silently become zero
  or empty success. Currency is explicit; unlike bank/calendar currencies remain
  separated. Supported unexpected row currencies must agree with their report.
- Monetary state and signed absolute values use bigint; chart tooltips read
  exact source values. Bank review sums can exceed Number safe range without
  losing units. CSV retains its intended raw-minor/exact-decimal contract and
  always carries currency. Failed/loading reads suppress CSV result data.
- Vendor spend and financial-ratio underlying balances no longer default to
  USD. Vendor filtering uses existing REST/MCP currency contracts. RatiosExact
  values are checked as decimal ratios, never interpreted as money aliases.
- Shared MON-163 forecast validation is reused, preserving its strict week/net
  checks and existing dashboard regressions. Pack/schedules/budget-vs-actual were
  inspected and retain their existing server/export or earlier exact adapters.
- Actual REST and MCP success bodies pass the same validators; SQL-text checks
  tie adopted amounts to independent stored values. Negative HTTP/JSON and alias
  tests, authorization/isolation/unsafe data and existing export checks remain.
- Intermediate typing/lint issues were corrected. Final typecheck, task lint,
  full lint (zero errors/81 unrelated warnings), 550 unit/static tests, seven
  focused integrations and inventory/legacy guards pass. No unrelated source
  changes are included.

Acceptance: approve this bounded child. No unresolved MON-168 finding remains. MON-162, MON-158 and MON-008 remain open for independent combined
acceptance. No browser layout, physical export, CI or production claim follows
from this self-review, consistent with DEC-005 and the repository build rules.
