# MON-020 self-review 1

2026-10-09, Asia/Tehran. Reviewer: Codex implementing assistant, kind self.
Approve the bounded parent contract acceptance. This is neither independent
peer/human review nor financial/security/production qualification.

Reviewed task acceptance, the runtime/MCP/test/documentation diff and actual
verification outputs recorded in MON-020-attempt-1. The nine original child
inventories retain operation-level units/defaults/ranges. The new integration
registry states transport price differences, safe-number coexistence, quantity
and basis-point controls, error/atomicity guarantees and explicit unsupported
GRNI/FX/return/allocation paths. No cents-to-major relabeling, FX rescaling,
BigInt serializer fallback, schema/migration or production flag change.

Findings resolved:

- Linked service receipt debit allowances formerly failed because receipt UUID
  was treated as stock. Receipt scope/supplier/dimension validation and inventory
  classification permit supported service allowances. Foreign receipt history
  rejects. Bill-recognition journal pointers do not imply stock. Existing stock
  return regression cases still pass, including unsupported GRNI/partial returns.
- A GRN-created draft consumes receipt capacity without reserving the PO tally.
  PO conversion must not bypass it with an unmatched bill. The new selected-line
  guard accepts only active bills backed by this PO's qualified allocation events.
  Both operation orders and a concurrent REST/MCP race verify one conversion
  winner, stock unchanged and correct reservation release/retry. Existing partial
  PO rounding/allocation fixtures still pass. Unqualified mixed history rejects
  rather than inventing money allocations.
- Strict receipt/PO-conversion/debit service schemas were weakened to stripping
  by raw-shape MCP registration. Six full strict schemas advertise rejection and
  actual SDK tests reject unknown controls with unchanged business snapshots.
  Other documented CRUD/settings whitelisting semantics remain compatible.

Final checks: all ten parent/child procurement integration suites pass on
synthetic disposable PostgreSQL 18; 359/359 units pass; final typecheck passes;
changed-file lint is clean; full lint has zero errors/106 unchanged-path warnings.
Inventory reproducibility/Drizzle hashes and all nine legacy-money gate checks
pass. Controller structural validation and git diff whitespace checks pass.
The temporary server was stopped and zero fixture databases remain.

Independent financial assertions prove each journal balances and final expense
+2500, AP -2500, inventory +2500, GRNI -2500. The credit audit-failure injection
proves note/journal writes roll back together. Foreign/role/alias/schema/history
rejections preserve SQL-text domain snapshots. No unresolved defect within this
bounded acceptance. The conservative mixed-conversion guard is an intentional
supported-range restriction: void before switching entry points. Full-int64,
other inventory/settlement/export/PDF writers, foreign GRNI variances, external
configuration races and independent qualification remain their assigned gates.

Close MON-020, commit task-owned files, push user-authorized origin/master and
verify the remote commit and clean tree. Do not start the next task.
