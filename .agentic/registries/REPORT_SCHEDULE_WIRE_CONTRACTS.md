# MON-122 report schedule and delivery contracts

Verified 2026-10-08, D:/Projects/dubbl. Implementation: shared
`lib/reports/schedules.ts`, `schedule-wire.ts`, `schedule-export.ts`,
`schedule-processor.ts`, three REST files and the existing registered
`lib/mcp/tools/report-schedule-tools.ts`. Self-review only.

## Boundary map

| REST/worker boundary | MCP tool | Inputs and outputs |
|---|---|---|
| GET /api/v1/report-schedules | list_report_schedules | page/limit; `{data,pagination}` with validated savedReport metadata |
| POST /api/v1/report-schedules | create_report_schedule | Create fields below; REST 201 `{reportSchedule}`, MCP schedule row with savedReport |
| GET /api/v1/report-schedules/:id | get_report_schedule | Live owned UUID; REST `{reportSchedule}`, MCP schedule row with savedReport |
| PATCH /api/v1/report-schedules/:id | update_report_schedule | UUID and at least one mutable field; same envelopes as GET |
| DELETE /api/v1/report-schedules/:id | delete_report_schedule | UUID; `{success:true}`, soft-delete/disable and audit |
| POST /api/v1/report-schedules/:id/trigger | trigger_report_schedule | UUID; `{sent}` recipient count, immediate delivery including paused schedules |
| trigger/scheduled.ts reportSchedulesTask | Trusted worker, no public tool | processReportSchedules(); `{processed,sent,failed}` schedule counts; same delivery preflight |

No separate HTTP cron implementation exists in this checkout. The existing
Trigger task calls the shared processor every hour with its existing retry
policy. Execution may be later than the configured minute within that cadence.
REST authentication fixes the organization; tenant headers cannot override an
API key. MCP uses the server AuthContext and direct DB services, not HTTP.
All operations require view:data. Writes/manual delivery additionally require
manage:reports; execution of payroll configs additionally requires
view:payroll-reports. Background processing is trusted organization automation
with owner-equivalent execution, not a synthetic human or public auth bypass.

## Inputs, units and ranges

Create requires savedReportId (live same-org UUID), frequency
daily/weekly/monthly/quarterly, and 1-100 validated email addresses (max 254
characters each). Defaults: PDF, 08:00, UTC. Optional dayOfWeek is integer 0-6
or null; dayOfMonth is integer 1-28 or null. Time is strict HH:MM (24-hour).
Timezone is an IANA identifier/alias supported by the runtime, max 100
characters; numeric offset strings reject. PATCH supports these timing/format/
recipient fields plus boolean isActive; savedReportId is immutable. Omitted
PATCH fields remain omitted, including create defaults. Unknown keys reject.
Irrelevant weekday/month-day fields are preserved but only used by their
applicable frequency. Null weekly day defaults to Monday; null month day to 1.

nextRunAt is the first future local calendar occurrence in the specified zone.
Quarterly means January/April/July/October on the chosen day. Nonexistent DST
times skip that occurrence; repeated times use the earlier instant once.
Gregorian dates/UTC timestamps, scheduling controls, counts and physical
quantities are separate from money. Successful runs advance from execution
time; missed occurrences coalesce into one delivery, not a catch-up burst.
Pause/resume/timing PATCH recalculates nextRunAt; manual trigger also advances
it. Background delivery ignores paused/deleted/future schedules.

REST pagination defaults 1/50, caps a valid limit above 100 at 100 (preserving
the current UI's limit=200 request); MCP limit is strictly 1-100. Pages are
integers 1-1000000; malformed/nonfinite/fractional controls reject. Empty pages
retain a pagination envelope. All schedule and referenced saved-report configs
and timestamps are validated before JSON serialization. SQL isfinite checks
prevent infinity from being misparsed by the Date adapter. Foreign/deleted
saved reports are never included or executed; unsupported stored rows reject
without historical repair.

The six custom sources, column/filter/date allowlists, literal filter strings,
inclusive dates, null handling and output aliases remain the
[MON-121 contract](CUSTOM_REPORT_WIRE_CONTRACTS.md). Actual runner output
retains numeric integer cents with additive matching canonical signed Minor
strings. Supported range is +/-9007199254740991, including exact-only columns;
unsafe int64 source values reject with LEGACY_NUMERIC_RANGE/422. Nullable money
remains null. USD/IRR/JPY/KWD values do not rescale; no FX or currency aggregation.

## Preflight and delivery

Create, PATCH and delete execute and render the current saved report before
scheduling mutation. Writes use repeatable-read transactions, row locks for
existing schedules and returned-row serialization guards before commit. CRUD
keeps audit entries and REST request metadata. List/detail validate metadata
and saved configs in read-only repeatable-read snapshots without delivering.
The custom runner now accepts a transaction reader so scheduling preflight does
not query through an unrelated connection.

Delivery validates current schedule, owned live saved report/config, source
data, attachment and next occurrence before SMTP or run metadata changes.
CSV bytes match saved CSV export (same filters/dates/projection/escaping and
empty headers). PDF contains literal field/value text with integer units and
Minor aliases, automatic page flow, no numeric display conversion. XLSX writes
both legacy money and Minor columns as text cells, preserving 16-digit safe
integers beyond Excel's numeric precision. Counts/quantities remain numeric;
null is blank; plain strings remain literal, not formula objects. Names are
sanitized for attachment filenames and escaped for email HTML. All recipients
get the same Buffer attachment in the selected format via their org's SMTP.

Delivery locks the schedule across preflight/send/metadata update. Competing
due workers recheck due state after acquiring the lock, preventing duplicate
successful occurrences. Success sets lastRunAt/status and nextRunAt. Preflight
and SMTP failures leave run metadata unchanged; worker counts/logs failures,
and manual callers receive the actual error. There is no persistent outbox or
provider idempotency: a crash after SMTP acceptance or partial-recipient failure
can lead to repeat delivery on retry. SMTP cannot roll back with a DB transaction.
No exactly-once network or revocation-at-send guarantee is claimed. Rendering
large reports and holding locks through SMTP are not performance-qualified.

## Verification and ownership

Pure timing/input fixtures plus actual migrated PostgreSQL REST/API-key/MCP SDK
fixtures cover all six operation pairs/full registration, invoice legacy/exact
writers, formats/content, safe signed edges, int64 rejection, empty filtered
output, permissions/payroll, tenant spoofing/references, stored config/timestamp
corruption, recorded SMTP failures and concurrent due workers. Failed-operation
snapshots verify unchanged schedule/config/financial/audit data and mail counts.
The adjacent custom/dashboard fixture suites cover all six sources and prior
contracts. No real provider request, deployment, full integration/financial
qualification or PDF visual-fit/localization qualification is claimed. No
schema/application migration, history rescale or IRR enablement. MON-105 and
MON-029 retain independent combined integration acceptance.
