# Explicit approved batch resume

AI-051 adds `POST /api/v1/ai/runs/[id]/action-batch/resume` and registered
`resume_ai_action_batch`, backed by `resumeActionBatch`. Approval itself remains
decision-only. Observation, clarification, reconnect and model text never invoke
resume. The seven automatic read/draft tools remain unchanged.

Resume takes only the exact current batch ID/version, current run version,
bindingDigest, complete selectedItemIds and a requestKey. REST gets runId from
the path and rejects query fields and a body runId. Both reject unknown fields,
arguments, recipients, money overrides and confirmation flags. A pre-existing
interactive approval of this exact dependency-closed selection is required.
Current owner/org scope, original execution identity/configuration, permissions,
resource/policy bindings, fixed expiry, retention and runtime gate are rechecked.
Existing unsupported business approvals fail closed. The caller cannot edit the
selection or extend the deadline by resuming.

Conversation/run/batch/step locks serialize resume with decisions, revisions and
Stop. All resource, permission and expiry checks repeat after queue/audit SQL
waits. Generated migration `0028_spotty_sharon_ventura.sql` adds the content-free
`ai_action_resume` queue receipt with a composite decision scope FK and unique
batch and run/request keys. The receipt and queue event commit atomically. An
identical retry under current access returns that original receipt even after
Stop or completion; it never queues again. Another payload conflicts. Receipts
contain no arguments, display, transcript, credentials or provider output.

The existing leased worker/executor branches on this durable receipt before any
provider call. A proposal without a resume receipt fails closed rather than
entering the automatic model loop. It routes only action kinds and identifiers
to the existing journal, settlement and saved-contact email executors. Only a
fresh one-time consumption hands original arguments to a domain adapter. Every
new effect retains its domain serialization and current-state validation.

Selected dependencies must have succeeded steps and matching immutable
consumption receipts from this decision. A matching succeeded receipt is observed
without calling that adapter again. Failed, skipped, executing, uncertain,
corrupt or missing selected prerequisites stop execution; prior effects remain.
The worker marks the run succeeded only after all selected effects have confirmed
receipts and final live lifecycle/permission checks. Unselected prepared actions
are skipped. Success does not require or invoke a model summary. Progress exposes
finite action status codes and live permission-checked record links; erased
drafts have no fabricated live link, and email confirmation means transport
acceptance rather than inbox delivery.

After a crash between committed effects, lease recovery can continue only the
remaining unconsumed selection within the original authority/expiry. Committed
receipts retain their original operation IDs and dispatch leases. A crash after
consumption or uncertain delivery requires reconciliation; maintenance and
resume retries cannot reconstruct the lost handoff or resend. Stop prevents
further effects while preserving actual partial results. Expiry/deletion erases
proposal content through the existing retention lifecycle. The retention expiry
predicate now groups its content-presence OR condition so maintenance cannot
erase an unexpired proposal.

Runtime and provider/worker rollout gates remain default-off and unchanged.
Local tests use injected transports; no provider/model call is needed for the
approved branch. Existing production worker startup still requires its operator
flags. This qualifies neither deployment nor live providers, production MCP
interactive approval, UI/native Persian, throughput or activation. Global domain
table locks retain their existing contention limits. AI-044 and AI-008 retain
independent combined acceptance.
