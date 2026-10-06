# MON-094 review 1 - implementing-assistant self-review

2026-10-06, Asia/Tehran. Actual reviewer: codex, same implementing assistant.
Kind: self. No separate peer/human/accounting or production approval.

Reviewed the complete task diff, wire/service/route/tool/client contracts,
dependency boundaries, negative cases, verification and manifest/inventory.
Approve the bounded MON-094 slice based on MON-094-attempt-1.md and actual tests.

- Exact cents aliases preserve units/range; bigint intermediates and classified
  preflight errors cover high rates, markup, fixed fractions, sums and signed
  cost/margin variance. Output failures occur inside atomic transactions.
- Every adopted operation uses shared scoped direct-DB REST/MCP semantics;
  old single register MCP behavior remains an adapter, with all input fields
  described. Public user projections exclude credentials. Contact report scope
  remains separate. No schema, new migration or production flag is needed.
- Missing/foreign roots and sources, wrong policies, dates, periods, currencies,
  nonidentity journal rates and billed registrations fail without lasting writes.
  Mixed project currencies require a filter. Signed manual net journal costs
  include null sources and exclude bill sources. Internal labor rates and explicit
  zero billable rates retain their documented meaning.
- Numbering, source allocation, invoice lines, project total, audit and returned
  outputs share organization/project-locked transactions. SHARE period locks close
  the concurrent period update gap. Audit and unsafe-return triggers and actual
  keyed/unkeyed/fixed races pass. Stable project IDs and expense subtraction fix
  name collisions and fixed overbilling. Name-only history rejects for explicit
  attribution, without migration or invented reconciliation.
- Added the missed expense-only currency-change reference guard in project master,
  qualified in both transports plus the existing full MON-093 integration worker.
  Default due dates that cross year 9999 fail schema preflight. The progress UI's
  financial preview uses exact sums/percent products and surfaces load errors.
- Verified final targeted 6/6, full pure 297/297, typecheck and lint (zero errors,
  existing warnings only), money inventory/legacy gates and clean diff formatting.
  Fixture databases were dropped and the synthetic cluster stopped.

No unresolved defect found within these contracts. Full-range/scale/FX costing,
historical repair, invoice lifecycle reversal allocation, independent accounting,
large-volume performance and production IRR remain separate. This review is not
parent MON-027 final integrated acceptance; its criteria remain unchecked.
