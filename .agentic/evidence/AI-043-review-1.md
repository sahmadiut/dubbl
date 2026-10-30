# AI-043 self-review

2026-10-30, Codex, actual self-review; no peer/human review claimed.

Reviewed the strict schema, own-run scope, current identity/permissions, shared
REST/MCP registration, exact selection/resource/policy/step binding, idempotency
and SQL constraints, all lock orderings, post-write revalidation, rejection and
retention behavior, existing business policy and ordinary model exclusion.
Reviewed generated migration/snapshot and the scoped registry changes. No Stripe
file or functionality changes and no automatic sensitive catalog addition.

The positive authority boundary is deliberately narrow: approval is an explicit
session operation recording one immutable decision, and canApprove reports that
capability. Actual production MCP tokens must open interactive approval; they
cannot manufacture consent through a field or tool call. Rejection through MCP
is safe Stop-like invalidation. This restriction is documented/tested rather than
claiming token-backed positive approval qualification. Decisions never satisfy
legacy business approvals, enqueue a run or dispatch sensitive effects. The
future executor must bind to the latest unsuperseded batch, exact decision and
selection, recheck resources/policy/permissions/expiry and fence effects.

Actual checks and initial fixture/tooling corrections are in
AI-043-attempt-1.md. Focused REST/MCP/SQL tests cover concurrent duplicate and
competing decisions, both Stop orderings, late revocation/resource/expiry rollback,
policy/self-approval denials, selection edits, cancellation, stable metadata
receipts and preservation of completed effects. Application typecheck/lint,
surrounding storage/migration regressions and capability audits pass. The existing
1447 money inventory failures remain byte-for-byte the baseline error list; there
is no global green inventory assertion.

Accepted for AI-043's explicit decision scope. AI-044/008, browser/native Persian,
real external providers/delivery, deployed worker supervision, production auth
interactions and release/activation remain unqualified. No blocking finding
remains in this scoped change. Complete the controller task and commit only
owned files locally; no push or next-task implementation.
