# Business-policy observation for journal proposals

AI-048 adds the [finite settlement, draft-deletion and invoice-email adapters](AI_FINITE_ACTION_ADAPTERS.md), shared REST/MCP observations and mixed persisted
proposals. Their strict arguments, per-action live permissions, domain gates,
separate cash/base amounts, derived recipients and observation-only limits are
specified there. The journal contracts below remain applicable to that adapter.

AI-047 implements only the existing manual-draft `post_entry` preview. It adds
no action, endpoint or MCP operation: the existing standalone journal preview and
own-batch read/revision operations share this behavior. AI-048 retains additional
payment/deletion/sending adapters, AI-046/042 combined integration, AI-043 explicit
decisions, and AI-044 approved dispatch. The ordinary model catalog stays at seven
read/draft operations. Stripe/security/provider/role operations remain unavailable.

## Current domain policy

`lib/ai/business-policy-preview.ts` runs inside the journal adapter's read-only,
repeatable-read transaction. It loads the active organization-owned journal
workflows, validates every saved condition using the existing condition parser,
and calls `checkApprovalRequired` from the shared approval engine with the actual
saved journal header. Text AND predicates and canonical exact integer predicates
retain existing semantics; it never invents monetary totals as journal-condition
fields. Current journal policy has no supported money condition field. Matching
rules with missing/duplicate/out-of-range steps or foreign members are rejected.
Invalid nonmatching policy is also rejected, rather than hidden by an earlier
match. Multiple matches fail closed because the engine has no stable precedence
contract. This tightens only observation; direct business workflows are unchanged.

The latest same-organization/entity request and all its actions are observed.
Its workflow, including an inactive/deleted historical workflow, steps,
requester, action members and action-step references must still be valid and
organization-owned. A historical workflow of another entity type is invalid.
Request currentStepOrder must identify an actual step. Existing sequential
semantics visit all steps; isRequired:false never creates an implicit bypass.

The snapshot is bounded to 20 active workflows, 100 steps per workflow, 100
actions on the latest request, 100 conditions per workflow, and 32768 encoded
UTF-8 bytes for both individual workflow and complete policy snapshot. A latest
historical workflow can add one inactive/deleted workflow to this snapshot.
Oversized input returns PREVIEW_TOO_LARGE; malformed/ambiguous references or
conditions return PREVIEW_POLICY_INVALID with no partial preview. Existing
100-line/32768-byte journal and proposal bounds continue to apply.

## Display and approval boundary

`businessApproval.evaluation` is `evaluated`. `required` reports whether the
current domain rule matches. `requirement` is `not_required`,
`resource_bound_approval_required`, or `policy_repair_required`.
`activeWorkflowPresent` and `latestRequestStatus` remain observations.
`nextActors` is empty, `[independent_business_approver]`, or
`[approval_administrator]`; it never names or links an approver. These categories
describe the required independent business review or policy repair, not a
currently executable action or a promise of worker/approver availability.

The current approval-request schema has no resource or policy digest. Therefore
`approvalSatisfied`, `resourceBoundApproval`, and `canCurrentActorApprove` are
always false, including when a historical request says approved. An unmatched
rule means no business workflow is required; it does not grant AI approval or
execution. Any assignment to the proposing actor, journal creator or the matching
request's requester is marked `self_approval_assignment` and requires an administrator.
Every matched workflow also reports `approval_resource_binding_missing`.
No self-approval, identity disclosure, business approval mutation or dispatch is
introduced. Existing direct journal posting does not enforce these conditions;
AI-043/044 must implement and qualify the missing decision/effect boundary.

## Fingerprints, proposals and recovery

The opaque `policyVersion` hashes the scoped actor, all relevant workflow fields
and ordered steps, latest request, ordered actions and referenced member IDs/user
bindings. Names, comments, conditions, request and member IDs never leave the
helper; only the digest and finite display fields do. Header/line/account data
and this policy observation are bound into adapter-version-2 `resourceVersion`.
Direct policy/step/request/action/resource edits invalidate fingerprints without
depending on updatedAt. Inactive/removed policies invalidate previous snapshots.
Fingerprints are integrity observations, never approval tokens or capabilities.

Durable batch authority stores adapter/resource/policy versions separately from
display. A changed/malformed policy returns BATCH_STALE and withholds the entire
batch. Explicit CAS revision regenerates all observations and step identities,
preserves the original expiry/deadline, and invalidates superseded selection.
Version-one authority is accepted only for safe explicit revision; reads fail
stale. Failed revision rolls back every proposal/step write. No schema change or
migration is needed for the existing bounded JSONB payload contract.

Read/revision keep existing live AI/history/domain authorization and own-run/
organization scope. The adapter rechecks credential and permission grants after
async reads, including actual policy-table waits; retention/cancellation still
erase payloads. Runtime-off observation remains possible. A repeatable snapshot
is an observation at read time; decision/dispatch must acquire and revalidate
their own current authority. No preview, selection, refresh, retry or revision
approves, submits an approval request, queues continuation or performs an effect.

Actual REST/MCP/disposable SQL tests exercise these contracts. Browser/native
Persian UX, payment/deletion/sending, live providers, sensitive dispatch and
production activation are outside this completed child.
