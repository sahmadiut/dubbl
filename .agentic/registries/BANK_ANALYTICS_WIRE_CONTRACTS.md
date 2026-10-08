# MON-117 bank analytics contracts

Both operations require `view:data`, authenticated organization scope and shared
repeatable-read, read-only direct-DB services. API keys retain their owning org,
even with another `x-organization-id` header. No money inputs or financial writes.

| REST GET | MCP | Inputs | Outputs and units |
|---|---|---|---|
| `/api/v1/reports/bank-cash-flow` | `bank_cash_flow` | Optional inclusive Gregorian `startDate`/`endDate` (UTC year-start/today); `groupBy` day/week/month (month default); optional live owned `bankAccountId` including inactive history; optional supported uppercase `currencyCode` | Existing `periods` and `totals`, plus `currencyCode`. Numeric integer currency minor units: `inflows`, negative `outflows`, signed `net`, period `balance`, with matching `inflowsMinor`, `outflowsMinor`, `netMinor`, `balanceMinor` strings. |
| `/api/v1/reports/bank-reconciliation-status` | `bank_reconciliation_status` | Optional active live owned `bankAccountId`; empty input returns all active live accounts | Existing `accounts`, each with `currencyCode`. Numeric `balance`, `balanceDiscrepancy`, unreconciled `total` and every aging `total`, with matching Minor strings. Counts are integers; import dates are ISO UTC instants; reconciliation/gap dates are Gregorian. |

Money aliases agree without rescaling: USD 1250 is 1250 cents, IRR/JPY/KWD 1250
retain 1250 stored currency minor units. Every numeric output is within
+/-9007199254740991. SQL numeric/text aggregates and bigint intermediates guard
final totals/subtraction/running sums. Unsafe outputs reject with
`LEGACY_NUMERIC_RANGE` (REST 422/MCP classified error). Exact clients receive
additive canonical strings within the same public range; no full-int64 mode.
Saved status balance is projected as text and checked. Signed movement sums can
cancel saved int64 inputs exactly; unreconciled gross totals and cash-flow
positive/negative totals must independently fit numeric aliases.

Strict schemas reject malformed/nonexistent dates, reversed ranges, unsupported
groups/currencies, malformed UUIDs, unknown/duplicate REST queries (400).
Foreign/deleted/missing accounts return the same 404; inactive accounts also
return 404 for status. Authentication/permissions yield 401/403. Child queries
use verified bank IDs; import metadata independently requires matching org and
bank IDs. Cash-flow rejects mixed selected bank currencies without bank ID or
currency filter, even when a selected account has no movements. ID and currency
must agree. Non-null currency on an included transaction must match its bank;
null inherits bank currency. No implicit FX conversion.

Cash-flow excludes excluded lines, includes reconciled/unreconciled lines and
uses inclusive dates. Weeks begin Monday; labels and month ends use UTC. Calendar
bounds can extend outside requested dates; only populated periods return.
`balance` starts at zero and means cumulative net change within the range, not
opening/closing statement or GL balance. Empty results retain zero aliases and
selected currency, falling back to org currency when no accounts exist.

Status ages use UTC today: 0-7, 8-30, 31-60 days, and older for all other values
(including future lines, retained behavior). ABS casts to numeric before SUM,
avoiding int64-minimum overflow. Discrepancy retains saved balance minus all
non-excluded movement without inventing opening GL history. Gap latest dates now
exclude excluded lines. Import/reconciliation ties use deterministic IDs. Gaps
require more than one calendar day; latest scoped import/reconciliation retain
existing metadata/status meanings regardless of success/completion status.

Pages show errors and format currency amounts exactly. Cash-flow CSV retains
integer minor-unit columns and adds currencyCode. Status CSV retains decimal
major-unit columns as exact currency-scaled text and adds currencyCode. Status
display totals sum bigint separately per currency; display-only decimal formatting
supports sums beyond a single stored int64 value. Existing client CSV export stays.

Verification: wire unit tests and migrated PostgreSQL/API-key/MCP SDK fixtures in
`tests/integration/bank-analytics*.ts`. They exercise legacy/exact bank writers,
tenant/permission isolation, scoped import metadata, currencies/calendar/defaults,
signed/range/storage/derived limits, int64 cancellation and unchanged financial
snapshots. No schema/migration/history/IRR flag change. Combined MON-104/MON-029,
independent accounting, full-range, performance and production qualification stay
separate. No browser/dev/build/provider call was required or performed.
