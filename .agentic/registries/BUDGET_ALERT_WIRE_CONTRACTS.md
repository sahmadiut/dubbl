# Budget notification contracts

MON-123, source and fixture verified 2026-10-08, Asia/Tehran. Shared implementation:
`lib/api/budget-alerts.ts` and `budget-alert-wire.ts`. MON-105 retains combined
dashboard/report/notification integration acceptance.

| Boundary | Inputs and outputs | Authorization and scope |
|---|---|---|
| REST POST `/api/v1/budgets/check-alerts` | Required JSON `{}`; 200 `{checked, alerted, evaluations}` | AuthContext from session/API key; `manage:budgets`; caller's organization only. Body tenant, date, money and other controls are rejected. |
| MCP `check_budget_alerts` | Same empty object, counts and evaluations; direct shared DB operation via `wrapTool` | Same permission and AuthContext organization; no HTTP self-call. Registered by the existing budget tool registrar. |
| REST budget POST/PATCH and MCP create/update | Add optional `varianceThresholdPct` integer percent; 0..2147483647, null disables; create omission uses existing DB default 100, update omission preserves it | Existing shared budget write permission, organization/reference guards, transaction and audit. Header outputs retain numeric percent/null. Existing numeric and exact budget amount inputs remain supported. |
| Internal `checkBudgetVariances` | No public tenant/date input; returns existing `{checked, alerted}` counts | Trusted scheduled worker selects all organizations. Existing bookkeeping-maintenance and Trigger consumers call this same exact implementation without changing their envelope. |
| In-app notifications and optional email/digest | Existing title/body/entity fields; organization-currency decimal strings in body | One in-app row per organization, period and recipient (owner/admin). Preference-based delivery follows commit; failures are best effort. Existing notification GET retains current-user/org scope. |

## Units, arithmetic and ranges

Budget line totals and period amounts keep existing integer cents/storage units;
no FX, locale conversion, magnitude inference or historical rescaling occurs.
Budgets inherit `organization.defaultCurrency`. Posted GL debit/credit values are
already in organization base units: journal-line document currency tags are not
used to reconvert them. Currency metadata determines display decimal places only
(USD 1250 -> USD 12.50; IRR/JPY 1250 -> 1250; KWD 1250 -> KWD 1.250).

Evaluations contain `budgetId`, `accountId`, `periodId`, `currencyCode`,
`thresholdPct`, `exceedsThreshold` and three monetary pairs:
`budgeted`/`budgetedMinor`, `actual`/`actualMinor`, `threshold`/`thresholdMinor`.
Numeric money remains an integer within +/-9007199254740991. Minor aliases are
canonical agreeing integer strings in exactly the same units. Counts and percent
are ordinary Numbers, not money. Full-range int64 budget storage consumers are
not enabled; unsupported saved budget amounts or derived outputs fail with
422 `LEGACY_NUMERIC_RANGE`, before notification/digest writes.

SQL sums return text, then bigint subtraction preserves oversized intermediate
sums and cancellation. Actual activity deliberately preserves the old absolute
net policy: `abs(sum(debit)-sum(credit))`, including net credits. The threshold is
`round(periodAmount * integerPercent / 100)` using bigint and the existing positive
half-up/Math.round policy. Multiplication does not use Number. A positive budget
alerts when actual >= threshold; equality, zero percent and thresholds above 100
are supported. Nonpositive periods are counted/evaluated but do not alert. Every
output, even a disabled-by-amount evaluation or deduplicated alert, is preflighted.

## Selection, preflight and persistence

Only active, non-deleted budgets with non-null thresholds participate. Budget
and period Gregorian dates, currency, threshold and stored amounts are validated;
each budget supports the existing maximum 500 lines and 10000 periods. Explicit
periods may lie outside header dates, preserving the CRUD policy. Periods include
today in UTC with inclusive start/end. Only posted, non-deleted journal entries
from the budget organization and selected account/period contribute. Missing,
foreign or deleted account/fiscal references fail with scoped 404, without exposing
their names or amounts. Malformed request controls are REST 400 or SDK/schema tool
errors; permission failures remain 403 and invalid API keys 401.

The entire selected slice is validated and serialized before inserts. All in-app
rows commit in one transaction; a failure on any recipient rolls them all back.
No budget, GL, ledger balance or audit record is changed by checking alerts.
Scheduled/scoped callers share transaction advisory lock `(123,105)`. Reads use
READ COMMITTED after acquiring the lock, so a concurrent/repeated caller sees
committed alerts. The global lock intentionally serializes this bounded operation
across organizations; scale/performance qualification remains separate.

Deduplication uses organization + period + recipient + budget_exceeded + in_app,
including read/soft-deleted historical rows. Missing recipients (including a newly
added admin) can receive their alert. `alerted` counts newly committed recipient
rows, not exceeded periods or successful emails. The internal all-organization
selection fails the budget slice atomically on unsupported history; preceding
unrelated bookkeeping-maintenance steps are outside this task's transaction.

`sendNotification` retains its existing behavior for other callers. Its extracted
`deliverNotificationEmail` handles preferences and immediate/digest delivery after
budget notifications commit. Failed email/digest delivery cannot erase rows or
produce duplicate in-app alerts on replay. Delivery retries/outbox guarantees are
not introduced; a failed digest enqueue is best effort and may require operational
retry outside this slice.

## Verification and remaining qualification

Four pure groups and actual migrated disposable PostgreSQL REST/API-key/registered
MCP fixtures cover legacy/exact inputs, thresholds, currency bodies, safe-max
rounding, signed activity, text sums, exclusions, scoped reads, auth/role/tenant
rejection, invalid historical references/dates/currency/money, unchanged failed
snapshots, second-recipient rollback, digest failure and concurrent deduplication.
Existing budget CRUD and report suites are also rerun. Generic notification
creation and enabled digest queue behavior are asserted. No real provider/email
request occurs: synthetic users use example.test and RESEND_API_KEY is empty.

No schema change or migration, production IRR enablement, full build/dev server,
live Trigger run, real provider delivery, independent accounting review or
high-volume qualification is claimed. Historical monetary units, full-range
consumers and MON-105/MON-029 integration remain their separate gates.
