# MON-128 review 1

2026-10-10, Asia/Tehran. Reviewer: coding-assistant, kind self. Implementing model
reviewed its own diff/source/test results; no peer/human independence is claimed.

## Findings

- Canonical roundRatio retains signed ties toward positive infinity; there is
  no decimal/currency scaling inside ratio arithmetic. Input amounts and final
  number projections fail closed; bigint intermediate products/cancellation and
  residuals retain low digits. Pure tests reproduce the former one-unit error.
- Invoice/credit source sums guard before headers. The retained bill helper now
  uses one executor/transaction for all header/control/line writes and cleanup;
  its independent overflow snapshot verifies rollback. Other changed transaction
  helpers use their existing caller transaction. This does not promise universal
  atomicity for all historical helper/configuration callers.
- FX guards preserve int32-millionth rates and domain/manual-journal narrower
  caps. The retained scalar helper is distinguished from current currency-scale
  aware document posting. Mirror reversals preserve saved original amounts/FX
  after quote changes; unsupported sums and money fail without new writes.
- SQL VAT sums retain text until checked bigint projection. Physical quantity
  rounding remains explicit; fixed-two REST journal/import representations are
  documented compatibility exceptions, not currency-scale inference. No schema,
  unit/history rescale, default currency or production IRR flag changed.
- No new public feature requires a new operation/tool; existing REST/MCP share
  adopted services and error mapping. Real authenticated handler/full-SDK family
  regressions cover boundaries, tenant/role/lock guards, allocations, replay and
  concurrency. New helper tests do not misrepresent retained exports as live
  transport flows. Contract links and current inventory resolve correctly.
- Self-review fixed the residual fixture's chosen numbers: the original test
  conserved totals but did not actually force a residual. Final odd-credit data
  now forces a one-unit correction and passes. Final 4/4 focused unit check and
  refreshed inventory follow that test-only change; production remained unchanged.
- MON-007 could not honestly complete while core journal/editor UI used floats
  and fixed-two money. Split children retain those consumers as MON-129, the
  parent's original three unchecked criteria and independent final acceptance.
  This delivery approves only MON-128's bounded backend scope.

## Verification and result

New migrated posting fixture 1/1, selected integration regressions 14/14, pure
suite 375/375, final corrected posting tests 4/4, typecheck, changed-file lint,
full lint (0 errors/104 existing warnings), inventory/legacy gates, source/link
review, controller validation and diff checks passed. Dedicated synthetic server
contains zero fixture databases and was stopped successfully.

Approve MON-128 for scoped completion. No unresolved scoped blocker or claim of
full-int64 public/IRR rollout, financial/security/human approval, all-consumer/
parent completion, production migration, live-provider/visual or hosted CI parity.
