# Approval condition contracts (MON-073)

## Operations and envelopes

All operations use AuthContext organization scope. REST routes live under
`/api/v1`; MCP tools remain registered by registerApprovalTools in index.ts.
Services use Drizzle directly. No public exact-mode switch or unit change.

| REST operation | MCP operation | Result |
|---|---|---|
| GET approval-workflows | list_approval_workflows | REST data/pagination; MCP workflows/total/page/limit |
| GET approval-workflows/:id | get_approval_workflow (added) | workflow, with ordered steps and public member/user profiles |
| POST approval-workflows | create_approval_workflow | workflow; REST 201 |
| PATCH approval-workflows/:id | update_approval_workflow | workflow; omitted fields retain saved values |
| DELETE approval-workflows/:id | delete_approval_workflow | success; soft deletion preserves history |
| GET approval-requests | list_approval_requests | REST data/pagination; MCP requests/total/page/limit |
| GET approval-requests/:id | get_approval_request | request, nested workflow/steps/requester/actions |
| POST approval-requests/:id/action, approve | approve_request | request header; document lifecycle delegate retained |
| Same, reject | reject_request | request header; invoice rejection still requires comment/reason |
| Same, comment | comment_approval_request (added) | request header, unchanged decision/step |

Workflow writes retain manage:bills, including custom roles. Reads retain
authenticated organization access. Generic expense/journal/purchase-order
approve/reject require current assigned member; comments require organization
membership. These generic actions change approval metadata only: they do not
approve/post/pay the underlying document. Bill and invoice actions retain their
existing role, period/fiscal lock, monetary preflight, posting and status behavior
through the qualified MON-048/040 lifecycle services. Their existing audit policy
is unchanged. New workflow/generic metadata writes have required atomic audits.
No new generic public request-creation operation is introduced. Existing invoice
create/submit paths still initiate requests; the internal creation helper now
validates owned references and audits its insertion.

## Inputs, units and exact aliases

Workflow creation requires name (1..255 chars), entityType, 1..100 ordered steps;
conditions default to [] (max 100), isActive defaults true. Step approverId is a
member UUID, not a user UUID, and must belong to the organization. isRequired
defaults true; existing behavior still visits all steps sequentially, including
isRequired=false. Updates are strict patches. Changing type or step assignments
after any request references the workflow returns 422. An identical submitted
step list is accepted without replacing rows, preserving editor metadata edits
and history. Step order is generated 1..N for new/replaced lists. Historical
positive, unique, increasing int32 order values, including gaps, remain valid;
the next greater order is used. Invoice creation now initializes the first saved
step order rather than assuming 1.

A condition is {field, operator, value? , valueMinor?}. Money's existing `value`
was already a string: it stays a string, not a numeric monetary alias. Additive
`valueMinor` accepts the same canonical signed int64 string. Either is accepted;
both must agree exactly. Persist only canonical `value` in existing JSONB;
responses add valueMinor on monetary fields. No schema/migration is required.

| Entity type | Monetary header fields |
|---|---|
| invoice, bill | subtotal, taxTotal, total, amountPaid, amountDue |
| expense | totalAmount |
| purchase_order | subtotal, taxTotal, total |
| journal_entry | None: no invented header total or implicit sum of journal lines |

Money thresholds use the compared document's currency minor units. USD 1250,
JPY 1250, KWD 1250 and IRR 1250 remain the integer 1250. No conversion, cents
assumption or currency inference. Add a currencyCode equality condition when a
workflow should apply only to one denomination. Pure comparison supports full
signed int64 thresholds and canonical string/bigint operands. Actual number-based
document workflows/ORM retain their safe integer bounds; full-range document
creation/posting is not advertised. Thresholds above Number.MAX_SAFE_INTEGER
remain useful exact comparisons and never become Number.

Numeric headers entryNumber (journal ordinal) and depositPercent (invoice basis
points) accept canonical signed int64 comparison strings in their own units;
they do not accept valueMinor or gain monetary aliases. All integer fields
support eq/neq/gt/lt/gte/lte using bigint. Text fields support literal eq/neq only.
Supported text headers are explicit, visible in the tool field enum and checked
against entityType in conditions.ts:

- bill/invoice/purchase_order: id, organizationId, status, reference, createdBy,
  contactId, issueDate, currencyCode, notes; bill adds billNumber/dueDate,
  invoice adds invoiceNumber/invoiceType/dueDate, purchase_order adds
  poNumber/deliveryDate.
- expense: id, organizationId, status, title, description, submittedBy, currencyCode.
- journal_entry: id, organizationId, status, reference, createdBy, date,
  description, sourceType, sourceId, fiscalYearId.

Text identifier values are comparison literals, not dereferenced links or a
mechanism to read another organization's data. New actual links (approvers,
workflows, requester members, action members/steps, document entity references)
are qualified for organization ownership. Missing/null header operands do not
match, including neq; they are not coerced to empty strings or zero. All conditions
are validated before AND evaluation; invalid saved active workflow conditions
fail closed even when another workflow would match. No Number/parseFloat/partial
parsing of thresholds. Unsupported fields, text ordering, unknown object keys,
missing/conflicting aliases, fractional money, leading zeros, exponents,
whitespace, localized digits, nonfinite/unsafe Numbers and out-of-int64 values
reject visibly. This intentionally corrects previously accepted coercions.

Requests/actions carry UUIDs, status, integer currentStepOrder, UTC timestamp
serialization and text comments (max 4096), without invented monetary aliases.
Request listings share entityType/status/current approver filters. Pagination is
page 1..21474836, limit 1..100, with canonical positive REST query spellings;
partial parseInt forms are rejected. Unknown query parameters remain ignored.

## Storage, errors and transactional behavior

Workflow writes acquire the organization lock also used by adopted invoice
writers. Selection within invoice create/submit uses the caller's transaction,
so configuration and submission cannot race outside that lock. Workflow,
steps and required audit commit together; pre-return DTO/audit serialization is
validated inside the transaction. Generic actions lock organization/request,
qualify the current scoped document/member/steps, and record action/status/audit
atomically. Terminal-request concurrent approvals allow one committed final
action. Repeated calls to a pending multi-step workflow may intentionally approve
the next step; no client operation token/expected-step idempotency is invented.

Reads use repeatable-read read-only transactions. Workflow conditions, step
members, request workflow/type/requester/actions and document ownership are
checked before returning nested data. Foreign links fail before profile disclosure;
user relations select only id/name/email/image, excluding password/session/TOTP
material. History remains readable after workflow or document soft deletion;
new internal requests/generic actions require live documents. Soft-deleted
workflows cannot receive new requests but existing pending history remains
actionable as before; isActive controls selection, not existing decisions.

Validation errors/malformed JSON are REST 400; authentication 401, forbidden
roles/assignees 403, missing/scoped-out references 404, immutable workflow state
or invalid saved payload/ranges 422. Saved condition errors use classified
LEGACY_NUMERIC_RANGE rather than bigint serialization crashes or rounded numbers.
MCP uses wrapTool's consistent error results. Condition replacement can explicitly
repair invalid string JSON; unrelated patches cannot conceal it. Unsafe existing
opaque Number data cannot be serialized into audit history and remains a separate
remediation case; no historical backfill or guessing is performed.

## Qualification bounds

tests/approval-conditions.test.ts covers operators, full-int64 edges, aliases,
malformed inputs, scalar units and currency-independent comparisons. The actual
approval-contracts PostgreSQL fixture calls every REST operation and all ten
registered MCP tools with linked SDK transports, two tenants, owner/custom
manager/viewer roles, unsafe saved JSON, foreign references, concurrent final
approvals, soft-delete history and injected audit/step failures. It invokes
actual invoice REST/MCP creation with >int32 KWD totals and exact conditions.
Existing invoice CRUD/lifecycle and bill lifecycle suites retain regression
qualification including posting, period locks and rollback.

Generic opaque/export writers and historical remediation remain MON-034/033;
MON-022 retains combined configuration acceptance. This is not a network server,
browser/session UI, independent security/accounting, PostgreSQL16, full-domain
int64, production migration or IRR-enablement qualification. No build/dev/deploy
or existing balance/schema/unit/flag change.
