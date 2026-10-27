# AI-005 self-review

2026-10-27, Codex task_005, kind **self**. Same agent implemented and reviewed the
final metering change. No independent peer/human approval is claimed.

Reviewed exact arithmetic, immutable price/config snapshots, scope/access
checks, transactional admission/settlement, cancellation/retry semantics,
retention interactions and REST/MCP parity against AI-005's four criteria.

Resolved findings and negative evidence:

- Total usage and category subsets must not double-charge cached/reasoning
  tokens. Synthetic rate test verifies the exact category cost. Unknown fields
  remain null with conservative rates and per-category missing-count reports.
- A partial cached/reasoning observation can exceed the original reservation
  before totals arrive: increase conservative token/cost lower bounds, retaining
  unknown state/concurrency. Dedicated partial-overage fixture passes.
- A reused attempt key with changed input/output ceilings must conflict even
  if the total token count matches. Individual ceilings/config scope are pinned.
- Cancellation releases only a never-dispatched reservation; ambiguous dispatched
  attempts hold quota until trusted reconciliation. Concurrent admissions under
  org/user limits permit only one winner, and repeat settlement does not add rows.
- Settlement remains possible after actor revocation through a trusted internal
  callback; no API/tool lets the model submit counts or impersonate that scope.
- Existing administrative provider tests previously bypassed metering. They now
  require synthetic price+org/member budgets and test ledger rows for success,
  transport/response failure and both pre-request DNS errors.
- History metadata purging could remove unresolved attempt reservations through
  the new scoped cascade. Purge now retains such metadata; content erasure remains
  intact. Unknown-state retention and eventual scheduling are explicitly bounded
  later-runtime work, not silently treated as zero-cost expiry.
- Organization reports expose only aggregate counts/costs grouped by currency;
  member, foreign-org and current custom-role denials pass through actual REST
  and MCP/SQL paths. No credential/config snapshot/transcript data is returned.
- Restored an unrelated em dash after a PowerShell encoding rewrite; no unrelated
  text/Stripe/provider activation changes are intended in the final diff.

Acceptance: approve AI-005's shared metering/storage/admin/report boundary based
on recorded focused database integrations, typecheck, lint and controller checks.
No general executor, live/provider pricing qualification, UI, production rollout
or independent security/accounting acceptance is inferred.
