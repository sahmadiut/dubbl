# MON-121 self-review 1

2026-10-08, Asia/Tehran. Reviewer: codex, the implementing agent. Kind: self.
Decision: approve this bounded task after actual source/diff and evidence review.
No independent peer, human, accounting, production or parent-integration approval.

Reviewed the shared schemas/reader/CRUD/export, four REST routes, seven MCP tools
and full registration, migrated SDK/API-key fixtures, wire contracts and regenerated
inventory. Acceptance criteria are supported by MON-121-attempt-1.md.

- Related ownership guards are applied before projections, avoiding prior global
  payroll reads and foreign contact labels. Payroll report permission is enforced
  on both execution paths. Invalid API-key/header overrides cannot pick a tenant.
- Money uses existing guarded safe-number ORM values with bigint comparisons,
  matching exact strings and no new sums/scaling. Unsafe sources fail before JSON
  or CSV, including Minor-only clients; advertised range matches actual behavior.
- Unknown config fields, monetary literals, duplicate projections, nonempty groups,
  unavailable date ranges and stored corruption fail explicitly. Transactional
  stored-row/output preflight prevents PATCH/delete from overwriting unsupported
  history or committing an unrepresentable output. Infinite timestamps are checked
  in SQL because adapter parsing alone is insufficient.
- CSV and run share projections/filter/date dispatch, including expenses/payroll;
  empty headers and quoting are verified. New MCP operations all use wrapTool and
  direct DB services, with described input schemas and one operation per tool.
- Review retained REST delete request metadata and the post-deletion audit payload;
  final focused fixture, typecheck, changed-file lint and inventory gates passed
  after that adjustment. No broad new work, unrelated changes or schema edits.

Remaining limitations are documented: group aggregation is unsupported, exact-only
outputs still have the transitional safe range, invalid stored configs need separate
remediation, CSV preserves literal text, schedules/delivery remain MON-122, and
MON-105/other parents retain integration acceptance. Existing 111 repository lint
warnings are outside task files. No completion or push is asserted by this review
file; controller and Git steps follow it.
