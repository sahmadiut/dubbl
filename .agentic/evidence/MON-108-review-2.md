# MON-108 self-review 2 - CI pagination correction

2026-10-07, Asia/Tehran. Reviewer: codex, kind: self; same implementing operator.
This is not independent human or peer review.

Inspected the failed fork CI job, deterministic pre/post SQL reproduction,
one-line shared query correction, expanded actual REST/MCP page assertions,
contract note, inventory and attempt-2 evidence. Both running SUM and row_number
now explicitly share the ROWS frame, preserving the page upper bound on the
supported PostgreSQL 16 baseline. Running balances still calculate over all prior
period lines before pagination; numeric/Minor, scopes and export behavior remain.

Tests reproduce the original defect and pass after the correction on PostgreSQL
16 and 18. They cover first/middle/end/maximum-offset pages and varying limits,
plus summary caps and full counts. No fixture assertions are relaxed and no CI
configuration is changed. Actual ledger fixtures retain money/range/isolation
and read-only snapshots; neighboring report fixtures pass PostgreSQL 16.

No unresolved implementation finding. Final local typecheck and changed-file
lint/money gates pass. Approve this bounded correction. New GitHub CI remains deliberately
unverified at handoff, honoring the explicit request not to wait for it.
