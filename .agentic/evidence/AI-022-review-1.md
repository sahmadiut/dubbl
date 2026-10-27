# AI-022 self-review 1

Reviewer: Codex task_007, self review,2026-10-27. No independent/human approval.

Reviewed lifecycle service, migration, route/MCP parity, changed persistence guards,
capability disposition, real DB fixture assertions and AI-007 split boundaries.

Findings addressed:

- No client/model policy, provider, principal or organization fields are accepted.
  Snapshots are derived from authenticated default configuration and both policies.
- Reusing a request key for different trimmed input conflicts; writes are atomic.
- Admission serializes capacity, rotates fencing tokens per claim and never resets
  the execution deadline on recovery. Heartbeats cannot revive expired/stopped work.
- Stop is available while runtime is disabled; executing effects are not claimed
  rolled back. Durable uncertain outcomes cannot auto-requeue. Partial record IDs
  and unknown billable usage survive retention and process restart.
- Raw malformed JSON cannot enter generic server logs through the submission route.
  Public status/events exclude credentials/worker tokens/private reasoning.
- New lifecycle controls remain outside the business tool allowlist. Only seven
  reviewed existing business tools are supported, not all812 inventoried operations.
- Existing AI-003 step primitives now reject starting new work after stop. Retention
  processes bounded conversation batches while preserving unresolved metadata.
- Split parent criteria are unchanged and unchecked. Actual provider/tool execution,
  worker hosting, fairness qualification and live-provider rollout are unimplemented
  in this child and explicitly remain AI-023/AI-007/AI-013 work.

Acceptance: approve AI-022. Final recorded lint/typecheck/focused rerun results
and isolated-cluster cleanup are confirmed in attempt1.
This is technical self-review of lifecycle primitives, not production, provider,
financial, accounting, native, security-human or release qualification.
