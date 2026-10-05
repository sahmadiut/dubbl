import { z } from "zod";
import { payrollDate } from "./payroll-master-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const timeId = z.string().uuid().describe("Organization-owned record UUID");
const text = z.string().max(10000);
// The persisted quantities are PostgreSQL real, not money. Accept only lossless writes.
export const timeQuantity = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER)
  .refine(v => !Object.is(v, -0) && Math.fround(v) === v, "Use a nonnegative quantity exactly representable in binary32");
const hours = timeQuantity.describe("Physical hours, nonnegative binary32 value <= 9007199254740991; e.g. 7.5; never cents or minutes");
const shiftType = z.enum(["regular", "overtime", "night", "weekend", "holiday"]).describe("Shift category");
const date = payrollDate.refine(v => v.slice(0, 4) !== "0000", "Gregorian year must be 1..9999").describe("Valid Gregorian YYYY-MM-DD date, year 1..9999");
const name = text.min(1).describe("Display name");
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).describe("Local wall-clock HH:mm, 00:00..23:59; no timezone conversion");
export const timesheetCreateSchema = z.object({ employeeId: timeId.describe("Live owned employee UUID"), periodStart: date, periodEnd: date }).strict();
export const selfTimesheetCreateSchema = timesheetCreateSchema.omit({ employeeId: true });
export const timesheetUpdateSchema = selfTimesheetCreateSchema.partial();
export const timeEntryCreateSchema = z.object({ date, hours,
  shiftType: shiftType.optional().describe("Shift category; defaults regular"),
  description: text.nullable().optional().describe("Entry description; null clears"),
  projectId: timeId.nullable().optional().describe("Live owned project UUID; null means unassigned"),
}).strict();
export const shiftCreateSchema = z.object({ name, shiftType, startTime: clock, endTime: clock,
  premiumPercent: timeQuantity.nullable().optional().describe("Extra decimal percent on base pay, binary32 exact; 25 = 25%, not basis points or cents; null clears"),
}).strict();
export const shiftUpdateSchema = shiftCreateSchema.partial().extend({ isActive: z.boolean().optional().describe("Active flag") });
export const scheduleCreateSchema = z.object({ shiftId: timeId.describe("Live active owned shift UUID"),
  dayOfWeek: z.number().int().min(0).max(6).describe("Weekday 0=Sunday..6=Saturday; not a date or money"),
  effectiveFrom: date, effectiveTo: date.nullable().optional().describe("Valid Gregorian end date at/after effectiveFrom; null means open ended"),
}).strict();
export const leavePolicyCreateSchema = z.object({ name,
  leaveType: z.enum(["vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other"]).describe("Leave category"),
  accrualMethod: z.enum(["per_pay_period", "monthly", "annually", "front_loaded"]).optional().describe("Accrual frequency; defaults per_pay_period"),
  accrualRate: hours.optional().describe("Hours accrued per selected period, binary32 exact; defaults 0"),
  maxBalance: hours.nullable().optional().describe("Maximum banked hours; null means no cap"),
  carryOverMax: hours.nullable().optional().describe("Maximum carried hours; null means no cap"),
}).strict();
export const leavePolicyUpdateSchema = leavePolicyCreateSchema.omit({ leaveType: true }).partial().extend({ isActive: z.boolean().optional().describe("Active flag") });
export const leaveRequestCreateSchema = z.object({ employeeId: timeId.describe("Live owned employee UUID"), policyId: timeId.describe("Live active owned leave policy UUID"),
  startDate: date, endDate: date, hours, reason: text.nullable().optional().describe("Request reason; null clears"),
}).strict();
export const selfLeaveCreateSchema = leaveRequestCreateSchema.omit({ employeeId: true });
export const leaveRequestUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional().describe("Only pending retention or pending-to-cancelled is supported here; use approval/rejection tools for those transitions"),
  reason: text.nullable().optional().describe("Reason; only pending requests can be edited"),
}).strict();
export const timeRejectSchema = z.object({ reason: text.nullable().optional().describe("Optional rejection reason; null clears") }).strict();
const paging = { page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, max 100") };
export const timesheetListSchema = z.object({ ...paging, status: z.enum(["draft", "submitted", "approved", "rejected"]).optional().describe("Optional timesheet status filter") }).strict();
export const leaveListSchema = z.object({ ...paging, status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional().describe("Optional leave status filter") }).strict();
export const leaveBalanceSchema = z.object({ employeeId: timeId, policyId: timeId, balance: hours, usedHours: hours,
  year: z.number().int().min(1).max(9999).describe("Gregorian balance year 1..9999") }).strict();

export function orderedDates(start: string, end: string | null | undefined) {
  if (end && end < start) throw new z.ZodError([{ code: "custom", path: [], message: "End date cannot precede start date" }]);
}
export function leaveDates(start: string, end: string) {
  orderedDates(start, end);
  if (start.slice(0, 4) !== end.slice(0, 4)) throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "Split leave requests by Gregorian year" }]);
}
/** Integer multiples of binary32's smallest subnormal: exact addition/subtraction. */
export function timeUnits(value: number): bigint { timeQuantity.parse(value); return BigInt(value * 2 ** 149); }
export function timeFromUnits(units: bigint): number {
  const value = Number(units) / 2 ** 149;
  if (!timeQuantity.safeParse(value).success || timeUnits(value) !== units)
    throw new WireCompatibilityError("Physical hour result cannot be represented exactly in PostgreSQL real");
  return value;
}
export function timeDto<T extends object>(row: T, schema: z.ZodObject, validate?: () => void): T {
  try {
    const saved = row as Record<string, unknown>;
    schema.parse(Object.fromEntries(Object.keys(schema.shape).filter(k => k in saved).map(k => [k, saved[k]])));
    validate?.(); stringifyWire(row); return row;
  } catch { throw new WireCompatibilityError("Unsupported saved payroll time, hours, premium or dates"); }
}
export function timeQuery(url: URL, leave = false) {
  const number = (key: string) => {
    const value = url.searchParams.get(key); if (value === null) return undefined;
    if (!/^[1-9]\d{0,6}$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Use a positive integer" }]);
    return Number(value);
  };
  return (leave ? leaveListSchema : timesheetListSchema).parse({ page: number("page"), limit: number("limit"), status: url.searchParams.get("status") ?? undefined });
}
/** Existing bodyless transitions accept no body or {}, but never discard fields. */
export async function emptyTimeBody(request: Request) {
  const body = await request.text();
  if (body.length === 0) return;
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON payroll body" }]); }
  z.object({}).strict().parse(value);
}
