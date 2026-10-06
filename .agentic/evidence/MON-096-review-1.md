# MON-096 self-review 1

2026-10-06, Asia/Tehran. Reviewer: codex, implementing-assistant self-review.
This is not independent peer, human accounting or deployment approval.

Inspected the final consolidation report/configuration loader/translation/wire
and REST/MCP diff, source inventory changes, registry contract and actual
fixture results against all three task acceptance criteria.

## Findings and corrections

- Replaced every report monetary Number aggregate/product/cap/drawdown with
  exact text-to-bigint arithmetic. Safe numeric conversion occurs only during
  DTO preflight. Nested/entity overflow and int64 aggregate overflow are 422.
- Both read/recalculate transports load the group, current member access and
  report in the same transaction. GL account ownership and cap document/contact
  ownership joins exclude foreign references; configuration public projection
  is reused. Actual revoked/deleted member and foreign-root fixtures pass.
- The initial recursive alias mapper changed dynamic entity-map keys. Corrected
  it to preserve numeric maps and add only a separate exact map. Pure signed
  boundary/map fixtures and actual REST/MCP parity now pass.
- Per-entity CTAs were previously omitted when their group total was zero.
  Inject each entity's adjustment while permitting a zero-total CTA row;
  actual opposite-CTA fixture verifies per-entity and group balance checks.
- investment_equity now matches the existing configuration description's stub
  promise and is skipped. Malformed saved FX fails instead of silent fallback.
  Group/fallback rates preserve exact direction and reject lossy numeric aliases.
- Persistence previously left stale rule entries and had no MCP/audit parity.
  The shared serializable service replaces the complete period set, validates
  stored values, audits atomically, and coordinates with parent config locks.
  Audit/storage faults prove rollback; actual retries/deletion/currency races
  and parent period/closed-year checks pass.
- Repaired comment encoding introduced by a local read/write script. Final
  changed TS lint and typecheck are clean; source hashes match final content.

## Decision

Approve technical task acceptance. Focused 5/5, full unit 300/300, typecheck,
lint (127 existing warnings, no errors/new changed-file warnings), inventory
and legacy-money gates pass. No schema/migration or deployment gate is implied.

The symmetric invoice/bill cap assumption, no-positive-cap matched-min fallback,
custom/overlapping prefix rule accounting and informational variance remain
explicit pre-existing accounting limits. balanceCheck reports residuals; this
review does not assert universal financial correctness for arbitrary rules.
MON-028 combined integration and wider accounting/money qualification remain
their own tasks. No remaining finding blocks MON-096's bounded exact contracts.
