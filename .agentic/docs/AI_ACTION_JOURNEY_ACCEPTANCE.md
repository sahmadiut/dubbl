# Preview, decision and resume integration

AI-008 independently accepts the combined backend journey built by AI-007,
AI-041, AI-042, AI-043 and AI-044. The actual implementation remains the shared
services and reviewed finite adapters; this acceptance adds no alternate
execution path. See [proposal storage](AI_ACTION_BATCHES.md),
[decisions](AI_ACTION_DECISIONS.md), [resume](AI_APPROVED_BATCH_RESUME.md) and
[execution acceptance](AI_APPROVED_EXECUTION_ACCEPTANCE.md).

## Authority through the journey

1. Automatic reads and permitted drafts retain the seven-operation catalog and
   their existing authorization/policy checks. Posting, cash settlement, draft
   deletion and saved-contact invoice email use the separate finite reviewed
   adapters. Security, credentials, provider and role configuration are excluded
   from ordinary chat, including requests disguised as approvals.
2. Trusted worker proposal creation starts with no selected effects. Shared REST
   and registered MCP reads return every bounded business preview: label key,
   record reference/link, before/after state, exact currency-aware minor strings,
   recipients, effects, policy requirement, resource/version binding and expiry.
   No client creation operation or model-callable sensitive tool is implied.
3. Explicit revision regenerates the complete proposal and dependency-closed
   selection. It creates new batch/step identities without extending expiry.
   Changing arguments or selection invalidates old effect authority. A stable
   acknowledgement of an earlier decision remains historical metadata only.
4. Approval binds the live interactive actor, organization, exact batch/run
   versions, digest and complete selection. It never queues work. Existing
   business approval requirements remain independent and fail closed when no
   qualified resource-bound approval is available. Responses identify only
   permitted actor categories and safe recovery actions.
5. Explicit resume queues only the exact current approved selection. Worker
   effects consume original validated arguments once and revalidate current
   permissions/resources/policy/expiry at each effect. Dependency receipts gate
   successors. Cancellation or later failure preserves completed effects;
   uncertain results require reconciliation. There is no whole-batch rollback.
6. Identical revision/decision/resume retries observe their durable receipts.
   Rejection cancels the entire prepared dependency chain and erases proposal
   payloads. Observation, reconnect, clarification and model text grant no
   execution authority. Progress remains paginated, persisted observation.

## Independent outer acceptance

`tests/integration/ai-action-journey-acceptance.test.ts` invokes a separate
AI008_ACCEPTANCE scenario branch in the existing real transport/domain fixture.
It uses actual REST handlers, linked registered MCP, migrations, SQL and the
durable worker. Session acquisition and external email transport are stubbed.

The new scenario compares all five journal/invoice-payment/bill-payment/email/
deletion observations across transports and their saved resource bindings. It
checks the initially empty selection, complete six-effect display, exact large
IRR values and unchanged business state before approval. An initial explicit
approval is then replaced by a revision changing the invoice payment from
2147483648 to 1073741824 IRR minor units and selecting only posting plus payment.
The old approval receipt cannot resume it. Competing fresh REST/MCP approvals and
repeated resume calls yield one decision and queue receipt for the new version. SQL and
progress confirm exactly two effects, a partially paid invoice, no bill payment,
email or draft deletion, and no replay after completion.

Additional outer scenarios cover rejection of the entire dependency chain,
invalid prerequisite selection, injected confirmation, changed resources, expiry,
permission loss, independent business approval and sibling-owner isolation.
The child/runtime regression suites retain complete selected-chain delivery,
partial failure, Stop, concurrency, late authorization changes, crash/restart,
uncertain effect reconciliation and automatic read/draft/clarification behavior.

## Qualification boundary

This is backend integration acceptance for the finite supported set. AI-027/009
still own localized approval/recovery UI; label keys and recovery codes are
machine contracts, not completed translations. Production MCP OAuth/API-key
approval still requires a separate interactive approval session. Live providers,
deployed-worker supervision, throughput, native Persian review and production
activation remain separate gates. Runtime/provider flags remain default-off.
Confirmed email means transport acceptance, not inbox delivery. Conservative
domain table locks retain their contention costs. Stripe scope is unchanged.
