# Combined sensitive observation acceptance

AI-046 qualifies the combined AI-047 current business-policy observer and AI-048
finite adapters within AI-045 persisted proposals. The executable acceptance is
tests/integration/ai-action-integration.test.ts and its independent worker. This
is observation/proposal integration, with explicit boundaries: AI-042 and AI-008
retain parent integration, AI-043 decisions and AI-044 fenced effects/recovery.
No model-callable sensitive operation, approval, provider call or rollout is added.

## Combined journey

The disposable database contains two manual drafts (USD and IRR), separate USD
invoice settlement, EUR bill settlement into USD base GL, another manual draft
for deletion and a separate saved-contact invoice for email. Distinct resources
are required even across action variants. The original and cash-date EUR rates
are 2 and 3 respectively; bill cash 500 EUR minor therefore previews carrying
1000, cash 1500 and loss 500 USD minor. This uses actual shared recognition and
settlement services; no settlement is performed by the journey.

All three entity policies match actual saved headers and have legacy approved
requests. Actual standalone REST and registered MCP observations return complete
structured effects, current identity-free business requirements and opaque
resource/policy bindings. Approved metadata never satisfies resource binding or
self-approval. Draft deletion includes permanent header/line effects, while email
shows derived recipient/content and unchanged invoice status.

A trusted fenced worker stores one initially unselected six-item proposal.
Shared REST/MCP read returns exactly the stored display after live checks. Partial
dependency selection is rejected with no changes. Concurrent REST/MCP selection
retries with one request key produce a single replacement and identical metadata
receipts, new prepared steps and fixed original expiry. Selected GL totals are
1250 IRR minor and 3250 USD minor; source EUR amounts are not added to USD totals,
and deletion/email contribute no GL effect.

Malformed bill policy makes the complete mixed proposal stale. A failed revision
rolls back superseded rows, steps, events and run updates. Self-assignment reports
policy repair without authorization. Explicit revision after journal/contact/FX
edits refreshes every snapshot and step under the original expiry. Changing the
cash rate to 4 changes selected USD GL impact to 3750 minor. A fourth six-item
revision exceeds the unchanged 20-total-step limit and performs no writes.

Removing any one domain permission withholds the entire mixed display. A real
read wait on the last email adapter, followed by revocation of an earlier journal
posting grant, also withholds everything through the final complete grant check.
Revocation of manage:payments during a real prepared-step INSERT wait rolls back
the entire mixed proposal, including its already inserted batch metadata. Reads
work with runtime disabled, while new revisions fail closed. Sibling/foreign
owners receive no proposal details. Unsupported financial/security/provider/role
actions fail strict REST/MCP validation.

Cancellation, conversation deletion, content retention and proposal expiry clear
all mixed adapter arguments/display. Maintenance is tested in a fresh process and
does not requeue expired effects. SQL hashes assert no financial, reference,
audit, delivery or business-policy changes during every observation/proposal
operation. Reads and failed revisions additionally leave AI state unchanged.
No payment, email log, AI approval or provider attempt/call is created.

## UUID identity repair

The independent combined test initially reproduced a missing duplicate check:
the same journal UUID in uppercase and lowercase could appear in posting and
deletion items. PostgreSQL resolves both to one row, but the prior resource key
compared their text spelling. Resource keys now compare lowercase UUIDs. Graph
item/prerequisite/selection IDs are canonicalized before uniqueness and closure
checks too. Case aliases cannot duplicate a resource or item or bypass closure;
equivalent complete selections retain the same idempotency digest. Domain
arguments remain exact validated input; no existing row is rewritten or executed.

## Qualification limits

The finite set, strict argument shapes, supported domain ceilings and excluded
variants are in [AI_FINITE_ACTION_ADAPTERS](AI_FINITE_ACTION_ADAPTERS.md); shared
policy semantics are in [AI_BUSINESS_POLICY_PREVIEWS](AI_BUSINESS_POLICY_PREVIEWS.md)
and storage/revision/retention in [AI_ACTION_BATCHES](AI_ACTION_BATCHES.md).
Children's focused negative cases and this independent mixed journey jointly
support parent acceptance. They do not qualify business approval decisions,
sensitive dispatch, browser/native Persian UX, real delivery/provider operation,
deployment, production activation or a green global money-inventory gate.
