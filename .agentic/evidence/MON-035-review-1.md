# MON-035 self-review 1

2026-10-02, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review,
not independent peer/human/accounting or deployment approval.

Approved for journal CRUD only. Reviewed two REST CRUD route files, entry-tool
CRUD portions/new delete tool, shared wire/reference/delete helpers, MCP period
error classification, unit/DB SDK fixtures, API documentation, task graph split
and registries. MON-018 retains unchanged integration criteria; lifecycle/import
and recurring acceptance is assigned MON-036/037, not claimed complete.

Findings corrected during implementation/review:

- Guard arbitrary-bigint intermediates against the safe Number bound before
  storage-domain int64 checks, preserving classified 422 even for enormous products.
- Select exact saved FX as SQL text inside relational Drizzle JSON to avoid
  Number decoding; normalize strings with exactRate. Never guess null history.
- Keep MCP's preexisting raw-equality balance policy and document its difference
  from REST create instead of silently changing accounting behavior in wire rollout.
- Validate tenant-owned dimensions and canonical dates before writes; enforce
  missing REST create/delete permissions and deletion lock checks. Reject foreign
  historical account labels on detail reads. Add corresponding MCP deletion.
- Create headers/legs in one transaction and condition edits/deletes on current
  tenant/draft state; real synthetic PostgreSQL trigger failures demonstrate rollback
  after header insert/update and leg replacement, with unchanged audit snapshots.
- Preserve exact legacy REST decimal strings even at safe-max values. Automated
  stored base amounts and saved original currency tags are not converted twice.
- Inject malformed historical FX only in disposable fixtures with transactional
  trigger control; do not weaken new-write database safeguards.

Final evidence: 101 unit passes, four real DB/SDK workers pass, final typecheck
passes, full lint 0 errors/167 baseline warnings, final changed-file lint clean,
controller 31 passes/one Windows privilege skip, inventory verification and diff
checks pass. The disposable PostgreSQL server was stopped with no remaining test
databases. No configured DB, schema, migrations, balances, rollout flags or provider
connections were changed.

Limits are explicit: Number-domain safe-range rejection remains; legacy REST
fixed-two-decimal output and mixed manual-currency raw sums remain compatibility
contracts; full exact FX/currency-scale/posting policy, HTTP OAuth/session/browser,
full concurrency/audit guarantees and production IRR qualification are pending.
Existing generic MCP missing/non-draft errors remain errors without specific status.
Only shared period-lock classification is changed outside CRUD. No deployment,
external human approval or peer-review identity is fabricated.
