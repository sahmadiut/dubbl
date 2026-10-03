# MON-040 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex; kind: self. Reviewed the uncommitted
MON-040 diff against task scope, adopted REST/MCP schemas/services, actual database
constraints/triggers and real fixture/evidence results. This is not peer/human,
independent accounting/security or deployment approval.

## Findings and repairs

- REST and MCP now share complete invoice lifecycle behavior and permissions.
  Old MCP status-only void/duplicated approvals and bad debt are removed, with
  a new registered lifecycle module. Actual full registration and SDK calls pass.
- Amount override units are explicit: interest major units versus recovery minor
  units. Canonical exact aliases, safe bridge, bigint sums/products/ratios and
  final conversion/interest rounding prevent float math or lossy serialization.
- Required accounts, header/line agreement, organization references, saved money/
  snapshots, state and period locks precede commit. Same-tenant journal source IDs
  cannot point to a different invoice. Decisions validate the assigned approver,
  and generic request actions cannot bypass invoice monetary preflight.
- Original journal reversals copy amounts/dimensions/exact FX without lookup or
  reconversion. Bad debt uses saved recognition FX. Trigger-assigned provenance
  remains canonical; new frozen snapshots capture base currency for change checks.
- New stock issues retain document IDs and original costs. Changed current costs
  do not alter restoration or COGS reversal. FIFO restores original consumed
  layers and exact shortfall cost; no draft void creates phantom stock. Legacy
  unlinked stock/FX remains explicitly documented instead of fabricated history.
- Atomicity covers header/lines/number/journal/stock/layers/warehouses/request/
  action/status. Negative fixtures compare complete mutation snapshots, including
  audits; triggered mid-operation failures and duplicate send/void pass. Successful
  audit details retain state/amount under the existing best-effort audit policy.
- Optional email options validate before recognition, external delivery follows
  accounting commit and PDF uses the document currency. Provider/PDF/outbox/token
  behavior is explicitly not qualified here; no external email was sent.
- Early unused imports, worker shutdown/typing assumptions and Windows Unicode
  comment encoding were repaired. Final affected checks pass, and immutable
  completed-task evidence was not rewritten.

## Acceptance and disposition

Approve MON-040 within its defined bounded lifecycle slice. Contract inventory,
actual legacy/exact REST/SDK tenant/auth fixtures, supported-value preflight and
atomic no-write/rollback behavior meet all three criteria. Refer to attempt 1
for real commands, outcomes and environment. No full build/dev server, schema/
migration/configured DB/IRR flag/provider/deployment change was made.

Residual gates: parent receivable integration, settlement, external writer/
lock/workflow/base-currency configuration races, historical unlinked stock/FX,
full-int64/report/domain math, HTTP/session/OAuth/browser, Linux/PostgreSQL 16,
email/PDF/provider and financial release qualification. Interest/recovery remain
repeatable accounting events; no request-key idempotency or recovery cap is
introduced. None of these is misrepresented as a passed release gate.
