# MON-039 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review,
not independent peer/human accounting/security/deployment approval.

Approved within the bounded invoice CRUD write slice. Reviewed adopted REST
POST/PATCH/DELETE, direct-DB shared services/schemas, registered MCP create/new
update/new delete, actual handler/SDK/database fixtures, public docs, contract
registry and monetary source inventory. No schema/migration/flag changes.

Findings resolved before submission:

- Keep decimal-major numeric input distinct from minor storage. Exact decimal
  and integer aliases validate agreement rather than coercing or rescaling.
  Minor-only input cannot preserve an unrounded sub-minor fraction; documentation
  explains major versus minor semantics and preserves separate create/edit order.
- Use signed bigint ratios for price/quantity/discount/tax and bigint sums before
  safe-number bridges. Validate gross even if a later discount would hide overflow.
  Validate individually unsafe history as well as net credit/header sums.
- Scope every contact/dimension/list and persist inventory/project/cost-center
  fields. Owned inactive lists retain item fallback; retained history allows
  inactive references without exposing foreign data. Reject unsupported list/
  inventory/credit currency combinations before writes.
- Keep old and new date locks, draft-only edits/deletes, current numeric envelopes,
  MCP USD/zero defaults, terms fallback and existing plan/approval policies.
  Added MCP price-list/credit/approval parity is explicitly documented.
- Make sequence/header/lines/create approval one transaction; preflight saved
  opaque response JSON before edits. Fixtures assert create/replacement/delete/
  approval rollback and concurrent first/existing numbering. Best-effort audit
  policy is accurately identified rather than claimed as transaction-integrated.
- Initial fixture bugs and self-hosted plan-mode assumption were corrected and
  are disclosed. Typecheck and targeted lint are clean; full lint warnings remain
  existing repository warnings. Native MCP schema error text is handled honestly.

Attempt evidence records 114 full unit passes, final actual write worker passing,
existing read worker passing, typecheck/full lint and inventory/hash/line checks.
Controller regression outcome is recorded in the finalized attempt evidence.
Synthetic PostgreSQL is stopped with zero fixture databases. No real user data
or environment credentials were printed or persisted.

Limits: safe-number coexistence, existing best-effort audit and absence of request
idempotency keys remain explicit. Cross-writer/lock/workflow/plan races and actual
HTTP/session/OAuth/browser, domain posting/inventory/approval, financial and
production qualification remain their separate tasks. MON-019 retains all parent
integration acceptance. Next selected task after completion: MON-040.
