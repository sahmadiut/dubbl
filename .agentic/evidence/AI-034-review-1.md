# AI-034 self-review 1

2026-10-28. Reviewer: Codex, kind self. This is the implementation agent's own
technical review, not peer/human, provider, security-release or native-language approval.

Reviewed the new protocol module and behavior tests, contract documentation,
source traceability and controller split. No remaining finding blocks the bounded
AI-034 scope. Approve AI-034 only; AI-033/031/023/007 remain open.

- The builder cannot grant execution authority: it has no DB, HTTP, credentials,
  domain dispatch or generic public tool. Current discovery/lease authorization
  and actual usage reservation/settlement are explicit AI-035 obligations.
- Actual catalog schema projection and restoration preserve strict unknown-field
  rejection, domain defaults, nullable fields, dates and exact minor strings.
  Original schemas are unchanged. Request/response byte/depth/node ceilings and
  immutable request binding are tested. Review added traversal limits before
  serialization to bound cyclic/shared-object expansion.
- All returned calls wait for whole-response validation. Invalid later content,
  duplicate IDs/JSON keys, reasoning/hosted output, stale IDs and malformed arguments
  yield no calls/text. Usage remains independent so invalid content is not
  implicitly free. Unknown is represented by null and must stay reserved/charged.
- History IDs and durable seen IDs are combined uniquely; legitimate overlap
  does not consume the 20-ID ceiling twice. Original call/result pairing and
  domain validation prevent orphan or mutated historical calls from being sent.
- untrustedText deliberately carries no success/record-link authority. The future
  executor must create safe grounded summaries through current disclosure checks.
  The raw-response transport requirement and narrow unsupported protocol cases
  are documented rather than silently claimed as integrated capabilities.
- Final focused tests, typecheck and scoped lint pass. Full lint reports only
  20 pre-existing warnings; inventories and focused graph checks pass. The broad
  unit run was stopped and is not counted as a full-suite pass. No database,
  live provider, worker process, UI or production qualification is inferred.

AI-034-attempt-1.md records commands/results and the remaining AI-035/036 work.
