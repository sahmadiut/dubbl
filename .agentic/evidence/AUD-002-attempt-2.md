# AUD-002 attempt 2: owner-authorized local test database

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant. Local checkout D:\Projects\dubbl; existing uncommitted agentic changes preserved. Owner explicitly confirmed that the database configured in .env is for testing and authorized necessary queries. Connection credentials are deliberately omitted. DEC-003 records the durable authorization.

## Observed checks

Two inline JavaScript probes were piped through PowerShell to `node --env-file=.env --input-type=module` from the repository root. Both exited 0. They used the existing pg dependency and DATABASE_URL, closed their connection pools and printed no connection credentials.

Probe 1 checked that the environment URL targets a loopback host and database `dubbl`, then queried `current_database()`, `current_setting('server_version')`, `current_setting('TimeZone')` and public information_schema table names. Connection succeeded; database `dubbl`, PostgreSQL 18.6, timezone Asia/Tehran. Application tables were present; migration completeness was not verified.

Probe 2 used `BEGIN READ ONLY`, `SELECT count(*)::int FROM <table>` for the six fixed application tables below, then `ROLLBACK`:

| Table | Observed rows |
|---|---|
| organization | 2 |
| journal_entry | 15 |
| journal_line | 33 |
| invoice | 10 |
| bill | 10 |
| bank_account | 3 |

No customer fields or financial amounts were read. No fixtures were inserted, records changed or migrations applied. These counts demonstrate query access, not financial reconciliation.

## Acceptance and handoff

Database availability/test-target confirmation is resolved. Docker execution remains omitted under DEC-002. Runtime startup reproduction, identifiable fixture setup, actual financial reports, screenshots and representative performance captures remain pending; no task completion or passing financial workflow is claimed. Dev startup still follows root AGENTS.md. Future necessary queries/scoped fixture work on this target do not need repeated test-target approval; wholesale database reset is not implied.

Historical attempt 1 and the Docker owner-decision evidence remain unchanged. Updated START_HERE.md, DECISIONS.md, BASELINE_RUNBOOK.md and AUD-002 handoff to expose the current authorization.
