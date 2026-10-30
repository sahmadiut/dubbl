# AI-036 self-review 1

2026-10-30, reviewer Codex, kind self. Reviewed the complete owned diff against
96b4da18 and actual checks in [attempt 1](AI-036-attempt-1.md). This is self-review,
not independent peer or human approval.

Approved for AI-036 combined local integration acceptance:

- New evidence composes actual polling processes, REST, registered linked MCP,
  deterministic raw providers and independent SQL. Fresh-process clarification,
  continuation, known-effect crash/recovery and shutdown retain receipts and
  original identities/configuration/deadline/provider/budget/price/reservations.
  Unknown usage remains charged and uncertain effects are never replayed.
- The regression found a real disclosure failure: domain reads could wait across
  grant revocation after the prior authorization check. The four-line shared
  reader change compares freshly authorized grants after all domain reads. Both
  REST and MCP reject the delayed response without releasing record information;
  a new snapshot correctly reflects restricted permissions.
- Observer reads remain free of execution mutations/dispatch/recovery authority.
  Whole-table hashes check runtime-off reconnect; execution cursors cannot cache
  revoked links. Provisional content is bounded server-authored status, distinct
  from confirmed live receipts. Model prose cannot establish results or URLs.
- Final affected integration tests, typecheck and scoped lint passed. The broader
  14-test run, protocol/schema/capability/coverage/locale/legacy gates and full lint
  are recorded with their timing/source boundaries. No unrelated repair, schema
  change, activation, Stripe work, build, dev server or live request is included.
- The historical money inventory remains red with the exact 1447-error baseline;
  all consumed paths are unchanged. Provider/hosting/browser/POSIX/hosted-CI and
  raw-token-stream qualification remain pending. AI-033/031/023/007 acceptance
  stays open; this task does not claim rollout or production readiness.

No unresolved defect was identified within the bounded task. Only owned files
will be committed locally; no push is authorized by this request.
