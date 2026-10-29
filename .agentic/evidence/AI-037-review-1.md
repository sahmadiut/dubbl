# AI-037 review 1

Reviewer: Codex, self-review, 2026-10-29. No independent peer or human review.

## Findings and repairs

- Confirmed the original broad AI-035 acceptance remains unchanged and unchecked.
  AI-037 owns the single-turn metering/fencing boundary and AI-038 owns the actual
  loop. Neither child accepts provider availability, hosting or runtime rollout.
- Reviewed run -> budget -> attempt lock composition, atomic reservation/dispatch,
  duplicate-key ownership, immutable original price/output/budget limits, current
  restrictions and pre-dispatch compensation. A charged dispatched attempt cannot
  become a zero-cost pre-dispatch cancellation. Recovery/erasure preserve unknown
  charges and permit only newly charged provider attempts, never replay old keys.
- Added canonical call/digest binding shared with AI-032, tool/provider mutual
  exclusion and unresolved-call blocking. Only a fresh accepted transient receipt
  carries original executable args; persisted redacted metadata is not replay
  authority. The future loop must explicitly fail/reconcile a lost handoff.
- Tightened live disclosure-envelope checks after lock waits even when some tools
  remain discoverable; original budgets/output limits cannot grow through later
  policy increases. Typed transport errors are still checked against a finite
  runtime allowlist, preventing malformed exception codes from leaking diagnostics.
- Reordered the generated migration's new unique constraint ahead of its foreign
  key and verified actual clean/upgrade/repeated migrations plus no generator drift.
- Reviewed the exact billing-unit classifications: snapshot budget costs are
  explicit-currency integer 10^-12 major-unit estimates, never accounting cents.
  The global money verifier remains red with diagnostics exactly matching HEAD.
- Existing usage/progress REST/MCP readers are exercised without adding a public
  dispatch or settlement surface. Actual domain tool dispatch validates live
  permissions and returns independently reloaded record links. Raw output,
  private reasoning, model narration and forged links do not become confirmed data.

## Qualification limits

Review the actual results in AI-037-attempt-1.md. This is deterministic local
PostgreSQL18 engineering coverage. AI-038 must build the complete dependent loop,
initial record-level context disclosure, real bounded raw adapter integration,
clarification/retries/grounded summaries and sensitive-operation approval handling.
AI-036 owns process/streaming and higher parents independently accept integration.
No full build, live provider, hosting, production, browser/native-language or
independent security/accounting approval is claimed. Final ordinary typecheck
passed after generated dev-type corruption was repaired outside tracked source.
No Stripe or rollout setting changed.

Result: approve AI-037 only. Its three criteria are supported by the recorded
local checks and explicit handoff. AI-035 and the higher parents remain open.
