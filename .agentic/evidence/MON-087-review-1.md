# MON-087 review 1

2026-10-06, Asia/Tehran. Actual reviewer coding-assistant; implementing assistant's
self-review, without a peer/human or independent financial sign-off. Reviewed
the final diff, registry, focused PostgreSQL fixtures and observed checks.

## Findings and disposition

- All three operation pairs use the same direct scoped Drizzle services with
  strict described fields and wrapTool. Full registry checks show unique names;
  existing single/undo names remain. Batch tool is additive.
- Fixed cents and explicit Minor strings remain compatible. Calculator products,
  ratios and totals are exact at safe-max money and int32 life/usage. Known actual
  method/convention schedules, usage and non-GL fixtures retain residuals exactly.
- Shared organization/asset locking prevents stale master/lifecycle overwrites;
  same-month and audit-key retries serialize. Undo of an older entry rejects.
  Daily unkeyed rollback limitations are documented and the UI pins its target.
- GL rollback preserves posted history through linked opposite lines. Checked
  scoped accounts, original source/balance and transaction lock dates; inactive
  historical accounts work. Self-review added all original FX/dimension fields
  and compared returned lines to saved snapshots. The existing sync trigger
  cannot preserve arbitrary exact provenance; those cases fail atomically and
  are tested. New current-base GL and GBP original-line reversals are asserted.
- Audit and response failures roll back header/lines/schedule/totals together.
  Final-batch audit faults explicitly occur after processing, and snapshots show
  the entire batch reverted. Foreign journals, unsupported money/history/units,
  credential/permission errors and locked periods make no persistent changes.
- No schema/migration, posted history rewrite, rollout flag, dependency, deployment
  or unrelated user change. Removed duplicate handlers; existing legacy lifecycle
  amounts/audits remain scoped to MON-088/089, with only snapshot coordination here.

Final focused 5/5, typecheck and changed-file ESLint pass. Full lint has zero
errors/129 baseline warnings, broad regression passes 351/351 and inventory/legacy
gates pass. Later isolated FX/history changes were rerun in final focused checks.

## Qualification limits

Revalued asset depreciation is deliberately unsupported until MON-088 supplies
a carrying-base policy; the old writer altered NBV independently of original
cost/accumulated depreciation. Half-year/mid-quarter remain monthly approximations,
not statutory schedules. Zero rounded time-based charges do not advance periods.
Asset masters lack saved currencies/FX; first-GL/current-base behavior cannot prove
earlier unposted currency history. Period-table SHARE locks can delay other
organizations' period changes and large batches require performance qualification.
No PostgreSQL16/hosted CI, browser/session/OAuth, independent accounting, full-int64,
production migration/deployment or IRR enablement is claimed.

## Decision

Approve MON-087 as a bounded self-review. Documented unsupported economic/FX
snapshots fail cleanly instead of inventing history. Parent MON-026 retains
integrated and qualification gates; MON-088/089/090 remain uncompleted. Perform
the authorized commit/push, verify synchronization and stop after this task.
