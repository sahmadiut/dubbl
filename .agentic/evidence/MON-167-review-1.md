# MON-167 self-review 1

Reviewer: Codex, self-review, 2026-10-16. No peer/human review is represented.

Reviewed seven page diffs, pure adapters/export helpers, existing backend wire
contracts, extended REST/MCP/SQL fixtures, source ownership and removed legacy
allowances. Final unit/static, focused integration, typecheck and lint checks pass
as recorded in [attempt evidence](MON-167-attempt-1.md).

Findings resolved:

- Report results previously accepted error bodies or numeric amounts without
  exact alias validation. Adapters now reject before state adoption, and failed
  loads clear results and expose alerts rather than successful empty reports.
- Implicit USD formatting and numeric grouped consolidation sums are replaced
  with saved currency and bigint. VAT refunds retain their sign and scale.
- Tracking arrays require aligned aliases and reconcile row, section and net
  totals. Consolidation validates entity maps and totals while preserving the
  intentional pre/post-elimination difference.
- Custom/saved projections can omit currency or select only a Minor alias. Read
  projections now request hidden carriers/currency; saved configurations/CSV
  contracts remain unchanged. Null limits remain unavailable; different currency
  rows are never aggregated. Explicit Minor cells remain raw integer strings.
- CSV bigint values serialize as canonical strings; currency is included and
  duplicate entity names cannot overwrite columns. Behavior regression covers
  pre/post-elimination export values and duplicate names.
- Superseded consolidation/custom/saved runs are guarded. Builder source/column
  edits invalidate pending results so older columns cannot appear under new ones.
- Initial lint/typecheck issues were fixed and final checks rerun. Scoped files
  have no lint warnings; unrelated full-lint warnings remain untouched.

Acceptance: approve this bounded child. No unresolved finding within MON-167.
MON-162, MON-158 and MON-008 remain open for independent integration acceptance;
no new statutory policy, accounting review or production qualification follows
from this review. Runtime report adapters and existing MCP services are covered;
browser layout/physical exports were not executed, consistent with DEC-005.
