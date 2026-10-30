# Durable action proposal batches

AI-045 implements storage and explicit revisions for the existing AI-041 manual
journal posting preview. AI-046 owns additional finite sensitive adapters and
business-policy integration; its child AI-047 binds current journal policy and
AI-048 expands payment/deletion/sending. AI-042 retains independent integration. AI-043/044
still own explicit decisions and approved execution. These proposals confer no
approval or execution authority, including when selected or saved.

## Creation and authority

Only trusted worker code can call `requestActionBatch(runId, leaseToken,
expectedRunVersion, spec)`. It checks the live fenced lease and original
identity/configuration before and after preview reads. The initial proposal must
have `selectedItemIds:[]`; a worker/model cannot preselect sensitive effects.
Creation is not registered through REST, MCP or the ordinary model catalog.
This primitive is prepared for future executor integration; current model turns
still support only their existing seven read/draft tools.

The strict spec contains a request key, 1..10 item UUIDs with action `post_entry`,
exact `{entryId}` arguments, explicit prerequisite item UUIDs, and selection.
All journal resources must be distinct, supported and currently visible under
AI-041's manual-draft, currency, period/reference and safe-workflow limits.
Duplicate/self/missing/cyclic dependencies are rejected, and selection must
include the complete prerequisite closure. No arbitrary tool, amount, actor,
organization, approval or provider fields are accepted.

A new generated migration, `0024_serious_chat.sql`, adds `ai_action_batch` with
owner/organization/run scope enforced by a composite FK, unique run/revision and
run/request keys, a partial unique pending row, bounded JSONB, positive versions
and canonical digests. The original parsed arguments live in `authority`, separate
from the complete bounded `display`. Per-item authority binds adapter version,
resource fingerprint, prepared step UUID/version and dependency graph. The batch
also binds adapter version 2 and the explicit policy fingerprint described in the
[business-policy contract](AI_BUSINESS_POLICY_PREVIEWS.md). Policy/step/request/
action changes invalidate the complete display even if timestamps are unchanged.
Legacy adapter-version-1 rows return BATCH_STALE; explicit revision can upgrade
them under the original expiry. No existing row is silently rewritten. The batch
binding digest also covers owner/org/run, row/revision, expiry, selection and the
display. Canonical hashing survives JSONB property reordering. This unkeyed digest
is an integrity binding, not an approval token or signed capability.

Creation prepares a new durable step per item without putting raw arguments into
step display input. It leaves the run in `awaiting_approval`, clears the lease and
emits only a content-free state event. No business service, provider or network
delivery is called. Unsettled usage, pending clarification and unfinished or
uncertain business work prevent proposal creation. Original deadlines, budget
charges, attempt counters and completed receipts are preserved.

## Shared client operations

| Operation | REST | MCP |
|---|---|---|
| Read current batch | GET /api/v1/ai/runs/[id]/action-batch | get_ai_action_batch |
| Revise entire batch | POST /api/v1/ai/runs/[id]/action-batch/revise | revise_ai_action_batch |

Both use `lib/ai/action-batches.ts`, current credential/membership and `use:ai`,
`view:ai-history`, `view:data`, `post:entries` permissions, plus own-run scope.
REST path IDs cannot be overridden in request bodies; query fields are rejected.
Responses, including errors, use private,no-store. Client MCP tools are excluded
from the ordinary chat catalog. They do not approve or execute.

Read validates the persisted binding, each prepared step and every current
resource fingerprint, then rechecks live grants after async reads. It returns
one complete stored display or nothing. It exposes proposed step references,
selection/dependencies, every effect and selected totals grouped by explicit
currency; SQL minor strings and bigint totals retain USD/IRR units without
conversion or mixed-currency economic sums. No raw execution arguments,
credential/lease or model-generated success are returned. Read is permitted with
runtime disabled and does not write or refresh expiry.

Revision requires batch UUID, exact batch/run versions, a fresh idempotency key,
and the full item/selection/dependency set. It obtains the conversation then run
lock, checks live runtime/configuration, regenerates every preview, supersedes
the old row/steps, and inserts the new revision atomically. A resource change may
be deliberately refreshed by revision; the new displayed snapshot and binding
must be retrieved for any later decision. Failure rolls everything back.
Identical request-key retries return the original metadata receipt, even after
runtime disablement; they never enqueue or write again. Reusing a key with a
different request conflicts. The receipt means only that a proposal was stored.

Expiry is fixed at creation to the earliest of five minutes, original run
deadline and conversation content expiry. Revision never extends it. Individual
display expiries are clamped to that same boundary. Revisions are limited to 20,
all existing and newly prepared run steps together to 20, and cumulative run
payload to 1 MiB. Compact authority/display have conservative application bounds
of 24000/48000 bytes within SQL JSONB ceilings of 32768/60000. Effects are never
silently truncated. Revisions use new step identities and retain historical
superseded metadata until existing retention policy removes it.

## Recovery and retention

Finite codes are `BATCH_PREVIEW_ONLY`, `BATCH_PREVIEW_RECORDED`, `BATCH_DENIED`,
`BATCH_NOT_FOUND`, `BATCH_STALE`, `BATCH_EXPIRED`, `BATCH_CONFLICT`, `BATCH_INVALID`,
`BATCH_LIMIT`, `BATCH_DISABLED`, `BATCH_CONFIGURATION_CHANGED`, `BATCH_UNAVAILABLE`.
Denied returns a contact-administrator action; stale/conflict offers refresh;
other unavailable conditions offer inspection/cancellation. A missing, foreign or
other owner's batch is indistinguishable. Malformed inputs/authentication use
the existing transport validation/auth errors. No approver identity is exposed.

Cancellation clears raw authority and display for every revision and skips
prepared steps. Conversation deletion/content retention clears them too. Expired
proposal payloads are purged independently of longer conversation retention.
Maintenance expires waiting runs/steps without requeueing them, including after
process restart. Binding/request receipts remain metadata only. No rollback of
completed effects, automatic retry, approval or delivery is implied.

Actual REST/MCP/disposable SQL tests cover races, stable lost-ack receipts,
selection/dependencies, stale resources, storage constraints, no effects,
cancel/erase/expire/restart and permission revocation during a real read wait.
This is not qualification of sensitive decisions/dispatch, UI/native Persian,
live-provider behavior, deployed worker supervision or production activation.
