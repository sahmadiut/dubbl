# RTL-006 self-review

Reviewer: `codex-task-013`. Kind: **self**. This is not a peer, owner, native,
browser, accounting or production approval.

## Acceptance review

1. Shared text scopes use native isolated `bdi` with auto or LTR direction.
   Four presentation combinations retain caller text, escaping and accessibility
   props. Identifier samples cover long keys, email/URL, IBAN, UUID and document
   numbers, including exact whitespace. CSS supplies selection and arbitrary
   wrapping; no inserted Unicode markers or value normalization is used.
2. Actual shared native email/URL inputs default to LTR isolation and accept
   explicit direction overrides. Generic types retain inherited behavior.
   Tests preserve refs, native validation/type/name, value, errors, descriptions
   and exact callbacks. Thirteen existing literal email call sites receive this
   shared presentation behavior without page edits.
3. Actual API-key reveal/create components use the shared scope and a label/input
   association. Long displayed secrets remain exact and escaped; real callback
   bodies copy the exact key and forward unchanged name values. Actual provider,
   auth/contact, financial-input and focus regressions pass together.

## Scope and limits checked

The task was isolated, then rebased onto the current owner/CI baseline rather
than overwriting their changes. Existing CI-003 records remain present. The parent
RTL-002 retains original criteria and independent acceptance after RTL-007/008.
Font packaging, all module/output identifiers, computed mobile/zoom/text-spacing,
native linguistic review and actual browser selection/focus/layout are not
accepted here. There are no screenshots, builds, dev-server startup or DB writes.

No new business operation/API/MCP schema, money unit, ISO code, route or output
contract changes. Dedicated/frozen billing/pricing/checkout/mixed provider sources
match the current baseline; no Stripe-specific work. Source hashes and required
gates are recorded in [task evidence](RTL-006-attempt-1.md).

Review approval is entered in the controller only after all recorded required
checks pass and final task-owned scope/whitespace/links are verified. The final
local task commit is integrated only if it can preserve current primary work.
