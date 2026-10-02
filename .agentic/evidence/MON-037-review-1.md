# MON-037 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review;
no independent peer, human accounting, security or deployment approval is asserted.

Approved within the bounded recurring contract scope. Reviewed recurring-journals REST CRUD/pause/run, all eight registered MCP tools,
shared wire/services, the generation diff, pure/actual DB fixtures and inventory/
documentation. Scope is MON-037 only; MON-018 keeps integration, MON-007/QA keeps
the broader domain and production qualification gates.

Findings corrected before final verification:

- Removed the create-default USD from partial update currency validation. Both
  pure fixture and actual MCP metadata edit now preserve the saved IRR tag.
- Defined fixed identity FX explicitly because the template schema has no saved
  configurable rate. Reject unsupported rates instead of claiming they persist;
  generated entries explicitly retain identity rate/direction/provenance and DB
  migration status exact. No market-rate lookup or base-currency conversion.
- Guard individual and summed amounts with bigint before Number-domain mutation;
  canonical strings do not imply full-int64 workflow support. Unsafe stored sums
  also fail reads/generation without consuming schedule; malformed legs are never
  filtered into apparently balanced entries.
- Scope dimensions before writes and historical reads. Lock parent templates for
  edits/status/toggle/generation and reread current state after lock. Soft deletion
  retains posted entries and cannot accidentally target another tenant/type.
- Commit the whole template catch-up with schedule, rather than leaving posted
  entries committed while schedule advancement fails. Forced late SQL failure
  proves rollback; concurrent runs of one template generate three entries once.
- Keep locked/closed-period skip/consume behavior; document pause/resume's actual
  catch-up semantics rather than the old misleading no-backfill description.
- Return the current updated header from toggle; revalidate retained legs before
  activation. Shared direct-DB services avoid independent REST/MCP validation drift.
- Narrow union fixture amount properties for TypeScript instead of weakening types.

Final evidence records 107 full unit passes, six migrated PostgreSQL REST/MCP
workers passing with process concurrency 1, typecheck passing, full lint 0 errors/159 existing warnings, changed-file lint clean, inventory/Drizzle/
hash/line verification and diff checks passing. The disposable cluster is stopped
with zero remaining fixture databases. Initial alias-default/status assumptions,
fixture type error and Windows concurrent-check memory failures are disclosed;
failed attempts are not represented as passes.

Limits remain explicit in RECURRING_JOURNAL_WIRE_CONTRACTS: template transactions
do not make all templates/organizations atomic; existing MAX+1 numbering across
different templates/writers is not concurrency-qualified; reference/period-lock
races and best-effort audit durability remain broader gates. Generic recurring
CRUD/other recurring document types, frontend money/calendar policy, HTTP/session/
OAuth/browser, full base-currency/exact-domain math and production IRR are not
claimed. No schema/migration/configured DB/provider/deployment/rollout changes.
