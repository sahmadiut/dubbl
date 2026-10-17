# LOC-001 self-review 2: CI migration fixture repair

2026-10-17 (Asia/Tehran), coding-assistant, self-review. Not independent peer or
human approval. Reviewed the failed GitHub job, local before/after reproduction,
fixture diff and [attempt 2 evidence](LOC-001-attempt-2.md).

The fix follows the existing explicit treatment of additive nullable columns.
Only the newly added organization locale key is omitted from its original-row
checksum. Every historical field, all 195 monetary columns, per-column null and
sum checks, original defaults/nullability, integer limits, migration rollback,
retry and independent restore assertions remain present. The added user/org
metadata and null checks reject silently populated preference columns. Rolled-back
negative cases prove the new exclusion does not hide a populated default or a
change to the organization's original name. Seven focused integration tests and
typecheck pass. The refreshed inventory changes only this fixture's hash/lines.

No application or workflow change is needed for this failure. No remaining
blocking source issue found. Approve self-review for LOC-001 requalification.
Replacement hosted CI has not run at the time of this pre-push review and must
be observed separately; local builds/dev/Docker were not run.
