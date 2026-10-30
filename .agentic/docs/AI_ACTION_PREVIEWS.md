# AI action previews

AI-041 supplies the first **observation-only** adapter. AI-008 remains the
integration parent; AI-042 supplies additional reviewed sensitive adapters and
durable selected batches, AI-043 explicit decisions, and AI-044 approved execution.
No sensitive operation was added to the seven-operation automatic model catalog.

AI-045 adds [durable journal proposal batches](AI_ACTION_BATCHES.md), shared own
reads and explicit revisions. AI-046 expands domain adapters and policy checks;
AI-042 remains their integration parent. Batches remain preview-only; this
document's standalone AI-041 adapter still creates no durable proposal itself.

## Manual journal posting observation

`POST /api/v1/ai/previews/journal-post` and MCP `preview_ai_journal_post` call
`lib/ai/action-preview.ts`. Input is a strict object containing an existing
`entryId` UUID and optionally `expectedResourceVersion`, the SHA-256 fingerprint
returned by a prior observation. No actor, organization, arguments, approval or
action selector is accepted from the caller. REST responses use private,no-store.

Both transports require a current credential and current `use:ai`, `view:data`
and `post:entries` permissions. The service rechecks them after database reads.
Organization scope comes from the authenticated context. Reading works with AI
runtime and provider calls disabled. It creates no run, step, event, approval,
business-approval request, audit or journal mutation.

Only nondeleted manual draft journals (`sourceType` null or `manual`, no source
or reversal links) are supported. The adapter validates active organization-owned
references and existing period-lock rules. It requires at least two lines,
nonnegative canonical amounts, balance separately in every saved currency and
the current journal domain's safe-number compatibility ceiling. A balanced
cross-currency journal requiring conversion is deliberately unsupported by this
first adapter; it returns `PREVIEW_INVALID_RECORD`. No FX conversion or history
repair occurs. SQL text supplies exact minor units; bigint arithmetic supplies
totals. Numeric conversion occurs only after the compatibility bound check to
validate saved FX with the existing domain DTO guard.

`PREVIEW_ONLY` returns a structured preview: `post_journal` action label key,
live record reference/link, draft-to-posted status, date/memo/reference, complete
account lines with exact debit/credit minor strings, saved FX and dimensions,
per-currency totals, empty recipients, effects requiring reversal of posted
history and any scheduled reversal date. Labels/memos are untrusted plain text
for UI rendering, never instructions or approval. The UI-owned localization
mapping is still AI-027 work; no translated UI is claimed here.

The business-approval observation includes only whether an active journal
workflow exists and the latest same-organization request status. Workflow names,
approvers, identities and request IDs are not exposed. `evaluation` is always
`not_evaluated`: conditions, required actors and binding to revised resources
must be qualified by AI-042/043/044. Even an approved business request leaves
`canApprove:false` and `authority:preview_only`. The current direct posting domain
does not enforce these workflow conditions; this adapter never calls it, and
future AI dispatch must not bypass that missing integration.

## Fingerprint and bounds

A repeatable-read, read-only transaction constructs a consistent snapshot. The
fingerprint binds adapter version, current actor/organization, fixed action and
entry ID, full header/line snapshot, displayed account labels and observed
business approval state. Direct line edits invalidate it even when updatedAt is
unchanged. The returned observedAt/expiresAt describe a five-minute display
window. These timestamps are generated on refresh; the fingerprint is stable
while the scoped snapshot remains identical. Supplying an obsolete fingerprint
returns `PREVIEW_STALE`; omit it to obtain a fresh observation. Records can change
after observation, and a fresh read is still required at future decision/effect
boundaries. This unkeyed fingerprint is neither a signed token nor a capability;
no existing decision or executor accepts it as authority.

Maximum 100 lines; header memo/reference and line descriptions at most 2000
characters; account code/name at most 200/500 characters; full encoded preview at
most 32768 UTF-8 bytes. Oversized observations fail closed without truncating an
effect. There is no incomplete-page approval or silent partial selection.

| Code | Recovery |
|---|---|
| PREVIEW_ONLY | Inspect the record or refresh the preview; no approval operation yet |
| PREVIEW_DENIED | Contact an administrator; no unauthorized record detail |
| PREVIEW_NOT_FOUND | Inspect an authorized record; absent, foreign and deleted records are indistinguishable |
| PREVIEW_STALE | Refresh preview |
| PREVIEW_UNSUPPORTED | Inspect the record; unsupported source/status needs another reviewed adapter |
| PREVIEW_TOO_LARGE | Inspect the record; no truncated effects |
| PREVIEW_INVALID_RECORD | Inspect/correct the record through existing authorized domain workflows |
| PREVIEW_PERIOD_LOCKED | Inspect the record and current domain period policy |

Malformed requests receive existing REST/MCP validation errors. Authentication
failures remain at the transport boundary. No model confirmation, clarification,
JSON field or preview read can approve or execute an action.

## Qualification boundary

The focused disposable-database test exercises actual REST handlers, linked
registered MCP calls and SQL no-write assertions. It does not qualify approval
decisions, sensitive dispatch, selected batches, live providers, browser/native
Persian UX or production rollout. Default-off execution and all existing release
gates remain unchanged.
