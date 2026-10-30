# Approved saved-contact invoice delivery

AI-054 adds trusted `executeApprovedInvoiceEmail({runId, lease, batchId, itemId})`
alongside journal and settlement execution. It accepts identifiers only, rejects
other action domains before consumption, and uses original arguments solely from
the fresh one-time consumption return. Repetition observes a bounded receipt;
it never reacquires arguments or dispatches another message. The API/MCP approval
and observation contracts remain shared. There is no public/model sending tool,
automatic sensitive worker dispatch, application resume transition or activation.
AI-051 owns resume/worker integration; AI-050/044/008 retain combined acceptance.

Only a saved, recognized invoice in sent/partial/paid/overdue state is supported.
The shared read-only rendering preflight checks ownership, references, saved/live
recipient agreement, exact money and business policy. The message uses the saved
single plain mailbox, derived subject, dates, number, currency and total with the
existing document email renderer. There are no recipient/content overrides,
custom messages, links or attachments. Delivery does not change invoice status.
Current SMTP configuration is included only inside the resource digest; its
credentials are never copied into AI content or metadata.

Before dispatch, one transaction creates an ordinary domain email log marked
`ai_attempt` and one `ai_action_delivery` identity. The latter contains only scoped
UUIDs, envelope digest, UTC creation time and confirmed/failed/uncertain state.
Unique consumption/log keys and scoped composite foreign keys bind the original
consumption, owner, organization and log. Identity and envelope are immutable in
the application; only outcome changes. Message/recipient/body stay in the domain
log, with no provider response or diagnostics. Both rows start uncertain, so a
crash at any later point cannot authorize a resend. Uncertain AI logs retain an
email quota slot; the boundary excludes only its own reservation when comparing
the originally approved limit/resource digest. Other quota drift fails closed.

The final read-committed boundary takes conservative domain table locks before
run locks. This permits Stop and resource/authority writers to win while the
adapter waits for resources. Locks protect absent and existing credential,
membership, policy, quota, invoice/line/contact/template and transport rows from
ordinary SQL writers. It validates the exact current decision, selected graph,
step/operation/argument/adapter/resource/policy bindings, retention, deadline,
runtime, permissions/configuration and lease. It rerenders and compares the full
envelope digest, prepares the shared delivery transport, writes the operation
audit, then repeats live authority/time checks after all those asynchronous waits.
The existing SMTP or platform sender is invoked once while the locks remain held.

Confirmed means that the configured transport acknowledged acceptance, not that
the recipient inbox received/read the email. Resend API errors and resolved SMTP
results rejecting every recipient are known failures. Unknown transport errors
are uncertain; their raw diagnostics/provider responses are not persisted by the
AI adapter. Confirmation and the document/log UUID receipt commit together on
the original fence. Once sending starts, expiry or Stop cannot undo delivery.
Stop during that boundary waits for its result and retains the actual receipt.
If subsequent SQL fails after an observed confirmation, the adapter retains the
known confirmation separately and settles only the still-owning step. Recovered
or replaced fences are not overwritten. Lost COMMIT acknowledgement reconciles
the durable succeeded receipt. A killed worker leaves the original attempt
uncertain and lease maintenance requires reconciliation, never automatic resend.

The existing REST/MCP resend operation rejects all AI attempt logs, including
after AI metadata retention removes the linked attempt. A deliberate subsequent
send requires a fresh reviewed proposal; old logs, display, receipts, narration,
selection and historical decisions have no execution authority.

Migration `0027_concerned_xorn.sql` adds the content-free attempt table, the
domain-log marker and scoped keys. Referenced composite uniques precede the
foreign keys. Existing logs default to ordinary, preserving their resend flow.
No money storage or monetary units change.

Qualification uses disposable loopback PostgreSQL and SMTP/platform stubs, actual
session-backed REST approval, real batch revisions, consumption and leases,
resource/recipient/permission/member/business-policy/config/transport/limit/
runtime/lease/deadline/Stop races, final-audit expiry, concurrent/repeated calls,
USD/large IRR rendering, rejection/lost acknowledgement, and killed workers before
and after provider acceptance followed by fresh-process recovery.

Global table locks trade throughput for correctness and remain held during the
external acknowledgement wait; Stop and writers may wait during an in-flight
send. A finer lock/cancellation protocol needs separate qualification. No live
provider, inbox delivery, deployed worker, performance, UI/native Persian,
deployment or production rollout is qualified. Default-off rollout gates remain.
