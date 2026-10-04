# MON-077 implementing-assistant self-review

2026-10-05, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer, human accounting/security or deployment
approval is inferred. Reviewed implementation diff, registry, generated additive
migration, new fixtures/results and previous inventory/procurement regressions.

## Findings and checks

- Numeric money compatibility remains explicit: legacy landed component major
  numbers scale by 100 using exact decimal spelling/rounding; amountMinor carries
  canonical stored integer units. Aliases must agree and the safe-number bridge
  rejects larger syntactically valid exact inputs before mutation. Inputs, source
  joins, saved outputs and aggregate overflow fail through existing wrappers.
- Every component allocation is conserved using floor shares and largest
  remainders; stable PO order breaks ties. Item rollups and GL debits equal the
  batch, with a single clearing credit. Runtime fixtures verify line totals and
  balanced journals, duplicate item lines and differing quantity weights.
- FIFO carrying residuals survive capitalization and final issue across one/two
  layers. Original unitCost and historical consumption remain unchanged; new
  consumed value is stored explicitly. Master preflight and bill receipts/reversal
  use authoritative values. Additive nullable schema migration has no backfill;
  pinned pre-0008 fixture verifies original saved layer columns unchanged.
- Actual REST/API-key/custom-role and SDK in-memory MCP fixtures cover both client
  representations, all eight operation pairs, source ownership and corrupt joins,
  locks, read/write permission barriers, repeated allocation and one-winner races.
  Four audit-trigger failures prove whole-transaction rollback. Report safe
  aggregate values beyond int32 and unsafe stored int64 failures are asserted.
- Final self-review added stored by_weight read/reject/update, standard/service
  negative cases, zero-cost no-journal case and pinned the historical migration
  checkpoint. Final tests passed after those additions. Reviewed report UI table
  columns/CSV order and corrected preexisting API field mismatches; exact display
  no longer rounds safe integer values through binary division.
- Full unit/typecheck/lint and the final combined 14 tests passed. The earlier
  six parallel migration failures were traced to PostgreSQL lock-table shared
  memory and resolved by a clean concurrency-2 rerun. No failure is described as
  passed. Final lint has no new warnings; changed detail page retains its existing
  unused router warning (part of the full 143-warning baseline).

## Scope and decision

Approve all three MON-077 criteria within the documented supported contracts.
Service/standard/exhausted/foreign-currency/history/weight/manual allocation
restrictions are explicit errors, replacing silent loss or fallback. Capitalization
still targets current on-hand stock for source PO items; it does not invent
shipment-unit reconstruction. FIFO/standard value-only adjustments remain
unsupported, and procurement receipt divisibility was not relaxed.

Full signed-int64 ORM/business range, IRR activation, combined assembly/inventory
acceptance, historical remediation, independent human reviews and production
release remain assigned tasks. No human review, rendered browser, OAuth/HTTP MCP
server, clean CI/PostgreSQL16 or production migration is claimed. Controller
closure does not enable rollout flags. Next MON-078 after authorized commit/push.
