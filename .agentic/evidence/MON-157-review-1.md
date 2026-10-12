# MON-157 self-review 1

2026-10-13, Asia/Tehran. Reviewer: coding-assistant. Kind: self, not peer or
human. Reviewed the actual diff, domain contracts, consumer/unit mapping,
behavior/static tests, REST/MCP/SQL fixtures and observed check results in
[attempt evidence](MON-157-attempt-1.md).

## Findings and resolution

- Budget saved pairs require canonical exact aliases and safe numeric agreement
  before adoption; bigint state prevents precision loss in sums/cancellation and
  differences. Signed distribution conserves totals and preserves floor policy.
- Invalid annual/period drafts stay visible, block submission and reindex after
  line deletion; controls expose labels/aria-invalid. Review corrected hidden
  negative totals/spend and added a static guard against their reintroduction.
- Missing/failed reports no longer become invented zero balances. Project/CRM
  saved reads and nested billing previews reject missing/invalid amount pairs;
  required preview and generated-invoice fields are checked explicitly. Preview
  and project invoice responses retain their numeric-cents contract.
- Fixed cents, current budget organization labels, saved project/deal/price-list
  currency, nullable rates, physical minutes and percent/count exceptions remain
  distinct. Accrual REST-major ties and MCP cents match the independent SQL result;
  replay returns the same schedule without writes.
- Charts use approximate geometry with exact tooltip payloads. Per-period display
  uses an exact floor helper without allocating a whole distribution on each render.
- No schema, DB migration, API or MCP registration change is needed. Shared drawer
  sections and the progress report caller are mapped; other report/public/background
  consumers and MON-008 parent acceptance remain independently open.
- Actual domain regressions and the six new workflows pass. Final unit suite is
  503/503; typecheck, final scoped lint, full lint, inventory/legacy guards and diff
  validation pass. Remaining full-lint warnings are outside changed consumers.

## Decision

Approve MON-157's three scoped criteria based on this evidence. No unresolved
mandatory slice finding remains. This is not independent accounting, browser,
production, locale/RTL, PostgreSQL 16 or full-int64 qualification. No other task
is completed by this approval. Commit/push is authorized by the user's request;
verify controller integrity, task-only staging, remote SHA and clean tree afterward.
