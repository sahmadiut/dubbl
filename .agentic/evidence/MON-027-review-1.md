# MON-027 review 1 - implementing-assistant self-review

2026-10-06, Asia/Tehran. Actual reviewer: codex, same implementing assistant.
Kind: self. No independent peer/human/accounting or production approval.

Approve the bounded parent contract integration based on actual source/diff,
the four child operation maps/evidence, new combined fixtures and final checks
recorded in MON-027-attempt-1.md. All three acceptance criteria have direct
evidence; child completion alone was not treated as parent acceptance.

- Reviewed 81 REST/MCP pairs plus the singular cost adapter, described shared
  schemas, safe canonical aliases, fixed cents, physical quantities, percent/hour
  units and returned-envelope compatibility. Strict/range failures occur before
  mutation or within the rollback-capable transactions.
- Verified actual cross-transport member/time rates, allocated time/milestones,
  project totals, pricing invoice snapshots, explicit CRM value transfer and
  currency-filtered totals. CRM transfer is a client action, with no invented
  deal-to-project conversion or accounting operation. Invoice/quote price units
  remain their existing distinct contracts, not silently reused for CRM cents.
- Review found the fixed-price reduction defect. The shared history helper now
  supplies the master guard under the existing organization/project locks.
  Both numeric and exact edits use the same guard, preserve valid equality and
  exclude recharged costs. 409 rejection preserves all combined state. Race
  assertions verify either reduction or allocation can succeed, without leaving
  remaining price negative. The helper uses scoped stable project IDs/live
  nonvoid history and the existing unsupported-history checks; it does not use
  a floating aggregate, project name attribution or totalBilled shortcut.
- Time-edit/invoice and tier-edit/invoice races share the expected lock order.
  Foreign refs/header scope, public member output, billed edit guards, keyed
  replay and injected audit rollback agree across child writers. Fresh child
  workers verify all operation pairs and faults; invoice/quote regressions pass.
- Inspected the small service diff: only helper sharing and pre-write fixed-price
  validation alter runtime behavior. Existing tools/routes inherit that behavior
  through the shared service; no new public operation, schema/migration, stored
  conversion, deployment or currency enablement is introduced. Typecheck and
  changed-file lint pass, full lint has its 127 existing warnings, all 297 pure
  tests and seven transport workers pass, final combined regression passes.

Documented limits remain explicit: aliases are safe-number coexistence rather
than full-int64 enablement; historical void/reversal allocation repair, untagged
history, FX costing, performance and independent financial/release gates remain
broader work. The serial migration rerun addresses disposable-cluster lock-table
capacity, not an application/deployment configuration change. No release or
production IRR qualification is inferred from controller completion.
