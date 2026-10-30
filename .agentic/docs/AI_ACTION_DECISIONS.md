# Explicit action decisions

AI-043 adds shared explicit decisions in `lib/ai/action-batches.ts`. AI-044
still owns approved execution integration; AI-008 retains combined acceptance.
Recording approval never queues a run, dispatches a domain operation, calls a
provider or changes existing business approvals. The automatic model catalog
remains seven read/draft operations.

| Operation | REST | MCP |
|---|---|---|
| Approve exact selection | POST /api/v1/ai/runs/[id]/action-batch/approve | approve_ai_action_batch |
| Reject entire batch | POST /api/v1/ai/runs/[id]/action-batch/reject | reject_ai_action_batch |

Both accept only the exact batch UUID, batch/run versions, preview bindingDigest,
complete persisted selectedItemIds and requestKey. REST derives runId from the
path; query fields and body runId are rejected. Schemas reject text confirmation,
approval/policy/actor overrides and executable arguments. Selection cannot change
at this boundary; revise the complete proposal first. IDs and selection order are
canonicalized, with duplicate selection rejected. Approving an empty selection
is invalid. Rejection cancels the entire pending batch, including unselected
prepared items and dependency descendants; partial per-item rejection is not
offered. Use revision to choose a different dependency-closed subset.

Approval requires a current authenticated **session**, own-run organization and
actor scope, live use:ai/view:ai-history/view:data and every proposed item's
domain grants, plus the run's original valid identity/configuration and runtime
gate. Production MCP OAuth tokens and API keys cannot prove a separate human
confirmation and receive `DECISION_INTERACTION_REQUIRED` with
`open_interactive_approval`; there is no caller-supplied human-confirmed flag.
The registered MCP operation uses the same service and accepts a server-bound
session context, but the current OAuth MCP transport supplies a token context.
Its positive session-backed linked-transport test does not claim production
OAuth-token approval support. The ordinary agent cannot call these tools.
Rejection remains available to a current MCP credential and with runtime off.

Every proposed resource and business policy is reobserved, with exact adapter,
resource/policy, step/version/argument/dispatch and batch bindings checked.
Edited, expired, superseded, cancelled or corrupt proposals fail closed. A
selected action requiring existing business approval returns
`DECISION_BUSINESS_APPROVAL_REQUIRED`. Legacy approved requests lack resource
binding and cannot satisfy it. Only identity-free categories
`independent_business_approver` or `approval_administrator` are returned; workflow,
request, member and approver identities remain hidden. No AI operation repairs
policy or acts on an existing business request. A changed policy/request makes
the old preview stale, requiring explicit revision. Business approval with exact
resource binding remains an execution integration responsibility.

The conversation share lock, run update lock, batch update lock and ordered step
locks serialize decisions with revisions/Stop. After receipt/event/step writes,
the service rechecks resources, policy, credentials, permissions and wall-clock
expiry, including after real SQL lock waits. Any failure rolls back the whole
decision. This validates an observation at decision time; AI-044 must recheck
everything at the future effect boundary. No decision promises resources cannot
change after acknowledgement.

Generated migration `0025_plain_outlaw_kid.sql` adds `ai_action_decision` and a
composite proposal scope key. Its FK binds batch/run/org/owner. Unique batch and
run/request keys prevent double decisions. Bounded metadata stores decision,
exact batch and accepted run versions, binding/selection/request digests,
original expiry, required permissions and creation time. No resource arguments,
display, transcript, model output or credentials are duplicated. The generated
DDL places the referenced unique constraint before its FK.

`DECISION_APPROVED` increments the run version and emits `approval_recorded`,
leaving it awaiting_approval without a lease or queue transition. Selected and
unselected steps remain prepared; execution integration must honor the exact
selection and dependencies. Read current batch returns the decision metadata;
canApprove is false after decision, for an empty selection, for required business
approval, without a session or when runtime/configuration is unavailable. A
revision supersedes the old proposal/steps and requires a fresh decision; it
does not extend original expiry or mutate an old receipt.

`DECISION_REJECTED` increments the run version, emits `approval_rejected`, marks
it cancelled, skips every prepared step and erases all revision arguments/display.
Completed effects and their receipts remain intact. Executing/uncertain work
prevents a batch decision; existing Stop/reconciliation remains the recovery.
Stop, retention and expiry already invalidate proposal authority. Decisions
remain content-free metadata under the existing run/conversation metadata
retention and cascading deletion policy.

Identical request-key retries return the original receipt, including after
revision, Stop, expiry or runtime disablement. They require current credentials
and original domain permissions, retained even after proposal payload erasure.
They do not revalidate expired effect authority, change versions, enqueue work or
reapply effects. Different input/decision under the same key conflicts; another
key cannot decide the same revision again. The receipt's `authority:decision_only`
describes the recorded decision, never current execution permission.

Other finite failures use the existing BATCH_DENIED/NOT_FOUND/STALE/EXPIRED/
CONFLICT/INVALID/DISABLED/CONFIGURATION_CHANGED/UNAVAILABLE codes and recovery.
Missing, foreign and sibling-owner scope is indistinguishable. REST errors and
successes use private,no-store. Actual REST, registered linked MCP and disposable
SQL tests cover positive decisions, lost acknowledgements, competing approve/
reject, both Stop orderings, stale/edited/expired resources, denied approvers,
late revocation/resource/expiry rollback, self-assigned and legacy policy,
dependency rejection, immutable completed effects and no sensitive dispatch.

This does not qualify UI/native Persian, production authentication interactions,
live providers, external sending, deployed workers or production activation.
