# MON-090 review 1 - self-review

2026-10-06, Asia/Tehran. Reviewer: coding-assistant; kind: self.
Reviewed actual source/diff, task criteria, contract registry, actual transport
fixture assertions and recorded final verification. Not independent financial,
human, historical-currency, production or release approval.

## Findings and corrections

- Confirmed REST decimal major and MCP integer cents remain distinct; aliases
  normalize to exactly the same principal. Canonical/safe range and aggregate
  guards run before mutations. Huge decimal-major range failures are classified
  as compatibility errors instead of escaping as generic 500s.
- Verified rational PMT and interest rounding against independently specified
  fixture amounts, zero rate, final residual, max-safe values and 1200 periods.
  Unsafe or prematurely exhausted rounded schedules reject explicitly.
- Added year-zero/date-range checks and stable UTC legacy month overflow; no
  unrequested end-of-month convention or posted history rewrite.
- Confirmed all six operation pairs use direct shared org-scoped services and
  strict described MCP schemas; deletion has parity and posted-history protection.
- Added complete saved-schedule interest/date/PMT, source-journal and typed
  account/currency consistency checks. Foreign/corrupt/unlinked history fails
  closed, including legacy partial REST postings.
- Verified org-first locking, targeted/keyed cross-transport replay, concurrent
  create/payment and delete/payment outcomes. Bare requests deliberately retain
  next-payment semantics; dashboard now supplies a target.
- Added unchanged-root validation and compared returned exact GL/schedule/input
  values. Actual injected audit/root/schedule/line faults prove rollback of all
  rows and unlinked bank GL self-healing, rather than only preflight assertions.
- Confirmed two-tier periods/closed years and preserved bank statement balance;
  loan GL repayment does not invent generic payment allocations or funding.
- Verified exact client input/display/loaded totals and removed migrated legacy
  allowances. Full lint/typecheck/inventory/regression gates pass as recorded.

## Decision and limitations

Approve bounded MON-090 acceptance. Five pure groups and the actual PostgreSQL
transport worker pass finally; four related asset workers pass in the documented
expanded regression run. Changed-file lint is clean; full lint has 129 existing
warnings and no errors. The disposable database harness cleaned its random DBs.

No schema/migration or rollout flag changed. Loan tables still lack historical
currency snapshots; unlike scales/FX and unsupported history fail without guessed
rescaling. Full-int64, banking/settlement integration, performance and independent
financial qualification remain MON-026/MON-021/money/release gates. Controller
completion does not approve deployment or those parent gates.
