# Payroll time, leave and shift wire contracts (MON-081)

2026-10-05, Asia/Tehran. Shared services: lib/api/payroll-time.ts. Strict described
schemas and physical-unit guards: payroll-time-wire.ts. 32 actual REST/MCP
operation pairs, tested against migrated disposable PostgreSQL and the SDK.
No schema change, rescaling, posting or production payroll/IRR qualification.

## Complete operation inventory

All paths are under `/api/v1/payroll`. For employee paths, MCP uses employeeId
where REST uses id. Entry DELETE uses the entryId query UUID, scoped to path id.

| REST operation | MCP tool | Success envelope | Permission |
|---|---|---|---|
| GET `timesheets` | `list_payroll_timesheets` | data + pagination | manage:timesheets |
| POST `timesheets` | `create_payroll_timesheet` | timesheet | manage:timesheets |
| GET `timesheets/[id]` | `get_payroll_timesheet` | timesheet | manage:timesheets |
| PATCH `timesheets/[id]` | `update_payroll_timesheet` | timesheet | manage:timesheets |
| GET `timesheets/[id]/entries` | `list_payroll_timesheet_entries` | data | manage:timesheets |
| POST `timesheets/[id]/entries` | `create_payroll_timesheet_entry` | entry | manage:timesheets |
| DELETE `timesheets/[id]/entries` | `delete_payroll_timesheet_entry` | success | manage:timesheets |
| POST `timesheets/[id]/submit` | `submit_payroll_timesheet` | timesheet | manage:timesheets |
| POST `timesheets/[id]/approve` | `approve_payroll_timesheet` | timesheet | approve:payroll |
| POST `timesheets/[id]/reject` | `reject_payroll_timesheet` | timesheet | approve:payroll |
| GET `shifts` | `list_payroll_shifts` | data | manage:shifts |
| POST `shifts` | `create_payroll_shift` | shift | manage:shifts |
| GET `shifts/[id]` | `get_payroll_shift` | shift | manage:shifts |
| PATCH `shifts/[id]` | `update_payroll_shift` | shift | manage:shifts |
| GET `leave/policies` | `list_payroll_leave_policies` | data | manage:leave |
| POST `leave/policies` | `create_payroll_leave_policy` | policy | manage:leave |
| GET `leave/policies/[id]` | `get_payroll_leave_policy` | policy | manage:leave |
| PATCH `leave/policies/[id]` | `update_payroll_leave_policy` | policy | manage:leave |
| DELETE `shifts/[id]` | `delete_payroll_shift` | success | manage:shifts |
| GET `employees/[id]/schedule` | `list_payroll_employee_schedules` | data | manage:payroll |
| POST `employees/[id]/schedule` | `create_payroll_employee_schedule` | schedule | manage:payroll |
| GET `leave/requests` | `list_payroll_leave_requests` | data + pagination | manage:leave |
| POST `leave/requests` | `create_payroll_leave_request` | request | manage:leave |
| GET `leave/requests/[id]` | `get_payroll_leave_request` | request | manage:leave |
| PATCH `leave/requests/[id]` | `update_payroll_leave_request` | request | manage:leave |
| POST `leave/requests/[id]/approve` | `approve_payroll_leave_request` | request | approve:payroll |
| POST `leave/requests/[id]/reject` | `reject_payroll_leave_request` | request | approve:payroll |
| GET `employees/[id]/leave-balances` | `get_employee_leave_balances` | REST data; MCP balances (legacy projection) | manage:leave |
| GET `self-service/timesheets` | `list_self_payroll_timesheets` | data | self-service:payroll |
| POST `self-service/timesheets` | `create_self_payroll_timesheet` | timesheet | self-service:payroll |
| POST `self-service/leave-requests` | `create_self_payroll_leave_request` | request | self-service:payroll |
| GET `self-service/leave-balance` | `get_self_payroll_leave_balances` | data | self-service:payroll |

Creation POSTs return 201; all other successes are 200. MCP has the named JSON
envelope without HTTP status. list_payroll_timesheets and list_payroll_leave_requests
return data and pagination {page,limit,total,totalPages}. Other lists are data
arrays. Existing get_employee_leave_balances preserves balances with
{id,policyId,policyName,leaveType,year,balance,usedHours}; REST returns complete
balance rows with owned policy. Self-service balance retains complete policy rows.
No leave policy deletion or schedule deletion is invented.

## Units, ranges and exact aliases

This slice has **no root monetary amounts or FX rates**. Hours and premiumPercent
are physical hours and decimal percent, never cents/minutes/basis points. They
remain JSON numbers. There is no hoursMinor, balanceMinor, premiumPercentMinor or
representation header. Unknown body/MCP fields reject; an exact client uses the
same numeric physical-unit contract. Existing real storage accepts only finite,
nonnegative values that already equal Math.fround(value), at most
9007199254740991 (the largest binary32 value below that bound is 9007198717870080).
Negative zero rejects on MCP/pure input; JSON encoding may canonicalize it to 0.
7.5, 0.25 and 25 work unchanged; literal 0.1 or 2.9 rejects rather than silently
rounding to a different saved value. The smallest binary32 subnormal 2^-149 works.
Null is accepted only by explicitly nullable fields below; omitted updates retain.

Totals and balance arithmetic operate on exact bigint multiples of 2^-149, then
verify the whole result fits unchanged binary32 and the safe serializer range.
No money parsing, fround rounding, float accumulation or max(negativeBalance,0).
Even 2^52 plus 2^-149 rejects instead of swallowing the smaller operand.
Legacy malformed, nonfinite, negative, unsafe, duplicate-balance or inconsistent
entry-total history returns a classified 422 LEGACY_NUMERIC_RANGE without editing
or repairing historical records. Historical remediation remains separate.

Nested managerial employee data retains payroll master safe nonnegative integer
**cents**, with salaryMinor (annual) and nullable hourlyRateMinor (per hour)
canonical string aliases. Nested project data in entry reads retains original
integer cents budget/hourlyRate/fixedPrice/totalBilled and adds corresponding
Minor strings, 0..9007199254740991. Nested project totalHours and estimatedHours
remain integer **minutes**, unlike timesheet hours. Project currency must be
canonical supported ISO, and payroll master's currency may retain historical null.
No coercion, full-int64 business support or currency rescaling is claimed.
Self-service timesheets return entry rows with projectId, never project financial
objects or other employees' records. Nested employee objects have no joined user
credentials. Ownership is checked before nested DTOs are returned.

## Complete writable fields and output metadata

All UUIDs must be valid; employee/shift/policy/project references must be owned.
Strings are unchanged, max 10000 code units; required names/reasons as noted below
are nonempty. Boolean fields accept booleans only. Enums accept actual schema
members only (listed in payroll-time-wire.ts). Dates are real Gregorian YYYY-MM-DD,
year 1..9999; timestamps are serialized UTC instants. No locale/calendar inference.

| Entity/operation | Writable fields and units/defaults |
|---|---|
| Timesheet create | employeeId required, periodStart/periodEnd required ordered Gregorian dates; self create omits employeeId entirely |
| Timesheet PATCH | Optional periodStart/periodEnd; merged ordered period must contain every existing entry date |
| Timesheet entry create | date required inside period; hours required physical binary32 hours including zero; shiftType optional regular/overtime/night/weekend/holiday, defaults regular; description nullable optional text; projectId nullable optional owned live project |
| Timesheet reject | Optional nullable text reason; defaults null |
| Shift create | name, shiftType, startTime, endTime required; wall clocks exactly HH:mm 00:00..23:59; overnight/end-before-start allowed as metadata; premiumPercent optional nullable binary32 extra percent, default 0 (25 = +25%, not 2500 bp) |
| Shift PATCH | All create fields optional, plus optional boolean isActive; premiumPercent null clears |
| Schedule create | shiftId required live active owned shift; dayOfWeek integer 0 Sunday..6 Saturday; effectiveFrom required; effectiveTo optional nullable date at/after start (null open ended) |
| Leave policy create | name and leaveType required; accrualMethod optional per_pay_period/monthly/annually/front_loaded default per_pay_period; accrualRate optional hours per selected period default 0; maxBalance/carryOverMax optional nullable nonnegative binary32 hours (null uncapped) |
| Leave policy PATCH | name/accrualMethod/accrualRate/maxBalance/carryOverMax optional; isActive optional boolean; leaveType immutable; null clears nullable caps |
| Leave request create | employeeId and policyId required; startDate/endDate required ordered dates in one Gregorian year; hours required nonnegative binary32 hours; reason optional nullable text; self create forbids employeeId |
| Leave request PATCH | reason optional nullable text; status optional actual enum, but only pending retention or pending-to-cancelled supported; approved/rejected must use dedicated operations |
| Leave reject | Optional nullable text reason; defaults null |
| Lists with pagination | Optional page integer 1..1000000 default 1, limit integer 1..100 default 50; status optional draft/submitted/approved/rejected for timesheets or pending/approved/rejected/cancelled for leave; no partial/exponent/whitespace query coercion |

Bodyless submit/approve and DELETE operations accept absent body or strict {}; a
malformed body or discarded field rejects. Other writes require valid JSON,
including reject (use {} for no reason). Unrelated query names are ignored; body
and MCP schemas are strict. MCP inputs carry described path fields alongside the
body. No coercion of numeric strings, localized digits or major-unit money.

All results retain their saved id UUID and relationships, organizationId where
stored, and original metadata: timesheets include status,totalHours,submittedAt,
approvedBy,approvedAt,rejectionReason,createdAt,updatedAt,deletedAt; entry rows
include timesheetId; shifts/policies include isActive,createdAt,deletedAt;
schedules include employeeId; leave requests include status,approvedBy,
approvedAt,rejectionReason,createdAt; balance rows include year (integer 1..9999),
balance available hours,usedHours taken hours,updatedAt. Server-owned lifecycle,
actor, total, year and audit fields cannot be written through these inputs.
Existing counts are guarded safe integers; date-only values never become instants.

## Lifecycle, authorization, atomicity and retries

- Every operation uses AuthContext org scope and its permission above. REST API
  key org cannot be overridden by x-organization-id. Self-service resolves exactly
  one live employee using owned membership; no employee override, and zero/duplicate
  matches return 404/409. Employee links must be owned/live, including saved roots.
- Draft is the only editable/submittable timesheet status. Submitted can approve
  or reject; approved/rejected cannot edit, delete entries, resubmit or decide
  again. Period changes cannot exclude saved entries. The saved entry sum must
  equal totalHours exactly before any mutation; no implicit repair.
- Entry deletion requires both the correct live timesheet path and entryId and
  draft state. All additions/deletions update total and audit in one transaction.
- Leave creation needs live active owned policy. Pending requests can edit reasons
  or cancel. Dedicated approvals require owned approving member, active live policy,
  one balance for request's Gregorian start year, and sufficient available hours.
  Cross-year requests must be split explicitly; hours are never guessed/split.
  Approval atomically subtracts balance, adds usedHours, writes actor/status/audit.
  Missing/duplicate/insufficient balances reject 409. Approvals cannot overdraw or
  repeat. Rejection/cancellation leaves balances unchanged. Approved requests
  cannot be silently cancelled/restored or changed via generic PATCH.
- Writes acquire owned organization lock then employee/row locks as applicable;
  DTO and audit checks run before commit. Audit or output failure rolls everything
  back. Adopted time/config writers share org locking; masters share employee locks.
  MON-082/parent MON-025 retain coordination with unadopted run/accrual writers.
- Shift deletion is soft, repeats return 404, PATCH cannot resurrect. Policy edits
  exclude soft-deleted rows. Saved owned deleted shift/policy/project references
  remain readable for historical schedules/balances/entries, with ownership/DTO
  guards; new schedules/project assignments require live references.
- Create/add operations are separate events, not idempotent keyed upserts. Schedule
  duplicates and overlapping timesheets/requests are not silently merged. Inspect
  existing state before uncertain retries. Terminal transitions/deletions reject
  repeats (409/404), so concurrent approvals/deletes have one winner. Pending
  metadata PATCH may repeat and audits each successful operation.

404 covers absent/foreign/deleted roots, invalid historical foreign references,
and missing member/profile. 403 permissions; 401 REST expired/invalid credentials;
400 malformed JSON/schema/dates/controls; 409 lifecycle/active/balance conflicts;
422 unsupported storage precision or history; 500 internal faults (MCP returns
isError and Internal error without a status on generic faults). Invalid MCP schema
is an SDK validation error, not guaranteed an HTTP-equivalent status.

## Qualification boundary

No journal/GL, accounting-period alteration, statutory rule, money accrual,
physical-unit storage migration, browser/OAuth/session, production deployment or
IRR rollout. Time/leave/schedule metadata does not post a financial period, so
financial period-lock posting checks remain in pay-run lifecycle MON-082. Existing
leave accrual calculations and cross-writer integration belong to MON-082/parent
MON-025; payroll calculations/FX, compensation and financial outputs remain
MON-082..085. No independent accounting/security qualification is inferred.
