# MON-028 review 1 - implementing-assistant self-review

2026-10-09, Asia/Tehran. Reviewer: coding-assistant; kind: self.
This is actual technical self-review of the diff, source and recorded checks,
not independent accounting, peer or human approval.

## Findings and disposition

1. Currency guard is organization-scoped and inside the settings transaction
   after the organization FOR UPDATE lock. It deliberately includes cancelled
   and unposted accrual roots because there is no currency snapshot. Accrual
   create/post/cancel share that lock; actual currency/create race has one winner.
   Existing same-currency edits and empty-org changes remain supported. MCP
   descriptions match both shared public writer operations. No monetary rescale
   or schema/history rewrite is introduced.
2. Report SHARE period/year table locks run before any serializable SELECT.
   The snapshot therefore observes insertions committed while lock acquisition
   waits. Deterministic tests observe pg_stat_activity lock waiting, commit each
   insertion, and assert 422 plus whole-slice unchanged state. Locking after the
   initial organization query would not satisfy this property. Retry handling,
   permissions, membership and parent period checks stay intact; GET stays pure.
3. Combined parent financial assertions exercise independent domain writers,
   actual transport units, residuals, journal numbering, GL balance/rates and
   report aliases rather than relying only on child completion. Recurring drafts
   remain outside posted earnings. Rule mechanics, saved replacement and deleted
   cleanup are tested without claiming validity of arbitrary elimination economics.
4. Whole-slice failure snapshots and all six existing regression workers cover
   audit/storage/history/authorization/scope/range/period failures. Final parent,
   focused pure tests, typecheck, zero-error full lint, money gates and diff check
   passed. There are no changed-source warnings and no unrelated entry changes.
5. Parent registry links all 31 operation pairs and the manual/job/settings
   boundaries to complete child field/units/ranges maps. Remaining configuration
   belongs to documented owners. Child accounting, FX, safe-range and calendar
   limitations are preserved; no production/full-int64/IRR/browser/provider or
   independent accounting qualification is claimed.

## Decision

Approve all three MON-028 bounded integration criteria. No unresolved blocking
finding. Cross-org period-edit contention from SHARE table locks remains an
explicit performance limit; unrelated economic and production qualification
gates remain open. Completion of this parent does not complete those gates.
