# Dashboard, saved report, delivery and budget integration (MON-105)

2026-10-08, Asia/Tehran. Technical self-review; independent accounting, production
and MON-029 report-wide acceptance remain separate. This consolidates MON-119..123
without replacing their detailed boundary maps or immutable evidence.

## Complete boundary map

REST paths below begin with `/api/v1`. MCP tools take the server's AuthContext and
use shared direct-DB services with wrapTool; no caller-selected tenant or HTTP
self-call is supported. Money aliases are additive; no public full-int64 or
exact-only negotiation is introduced.

| REST boundary | MCP operation | Inputs and outputs | Detailed contract |
|---|---|---|---|
| GET dashboard/widgets/accounts_receivable/data | get_dashboard_receivables | Optional currencyCode; total/totalMinor, currencyCode, count, overdueCount | [Dashboard data](DASHBOARD_DATA_WIRE_CONTRACTS.md) |
| GET dashboard/widgets/accounts_payable/data | get_dashboard_payables | Same controls/fields for bills | Dashboard data |
| GET dashboard/widgets/bank_balances/data | get_dashboard_bank_balances | Optional currencyCode; accounts with id/name, balance/balanceMinor, currencyCode | Dashboard data |
| GET dashboard/widgets/inventory_alerts/data | get_dashboard_inventory_alerts | Empty input; lowStockCount, first ten low-stock items and physical quantities | Dashboard data |
| GET dashboard/widgets/quick_actions/data | get_dashboard_quick_actions | Empty input; four action identifiers | Dashboard data |
| GET dashboard/alerts | get_dashboard_alerts | Optional currencyCode; overdue invoice/bill total/totalMinor/currency/count, operational counts and reconciliation accounts | Dashboard data |
| GET dashboard/layouts | list_dashboard_layouts | Empty input; {layouts} | [Layouts](DASHBOARD_LAYOUT_WIRE_CONTRACTS.md) |
| POST dashboard/layouts | create_dashboard_layout | name, ordered layout placements, optional isDefault; {layout} | Layouts |
| GET dashboard/layouts/:id | get_dashboard_layout | Owned UUID; {layout} | Layouts |
| PATCH dashboard/layouts/:id | update_dashboard_layout | Owned UUID and at least one supplied layout field; {layout} | Layouts |
| DELETE dashboard/layouts/:id | delete_dashboard_layout | Owned UUID; {success:true} | Layouts |
| POST reports/run | run_custom_report | Allowlisted source/columns/AND filters, empty groupBy, optional dates/chartType; {data,total} | [Custom reports](CUSTOM_REPORT_WIRE_CONTRACTS.md) |
| GET reports/saved | list_saved_reports | Empty input; {reports} | Custom reports |
| POST reports/saved | create_saved_report | name, optional description, validated config; {report} | Custom reports |
| GET reports/saved/:id | get_saved_report | Scoped UUID; {report} | Custom reports |
| PATCH reports/saved/:id | update_saved_report | Scoped UUID and at least one name/description/config field; {report} | Custom reports |
| DELETE reports/saved/:id | delete_saved_report | Scoped UUID; {success:true}, soft deletion and audit | Custom reports |
| GET reports/saved/:id/export | export_saved_report | Scoped UUID; REST literal CSV, MCP base64 file envelope | Custom reports |
| GET report-schedules | list_report_schedules | page/limit; {data,pagination} with validated savedReport | [Schedules](REPORT_SCHEDULE_WIRE_CONTRACTS.md) |
| POST report-schedules | create_report_schedule | savedReportId, frequency, recipients, format and local timing; REST {reportSchedule}, MCP schedule | Schedules |
| GET report-schedules/:id | get_report_schedule | Scoped UUID; REST {reportSchedule}, MCP schedule | Schedules |
| PATCH report-schedules/:id | update_report_schedule | Scoped UUID and supplied timing/delivery/active fields; same envelope | Schedules |
| DELETE report-schedules/:id | delete_report_schedule | Scoped UUID; {success:true}, soft deletion/disable and audit | Schedules |
| POST report-schedules/:id/trigger | trigger_report_schedule | Scoped UUID, no body controls; {sent} recipient count, including paused schedules | Schedules |
| POST budgets/check-alerts | check_budget_alerts | Empty object; checked/alerted counts and evaluations with budgeted/actual/threshold and Minor siblings | [Budget alerts](BUDGET_ALERT_WIRE_CONTRACTS.md) |

Related controls/consumers retained by this slice:

- POST budgets/PATCH budgets/:id and create_budget/update_budget accept optional
  varianceThresholdPct, an integer 0..2147483647 or null to disable. Omission
  preserves create's 100 default or the current PATCH value. Budget monetary
  inputs accept agreeing total/totalMinor and amount/amountMinor; their complete
  CRUD map remains [BUDGET_WIRE_CONTRACTS](BUDGET_WIRE_CONTRACTS.md).
- `trigger/scheduled.ts` reportSchedulesTask calls processReportSchedules. The
  trusted internal worker scopes the runner and SMTP config to each schedule's
  organization; `{processed,sent,failed}` counts occurrences, not recipients.
  The integration fixture invokes this real processor locally, including
  concurrent due calls. Live Trigger execution/deployment is not claimed.
- `lib/api/bookkeeping-maintenance.ts` calls checkBudgetVariances, which retains
  the count-only `{checked,alerted}` envelope. The fixture invokes that shared
  internal budget consumer; other bookkeeping maintenance is outside this task.
- GET notifications reads resulting recipient-owned in-app records. Budget
  checks leave financial/audit rows unchanged and deduplicate per period/user;
  optional email/digest work runs after commit and is best effort.

## Units, ranges and authorization

Dashboard document totals and custom-report financial columns retain documented
fixed integer cents. Bank balances use bank currency minor units. Every numeric
money field has an agreeing canonical signed ASCII `*Minor` string. Values are
bounded to +/-9007199254740991; selected source and derived output overflow fail
with 422 LEGACY_NUMERIC_RANGE. Budget alerts use base-GL net activity, its absolute
actual and a bigint threshold product rounded half-up. Currency labels do not
convert, infer scales or mix amounts. Existing USD/IRR/JPY/KWD policies are covered
by the child fixtures; IRR production gates remain in place.

Saved CSV, PDF and schedule attachments retain literal integer units and aliases.
XLSX monetary cells are text, preserving all safe digits. Row counts, percent,
physical quantity, grid geometry and timing remain distinct units. Gregorian
date-only filters are inclusive; operational today is UTC. Local schedule zone
is independent of currency and retains the documented DST policy.

Opaque layout config is JSON, not a report configuration or an executable money
contract. Safe finite numbers and arbitrary exact strings round-trip without
invented aliases or interpreting amount-like keys. Geometry can be fractional
and negative. Depth 32, 10000 nodes and 256 KiB bound the full payload. Persisting
the literal string `9223372036854775807` in a layout does not enable full-int64
financial execution. The combined fixture dispatches only documented widget
filters from the saved layout and verifies the opaque values remain intact.

All six dashboard MCP operations now register full strict object schemas. Unknown
controls are rejected by the SDK before shared service invocation, including
currencyCode on nonmonetary tools. REST likewise rejects unknown/duplicate
parameters. This corrects raw-shape registration silently stripping invalid input;
valid names, descriptions, data, monetary units and permissions remain compatible.

Financial dashboard/report reads require view:data; payroll execution/export
also requires view:payroll-reports. Schedule mutations/delivery additionally
require manage:reports; budget checks require manage:budgets. Personal layouts
retain both user and organization ownership without financial permissions.
REST API keys determine tenant scope even when a foreign organization header is
supplied. Invalid credentials yield 401, denied permissions 403 and missing or
foreign owned resources 404. Authentication lastUsedAt is separate from service
read-only and failed-write snapshots.

## Combined verification and limits

`tests/integration/dashboard-report-integration.test.ts` creates/migrates/drops
a disposable database and runs a full-registration SDK worker. Actual legacy
REST and exact MCP invoice writers feed saved layout widgets, custom execution,
CSV export and recorded scheduled CSV/XLSX delivery. Persisted report updates
change run/export/delivery together, including empty filtered output. A real
posted journal feeds numeric REST/exact MCP budgets, scoped recipient notices
and internal scheduled replay. Assertions use explicit 1250/2500 amounts,
500 thresholds, counts and XLSX text cells, as well as transport agreement.

All five child suites and budget CRUD/report regressions run with this parent.
They retain exhaustive CRUD, all six report sources, signed/safe/int64 limits,
currency policies, PDF content, stored dates/config/JSON corruption, permission
and nested-reference isolation, concurrent delivery and rollback assertions.
The new combined fixture checks full tool discovery/descriptions, unknown input
rejection, two tenants, disabled permissions, failed-state snapshots, opaque
layouts, unsafe invoice readers/delivery, corrupt saved reports and unsafe GL
budget checks. Actual saved-report deletion prevents manual/cron delivery and
run-metadata advancement on its surviving schedule. Financial rows stay unchanged by dashboard/report/config/delivery
and notification operations.

No schema migration, historical rescaling, full build, dev server, provider call,
live Trigger, deployment or production qualification is performed. SMTP is
recorded locally. External partial SMTP delivery/crashes lack a persistent outbox;
network exactly-once delivery is not promised. Post-commit budget mail/digest
failure may lack retry. Full-int64 financial clients, performance, visual PDF fit,
Persian review, accounting and broader MON-029 acceptance remain separate gates.
