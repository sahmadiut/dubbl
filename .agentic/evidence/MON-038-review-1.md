# MON-038 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review,
not independent peer/human accounting/security/deployment approval.

Approved within the invoice read slice. Reviewed all three adopted GET routes,
shared read/wire services, list/get/new-summary MCP registration, actual pure/DB
fixtures, public docs, boundary registry and controller split. MON-019 retains
unchanged combined acceptance; no invoice write/lifecycle completion is asserted.

Correctness findings resolved before completion:

- Preserve actual response envelopes and safe numeric stored units, with explicit
  additive aliases. Nested quantities/discounts stay their physical/basis units;
  contact credit limits stay in contact currency; allocations stay document units.
- Guard foreign nested contact/account/tax/payment references before returning
  labels. Parent scoping alone cannot establish historical child ownership.
- Remove summary int32 narrowing and Number aggregation. SQL text, bigint sums,
  mixed-currency rejection and individual/bucket/total guards prevent silent loss;
  signed offsets do not allow an unsafe positive aging bucket to pass.
- Classify arbitrary-size intermediates before the int64 bridge so oversized FX
  products/SQL sums return the declared 422 error rather than an unclassified error.
- State that base FX is an issue-date display lookup, not persisted posting FX.
  Report the exact six-place rate used; retain missing-rate nulls. Reject unsupported
  scales/products and preserve signed legacy rounding through exact ratio math.
- Keep authenticated-member read policy, actual MCP `{invoice}` detail behavior
  and direct-DB AuthContext/wrapTool conventions. The existing invoice registration
  in tools/index covers the new summary operation; every nonempty schema field is
  described. Invoice mutation handlers/calculations and other tools remain unchanged.
- Fix the fixture row-array type found by tsc without changing runtime assertions.

Evidence records 111 full unit passes, final actual invoice REST/MCP PostgreSQL
worker passing, typecheck/full lint passing (159 existing warnings), inventory
reproducibility/Drizzle/hash/line verification and diff checks. Final targeted lint
is clean; controller regression has 31 passes and one Windows symlink privilege
skip out of 32 cases. This is orchestration evidence, not financial qualification.
Synthetic PostgreSQL
server is stopped with no remaining fixture databases. Failed/interrupted exploratory
checks are disclosed and not counted as passing results.

Limits: safe-number coexistence remains mandatory, with no full-int64 exact mode;
mixed-currency summary and unsupported base display require 422 handling. Summary
alone is snapshot-qualified; concurrent detail/list queries and future domain/HTTP/
OAuth/browser/frontend/accounting/production checks remain their own gates. Opaque
snapshots, saved posting FX and all writes/lifecycle/bulk/templates retain ownership
outside MON-038. No schema/migration/configured DB/IRR flag/provider/deployment change.
