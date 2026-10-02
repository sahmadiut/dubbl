# MON-004 self-review 1

2026-10-02, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer/human/accounting or production approval.

Approved within MON-004 expansion/backfill scope. Reviewed schemas, generated
snapshot/journal and final SQL, numeric/string policy and bridges, raw/ORM write
guards, IEEE decoder, invoker-rights resumable helper/runner, REST/MCP input
changes, financial/storage fixtures, refreshed inventories and runbooks/evidence.

Snapshot comparison preserves every original column and non-column schema
object; new SQL is confined to 20 fields/four CHECKs on four actual FX tables,
helper functions, eight triggers and backfill. Old rates, amounts, date/currency/
tenant identifiers are never assigned in migration SQL. Invalid history is
quarantined rather than guessed. Payroll binary decoding tests independently
cover normal/subnormal, signed/zero and maximum finite values. Floating legacy
input intent is not claimed to be recoverable.

Review identified an explicit-stale-field edge: detecting value changes alone
would auto-correct an explicitly conflicting exact field equal to OLD. Added
UPDATE OF guards and an actual failing-pair regression; final suite rejects it.
MCP input no longer silently rounds, REST rejects overflow before DB, and role
denial remains tested. No org lookup or SECURITY DEFINER privilege is added.
Standalone batches commit, skip locks, report incomplete work and can resume;
initial migration remains atomic and lock failure/retry is tested.

Final checks: 65 unit tests and 13 PostgreSQL 18.6 integration tests pass, including
earlier migration/ledger/backup suites. Typecheck/lint pass with 167 existing
warnings. Inventory/export cross-checks, snapshot preservation, migration drift
and diff checks pass. All fixture databases were removed and dedicated server
stopped. The configured DB was queried only for read-only sanitized counts.

Physical 20/18 capacity is tested with guards disabled only in a disposable
fixture; this does not qualify live high-rate scaled consumption. Runtime guards
intentionally reject unrepresentable int32/six-place exact pairs. Out-of-policy
positive payroll floats preserve legacy behavior with null exact rates and review
status. All public/provider/domain cutover and cohort remediation remain explicit
later tasks. Additive returned metadata retains original numeric properties.
Historical manual-line direction and mutable parent currency context still need
business qualification. No implicit inverse rounding, CBI availability, IRR
enablement, production deployment or PostgreSQL 16 execution is asserted.
