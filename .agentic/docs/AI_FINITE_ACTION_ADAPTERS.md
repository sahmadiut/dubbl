# Finite sensitive action observations

AI-048 extends the existing read-only journal adapter and persisted proposal
operations. These observations never approve, dispatch or enqueue a sensitive
operation. AI-046/042/008 retain their independent integration acceptance;
AI-043/044 retain decisions, resource-bound business approvals, fenced execution
and recovery. The ordinary model catalog still contains seven read/draft tools.

## Supported set and strict inputs

Every object is strict. Unknown fields, arbitrary action/tool names, model
approval, actor/organization overrides, credentials, role/security/provider
configuration and Stripe operations are rejected. All UUIDs identify existing
organization-owned resources; scope comes from the current credential.

| Batch action | Exact arguments | Current domain permission |
|---|---|---|
| post_entry | {entryId: UUID} | post:entries |
| delete_draft_journal | {entryId: UUID} | edit:entries |
| settle_document | {documentType: invoice or bill, documentId: UUID, amountMinor: positive canonical integer string, date: Gregorian YYYY-MM-DD, method?: bank_transfer/cash/check/card/other, bankAccountId?: UUID, reference?: string up to 2000 characters} | manage:payments |
| email_invoice | {documentId: invoice UUID} | manage:invoices |

Standalone observations also accept optional `expectedResourceVersion`, a prior
64-character lowercase SHA-256 digest. Changes return PREVIEW_STALE; omit it for
a fresh observation. Each operation additionally requires current use:ai and
view:data. Batch reads/revisions also require view:ai-history and the permissions
of every contained action, including unselected effects. No post:entries grant
is needed for a batch containing only settlement/deletion/email effects.

| Observation | REST POST | MCP |
|---|---|---|
| Manual draft deletion | /api/v1/ai/previews/journal-delete | preview_ai_journal_delete |
| Single-document cash settlement | /api/v1/ai/previews/settlement | preview_ai_settlement |
| Derived invoice-summary email | /api/v1/ai/previews/invoice-email | preview_ai_invoice_email |

REST rejects query fields and uses private,no-store, including errors. Registered
MCP tools use the same services and wrapTool. These client observation tools are
not callable by the ordinary model. Reads work with runtime/provider calls off.

## Settlement observation

`preflightSettlement` is extracted from the existing shared settlement service.
Direct writers retain locking, lazy account setup, transaction ownership and
idempotency contracts. Observation uses a repeatable-read read-only transaction,
takes no row locks and requires existing bank/FX ledger accounts. It never calls
number allocation, account creation/linking, payment writes or journal posting.

The finite operation covers one recognized outstanding invoice (received cash)
or bill (made cash), a positive amount within Number.MAX_SAFE_INTEGER and at
most the outstanding document balance. Input amountMinor is in the document's
own currency: USD cents, IRR rials, with no rescaling or inferred denomination.
The existing domain compatibility ceiling is checked before numeric conversion.
Refunds, payment deletion/reversal, transfers, prepayments, arbitrary allocations,
payment batches, scheduling and provider payouts are outside this adapter.

Shared validation qualifies status, contact/direction, dates, current period and
closed fiscal year, original recognition/control account, exact historical FX,
prior cash/noncash carrying releases, outstanding balance and current cash FX.
Observation additionally validates recognition dimensions against organization
scope. Omitted bank uses existing active GL 1100; a supplied bank must be active,
owned, in document currency and already linked to a qualified asset account.
Missing required realized-FX accounts fail closed instead of being created.
Observation limits recognition lines and prior settlements/allocations to 100;
larger histories are unsupported and no partial effect is disclosed.

Display includes reference/link, before/after status and exact paid/due amounts,
cash direction/date/method/reference, document-currency amount, separate base GL
lines/totals, cash/carrying/realized-gain base amounts, recognition/current FX,
rate effective date/source/inverse/provider provenance and irreversible posting
effects. Source cash and base amounts are never combined economically. The
fingerprint binds exact arguments, scoped actor, base currency, all observations
of recognition/payment/allocation/audit history, accounts, contact, bank, resolved
FX and current business policy, including changes without updatedAt changes.

## Draft deletion observation

The shared deletion guard enforces edit:entries, draft status and the domain's
strict period-lock treatment, even for an actor who can bypass posting locks.
The finite preview is deliberately narrower than direct draft deletion: only
nondeleted, balanced, nonzero manual drafts with qualified active references,
supported currency/FX and the existing 100-line/safe-number bounds are shown.
Unbalanced/empty drafts need another independently reviewed adapter.

Every schema FK referencing the journal, except its own cascading lines, is
checked for incoming references. Document, payment, attachment and schedule
links, including foreign links, withhold the preview without disclosing records.
Source and reversal links are rejected as well. Display includes all removed
lines, their separate currency amounts/dimensions/FX, draft-to-deleted status and
explicit permanent header/line removal and no-undo effects. These unposted
amounts are not added to selected batch GL impact totals. No delete/audit occurs.

## Invoice email observation

The rendering domain now exposes its existing read-only preflight through
`readDocumentForRendering`; rendering and direct sending continue to consume it.
The adapter reads this snapshot without HTML/PDF rendering, delivery, network
access, delivery logging or document mutation. It observes the existing email
quota in that same transaction; it does not consume quota or configure providers.

Only sent/partial/paid/overdue invoice summary email is supported. The sole
recipient comes from the saved document and must equal the live scoped contact's
single plain mailbox. Missing/unsafe/list/display-address/control-character
mailboxes and saved/live disagreement fail closed. Reply-to is validated too.
Subject comes from the existing document email translation and saved number/live
organization name; controls and oversized subjects fail closed. No recipient,
subject/body/amount/date override, custom message, link, attachment, CC/BCC,
resend, reminder, other document kind or sending-provider action is accepted.

Display returns the recipient/name, reply-to, subject, complete template fields,
exact document-currency total/paid/due values, issue/due dates, no-attachment/no-link
state, unchanged invoice status and irrevocable external disclosure/delivery-log
effects. It describes one future attempt, never guaranteed delivery. Fingerprints
bind the complete rendering snapshot (including lines, parties and template),
derived content, quota observation and policy. No stored HTML, provider response
or credentials become approval authority. Delivery/provider qualification is
still required at the future effect boundary.

## Policy, proposals, bounds and recovery

The existing journal business-policy observer now also supports the invoice and
bill entity types using their actual saved headers and existing condition engine.
All active and latest historical policies, steps, request/action/member bindings,
malformed/ambiguous-policy bounds and self-assignment safeguards are preserved.
Policy observation remains identity-free. Historical approved status lacks an
exact resource/policy binding and always leaves approvalSatisfied,
resourceBoundApproval and canCurrentActorApprove false. No matching business
workflow grants AI approval. Entity workflows are conservatively observed for
all supported effects; their direct domain paths do not all enforce this engine.
AI-043/044 must qualify that missing decision/effect integration.

New adapters use version 1; journal posting/deletion use version 2. Existing
journal-only authority remains readable, with legacy version-one upgrade via
explicit revision unchanged. Persisted authority keeps exact parsed arguments
separate from complete display and binds prepared steps, adapter/resource/policy
versions, scope, expiry and dependencies. Shared batch read/revision operations
cover every adapter. One resource may occur only once, including across action
variants: proposed state changes cannot stand in for future observed resources.

Initial selection is empty. Explicit whole-batch revisions require CAS versions,
fresh request keys and complete prerequisite closure, regenerate all previews
and step IDs, and preserve original expiry/deadline/budget. Revisions confer no
approval, including after historical approved metadata. Revocation after reads
or insert waits withholds/rolls back the complete result. Existing cancellation,
erase, expiry and retention clear every adapter's authority/display through the
same generic storage lifecycle. No new schema or migration is required.

Existing 10-item/20-total-step/20-revision, fixed five-minute/original deadline/
content-expiry and 1-MiB run limits remain. Each new full domain snapshot and
display is bounded to 32768 UTF-8 bytes; existing authority/display bounds remain
24000/48000 bytes. Nothing is silently truncated. No raw execution arguments are
returned as a substitute for structured business display. All displayed domain
text is untrusted plain text for the future UI, never model instructions.

Existing finite preview/batch recovery codes remain. PREVIEW_LIMIT_REACHED is
added for the current domain email quota, with inspect_record recovery. Malformed
input uses existing transport validation errors. Unsupported history, missing
FX, invalid amounts/references/recipients fail closed without partial display.
This work qualifies synthetic REST/MCP/SQL observation only: no decision,
execution, live provider, browser/native Persian, deployment or rollout claim.
