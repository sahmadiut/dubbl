import assert from "node:assert/strict";
import { test } from "node:test";
import { timesheetCreateSchema, timeEntryCreateSchema, shiftCreateSchema, scheduleCreateSchema, leavePolicyCreateSchema, leaveRequestCreateSchema, selfLeaveCreateSchema,
  timeQuantity, timeUnits, timeFromUnits, timeDto, orderedDates, leaveDates, timeQuery } from "../lib/api/payroll-time-wire";
import { WireCompatibilityError } from "../lib/money/wire";
const id = "11111111-1111-4111-8111-111111111111";

test("Physical hours and premium percentages retain units, exact binary32 values and strict types", () => {
  for (const value of [0, 0.25, 7.5, 25, 2 ** 52, 2 ** -149]) assert.equal(timeQuantity.parse(value), value);
  for (const value of [-0, -1, 0.1, 2.9, Number.MAX_SAFE_INTEGER, Infinity, NaN, "7.5", "750", 1n]) assert.equal(timeQuantity.safeParse(value).success, false);
  const shift = shiftCreateSchema.parse({ name: "Night", shiftType: "night", startTime: "22:00", endTime: "06:00", premiumPercent: 25 });
  assert.equal(shift.premiumPercent, 25);
  assert.equal(timeEntryCreateSchema.parse({ date: "2024-02-29", hours: 7.5 }).hours, 7.5);
  assert.equal(timeEntryCreateSchema.safeParse({ date: "2024-02-29", hoursMinor: "750" }).success, false);
  assert.equal(shiftCreateSchema.safeParse({ ...shift, premiumPercentMinor: "25" }).success, false);
});
test("Gregorian dates, wall clocks, weekdays and strict self-service inputs are validated", () => {
  const ts = { employeeId: id, periodStart: "2024-02-01", periodEnd: "2024-02-29" };
  assert.ok(timesheetCreateSchema.safeParse(ts).success);
  for (const value of ["0000-01-01", "2023-02-29", "2024-2-01", "2024-02-01T00:00:00Z", "۲۰۲۴-۰۲-۰۱"]) assert.equal(timesheetCreateSchema.safeParse({ ...ts, periodStart: value }).success, false);
  assert.throws(() => orderedDates("2024-02-29", "2024-02-01"));
  assert.throws(() => leaveDates("2024-12-31", "2025-01-01"));
  for (const value of ["24:00", "9:00", "09:60", "09:00Z"]) assert.equal(shiftCreateSchema.safeParse({ name: "Bad", shiftType: "regular", startTime: value, endTime: "17:00" }).success, false);
  assert.equal(scheduleCreateSchema.safeParse({ shiftId: id, dayOfWeek: 7, effectiveFrom: "2024-02-29" }).success, false);
  assert.equal(selfLeaveCreateSchema.safeParse({ employeeId: id, policyId: id, startDate: "2024-02-29", endDate: "2024-02-29", hours: 8 }).success, false);
  assert.equal(leavePolicyCreateSchema.safeParse({ name: "PTO", leaveType: "vacation", maxBalance: -1 }).success, false);
});
test("Hour totals and balance deductions reject storage rounding, including swallowed small operands", () => {
  assert.equal(timeFromUnits(timeUnits(7.5) + timeUnits(0.25)), 7.75);
  assert.equal(timeFromUnits(timeUnits(8) - timeUnits(7.5)), 0.5);
  assert.throws(() => timeFromUnits(timeUnits(2 ** 24) + timeUnits(0.25)), WireCompatibilityError);
  assert.throws(() => timeFromUnits(timeUnits(2 ** 52) + timeUnits(2 ** -149)), WireCompatibilityError);
  assert.throws(() => timeFromUnits(-1n), WireCompatibilityError);
});
test("Saved DTO guards reject malformed physical quantities, dates and unsafe nested values", () => {
  const leave = { employeeId: id, policyId: id, startDate: "2024-02-29", endDate: "2024-02-29", hours: 7.5, reason: null };
  assert.deepEqual(timeDto(leave, leaveRequestCreateSchema), leave);
  for (const patch of [{ hours: -1 }, { hours: 0.1 }, { startDate: "invalid" }, { nested: { salary: 9007199254740992 } }])
    assert.throws(() => timeDto({ ...leave, ...patch }, leaveRequestCreateSchema), WireCompatibilityError);
});
test("Pagination and status filters reject partial/unsafe coercion while preserving defaults", () => {
  assert.deepEqual(timeQuery(new URL("http://test")), { page: 1, limit: 50, status: undefined });
  assert.deepEqual(timeQuery(new URL("http://test?page=2&limit=25&status=pending"), true), { page: 2, limit: 25, status: "pending" });
  for (const query of ["page=1x", "limit=101", "page=0", "limit=1e2", "status=bogus", "page=1000001"])
    assert.throws(() => timeQuery(new URL("http://test?" + query)));
});
