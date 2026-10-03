# MON-042 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review,
not peer/human/accounting/security/production approval.

Read actual new wire/services/stock helpers, route/tool adoption, registration,
UI payload/summary changes, schema/FX/number/period/audit dependencies, final diff
and executable unit/authenticated REST/SDK assertions. Compared the task and
dependency/ADR-006 requirements against the final contract registry/evidence.

- REST decimal-major and MCP integer-minor prices remain distinct. Credit
  extended-price rounding preserves its own policy; bigint products/tax/sums and
  explicit aliases do not reuse quote price-first behavior. Monetary versus
  physical/basis-point fields are documented and safe-range boundaries tested.
- Numeric envelopes remain compatible with additive exact strings. Summary
  preserves totals above int32 and visibly rejects mixed currencies or unsafe
  rows/sums; UI represents that error and uses declared summary currency.
- Arbitrary PATCH fields no longer bypass tenant/status/total checks. Draft
  create/replace/delete and number effects are atomic. References, saved amounts,
  dates, locked periods and currency/customer links are validated before commit.
- Own posted recognition is required for credit application. Notes offset AR
  once; customer credits post cash once and move deposits to AR when applied.
  Exact posting preserves compatible FX; note void mirrors saved FX/base amounts.
  Customer application-date FX retains its explicit MON-021 carrying-value limit.
- Carrier ownership, exact allocation/balance agreement and invoice restoration
  reject corrupt/foreign/unsafe history. Org/document locks prevent duplicate
  send/void and concurrent overdrawing in these services. Fault snapshots cover
  early and late failures, including GL, stock, carriers and auto-linked bank GL.
- New stock returns/COGS retain original quantities/costs. Void survives later
  invoice/average-price changes, with FIFO/warehouse consumption guards. Historical
  unlinked returns and full tracking/base-regime/external-writer qualification
  stay explicitly assigned, without inventing retroactive snapshots.
- REST requested email is validated before commit/provider work; actual provider
  delivery follows commit and has a documented separate retry limitation. MCP
  tool names/registration/direct-DB/AuthContext/wrapTool/descriptions are retained,
  with new draft update/delete/summary and available-credit parity.

The final credit worker passes after recognition/unsafe-carrier/bank/stock rollback
additions. Combined credit/invoice-write/invoice-lifecycle workers pass 3/3; full
pure suite 125/125, typecheck and targeted lint pass. Full lint has zero errors
and 159 existing warnings. Controller tests ran 32: 31 passed, one skipped for
Windows symlink privilege; Linux CI retains that case. Inventory reproducibility/
Drizzle verification and diff check pass. Synthetic fixture database count is zero
and server stopped. No failed exploratory command is counted as a passing check;
its repair and final outcome are in attempt evidence.

No remaining blocker in the bounded MON-042 slice. Approve all three acceptance
criteria within the documented safe-number coexistence range. MON-019 retains
combined receivable acceptance; MON-021/024/007/008, QA, PDF/UI/providers and
financial/production gates remain unchanged. No schema, configured DB, IRR flag,
deployment or independent approval is inferred. Next task: MON-043.
