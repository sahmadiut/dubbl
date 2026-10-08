import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateNextReportRun, createReportScheduleSchema, updateReportScheduleSchema } from "../lib/reports/schedule-wire";

test("Schedule inputs reject malformed controls and PATCH preserves omitted fields", () => {
  const valid = { savedReportId: "00000000-0000-4000-8000-000000000001", frequency: "daily", recipients: ["fixture@example.test"] };
  assert.equal(createReportScheduleSchema.parse(valid).format, "pdf");
  assert.deepEqual(updateReportScheduleSchema.parse({ isActive: false }), { isActive: false });
  assert.deepEqual(updateReportScheduleSchema.parse({ dayOfWeek: 0, dayOfMonth: null }), { dayOfWeek: 0, dayOfMonth: null });
  for (const patch of [{ recipients: [] }, { recipients: ["bad"] }, { timeOfDay: "24:00" }, { timeOfDay: "8:00" }, { timezone: "Invalid/Zone" }, { timezone: "+03:30" }, { dayOfWeek: 7 }, { dayOfMonth: 29 }, { amountMinor: "1" }]) {
    assert.equal(createReportScheduleSchema.safeParse({ ...valid, ...patch }).success, false);
    assert.equal(updateReportScheduleSchema.safeParse(patch).success, false);
  }
  assert.equal(updateReportScheduleSchema.safeParse({}).success, false);
});

test("Schedule occurrences respect local day/time, quarter boundaries and DST", () => {
  const base = { frequency: "daily" as const, timeOfDay: "08:00", timezone: "UTC", dayOfWeek: null, dayOfMonth: null };
  const next = (patch: Partial<typeof base> & { frequency?: "daily" | "weekly" | "monthly" | "quarterly" }, from: string) =>
    calculateNextReportRun({ ...base, ...patch }, new Date(from)).toISOString();
  assert.equal(next({}, "2026-10-08T07:00:00Z"), "2026-10-08T08:00:00.000Z");
  assert.equal(next({}, "2026-10-08T08:00:00Z"), "2026-10-09T08:00:00.000Z");
  assert.equal(next({ timezone: "Asia/Tehran" }, "2026-10-08T04:00:00Z"), "2026-10-08T04:30:00.000Z");
  assert.equal(calculateNextReportRun({ ...base, frequency: "weekly", dayOfWeek: 0 }, new Date("2026-10-08T09:00Z")).toISOString(), "2026-10-11T08:00:00.000Z");
  assert.equal(calculateNextReportRun({ ...base, frequency: "monthly", dayOfMonth: 28 }, new Date("2024-02-28T08:00Z")).toISOString(), "2024-03-28T08:00:00.000Z");
  assert.equal(calculateNextReportRun({ ...base, frequency: "quarterly", dayOfMonth: 1 }, new Date("2026-10-01T08:00Z")).toISOString(), "2027-01-01T08:00:00.000Z");
  assert.equal(next({ timeOfDay: "02:30", timezone: "America/New_York" }, "2024-03-10T05:00Z"), "2024-03-11T06:30:00.000Z");
  assert.equal(next({ timeOfDay: "01:30", timezone: "America/New_York" }, "2024-11-03T04:00Z"), "2024-11-03T05:30:00.000Z");
  assert.equal(next({ timeOfDay: "01:30", timezone: "America/New_York" }, "2024-11-03T05:30Z"), "2024-11-04T06:30:00.000Z");
});
