# MON-018 self-review 1

2026-10-08, Asia/Tehran. Reviewer codex, kind self; the implementing assistant.
No independent peer/human/accounting/security or deployment approval is asserted.

Approve bounded combined journal wire integration. Inspected the tool/source diff,
new combined worker, corrected recurring permission worker, complete inventory,
money manifest/README/test matrix, task handoff and actual final verification.
All three original parent criteria now have direct combined and child evidence.

Review findings and resolution:

- Full strict object schemas are necessary at the SDK boundary: downstream strict
  parsing cannot reject fields already stripped by raw-shape normalization. Both
  create/update tools now reuse the existing strict service schemas; templateId
  remains described, default currency behavior and omitted PATCH fields remain
  preserved. Advertised schema and actual unknown/date negatives are verified.
- Permission tests must use valid bodies for each operation. Corrected the child
  fixture instead of weakening strict schemas or accepting validation errors as
  permission proof; final child worker verifies actual 403 responses.
- Combined flow assertions preserve transport-specific units through manual/import/
  recurring writers, full edits, posting, recoding and reversal at safe-max. They
  do not infer a currency conversion or harmonize existing balance policies.
  Saved FX and reciprocal mirror links are read through both transports.
- Snapshot coverage spans all related monetary rows, schedules, import metadata
  and audit count. No-op run audit effects are explicitly distinguished from
  financial mutation. Child regressions retain rollback, concurrent generation/
  reversal and malformed-history checks; no child acceptance is weakened.
- No new feature operation requires registration elsewhere; existing index.ts
  registration remains correct. No schema file or generated migration is changed.
  Only task-owned files are present in the working diff; entry tree was clean.
- Final verification is 4/4 DB workers, 359/359 units, typecheck, clean changed-file
  lint, full lint with 0 errors/106 existing warnings, reproducible inventory,
  Drizzle/hash and legacy money gates, controller validation and diff checks.

No unresolved issue blocks MON-018 within its defined compatibility scope.
Full-int64 arithmetic, independent accounting, saved base-currency semantics,
scheduled execution, operational races, PostgreSQL 16, audit durability, browser/
HTTP/session/OAuth and production/IRR gates remain separately qualified work.
This review does not approve those deferred gates or authorize deployment.
