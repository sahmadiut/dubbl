import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payrollEmployee, member, timesheet, timesheetEntry, shiftDefinition, employeeSchedule, leavePolicy, leaveRequest, employeeLeaveBalance, project } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { payrollMasterDto } from "./payroll-master-wire";
import { legacyMinor, legacyMinorSchema, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { paginatedResponse } from "./pagination";
import { timeId, timeDto, orderedDates, leaveDates, timeUnits, timeFromUnits, timesheetCreateSchema, selfTimesheetCreateSchema, timesheetUpdateSchema, timeEntryCreateSchema,
  shiftCreateSchema, shiftUpdateSchema, scheduleCreateSchema, leavePolicyCreateSchema, leavePolicyUpdateSchema, leaveRequestCreateSchema, selfLeaveCreateSchema,
  leaveRequestUpdateSchema, timeRejectSchema, timesheetListSchema, leaveListSchema, leaveBalanceSchema } from "./payroll-time-wire";

const tsScope = (ctx: AuthContext, id?: string) => and(eq(timesheet.organizationId, ctx.organizationId), isNull(timesheet.deletedAt), id ? eq(timesheet.id, id) : undefined);
const shiftScope = (ctx: AuthContext, id?: string) => and(eq(shiftDefinition.organizationId, ctx.organizationId), isNull(shiftDefinition.deletedAt), id ? eq(shiftDefinition.id, id) : undefined);
const policyScope = (ctx: AuthContext, id?: string) => and(eq(leavePolicy.organizationId, ctx.organizationId), isNull(leavePolicy.deletedAt), id ? eq(leavePolicy.id, id) : undefined);
const leaveScope = (ctx: AuthContext, id?: string) => and(eq(leaveRequest.organizationId, ctx.organizationId), id ? eq(leaveRequest.id, id) : undefined);
const tsDto = (r: typeof timesheet.$inferSelect) => timeDto(r, timesheetCreateSchema.extend({ totalHours: timeEntryCreateSchema.shape.hours, status: timesheetListSchema.shape.status.unwrap() }), () => orderedDates(r.periodStart, r.periodEnd));
const entryDto = (r: typeof timesheetEntry.$inferSelect) => timeDto(r, timeEntryCreateSchema);
const shiftDto = (r: typeof shiftDefinition.$inferSelect) => timeDto(r, shiftCreateSchema.extend({ isActive: shiftUpdateSchema.shape.isActive }));
const policyDto = (r: typeof leavePolicy.$inferSelect) => timeDto(r, leavePolicyCreateSchema.extend({ isActive: leavePolicyUpdateSchema.shape.isActive }));
const leaveDto = (r: typeof leaveRequest.$inferSelect) => timeDto(r, leaveRequestCreateSchema.extend({ status: leaveListSchema.shape.status.unwrap() }), () => leaveDates(r.startDate, r.endDate));
const balanceDto = (r: typeof employeeLeaveBalance.$inferSelect) => timeDto(r, leaveBalanceSchema);
const scheduleDto = (r: typeof employeeSchedule.$inferSelect) => timeDto(r, scheduleCreateSchema, () => orderedDates(r.effectiveFrom, r.effectiveTo));
async function transaction<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function employee(tx: TaxTx, ctx: AuthContext, id: string) {
  timeId.parse(id);
  const [row] = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.id, id), eq(payrollEmployee.organizationId, ctx.organizationId), isNull(payrollEmployee.deletedAt))).for("update");
  if (!row) throw new AuthError("Employee not found", 404);
  return payrollMasterDto(row);
}
async function ownMember(tx: TaxTx, ctx: AuthContext) {
  const [row] = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId))).for("share");
  if (!row) throw new AuthError("Member not found", 404); return row.id;
}
async function selfEmployee(tx: TaxTx, ctx: AuthContext) {
  const memberId = await ownMember(tx, ctx);
  const rows = await tx.select({ id: payrollEmployee.id }).from(payrollEmployee).where(and(eq(payrollEmployee.organizationId, ctx.organizationId), eq(payrollEmployee.memberId, memberId), isNull(payrollEmployee.deletedAt)));
  if (rows.length === 0) throw new AuthError("Employee profile not found", 404);
  if (rows.length !== 1) throw new AuthError("Ambiguous employee profile", 409);
  return employee(tx, ctx, rows[0].id);
}
async function ownedShift(tx: TaxTx, ctx: AuthContext, id: string, live = false) {
  const [row] = await tx.select().from(shiftDefinition).where(and(eq(shiftDefinition.id, id), eq(shiftDefinition.organizationId, ctx.organizationId), live ? isNull(shiftDefinition.deletedAt) : undefined));
  if (!row) throw new AuthError("Shift not found", 404); const result = shiftDto(row);
  if (live && !row.isActive) throw new AuthError("Active shift required", 409); return result;
}
async function ownedPolicy(tx: TaxTx, ctx: AuthContext, id: string, live = false) {
  const [row] = await tx.select().from(leavePolicy).where(and(eq(leavePolicy.id, id), eq(leavePolicy.organizationId, ctx.organizationId), live ? isNull(leavePolicy.deletedAt) : undefined));
  if (!row) throw new AuthError("Leave policy not found", 404); const result = policyDto(row);
  if (live && !row.isActive) throw new AuthError("Active policy required", 409); return result;
}
async function ownedProject(tx: TaxTx, ctx: AuthContext, id: string, live = false) {
  const [row] = await tx.select().from(project).where(and(eq(project.id, id), eq(project.organizationId, ctx.organizationId), live ? isNull(project.deletedAt) : undefined)).for("share");
  if (!row) throw new AuthError("Project not found", 404);
  try {
    const aliases = Object.fromEntries(["budget", "hourlyRate", "fixedPrice", "totalBilled"].map(k => {
      const value = row[k as "budget"]; legacyMinorSchema.min(0).parse(value); return [k + "Minor", String(value)];
    }));
    if (currencyCodeSchema.parse(row.currency) !== row.currency) throw new Error("Currency");
    const result = { ...row, ...aliases }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Unsupported saved project money or currency"); }
}
async function entries(tx: TaxTx, ctx: AuthContext, ts: typeof timesheet.$inferSelect) {
  const rows = await tx.select().from(timesheetEntry).where(eq(timesheetEntry.timesheetId, ts.id)).orderBy(asc(timesheetEntry.date), asc(timesheetEntry.id));
  return Promise.all(rows.map(async row => {
    entryDto(row);
    if (row.date < ts.periodStart || row.date > ts.periodEnd) throw new WireCompatibilityError("Saved entry is outside the timesheet period");
    return { ...row, project: row.projectId ? await ownedProject(tx, ctx, row.projectId) : null };
  }));
}
async function ownedTimesheet(tx: TaxTx, ctx: AuthContext, id: string) {
  timeId.parse(id); const [row] = await tx.select().from(timesheet).where(tsScope(ctx, id)).for("update");
  if (!row) throw new AuthError("Timesheet not found", 404); tsDto(row);
  const emp = await employee(tx, ctx, row.employeeId), es = await entries(tx, ctx, row);
  if (timeUnits(row.totalHours) !== es.reduce((sum, e) => sum + timeUnits(e.hours), 0n)) throw new WireCompatibilityError("Saved totalHours disagrees with timesheet entries");
  return { row, employee: emp, entries: es };
}
function draft(ts: typeof timesheet.$inferSelect) { if (ts.status !== "draft") throw new AuthError("Only draft timesheets can be edited or submitted", 409); }
export async function listPayrollTimesheets(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:timesheets"); const p = timesheetListSchema.parse(input);
  return transaction(ctx, async tx => {
    const scope = and(tsScope(ctx), p.status ? eq(timesheet.status, p.status) : undefined);
    const rows = await tx.select().from(timesheet).where(scope).orderBy(desc(timesheet.createdAt), asc(timesheet.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(timesheet).where(scope);
    const data = await Promise.all(rows.map(async r => { const saved = await ownedTimesheet(tx, ctx, r.id); return { ...tsDto(saved.row), employee: saved.employee }; }));
    return paginatedResponse(data, legacyMinor(BigInt(count.count)), p.page, p.limit);
  });
}
export async function getPayrollTimesheet(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:timesheets"); return transaction(ctx, async tx => {
    const saved = await ownedTimesheet(tx, ctx, id); return { ...tsDto(saved.row), employee: saved.employee, entries: saved.entries };
  });
}
export async function createPayrollTimesheet(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:timesheets"); const values = timesheetCreateSchema.parse(input); orderedDates(values.periodStart, values.periodEnd);
  return transaction(ctx, async tx => { await employee(tx, ctx, values.employeeId); return insertTimesheet(tx, ctx, values, request); });
}
async function insertTimesheet(tx: TaxTx, ctx: AuthContext, values: { employeeId: string; periodStart: string; periodEnd: string }, request?: Request) {
  const [row] = await tx.insert(timesheet).values({ organizationId: ctx.organizationId, ...values }).returning(); const result = tsDto(row);
  await auditTax(tx, ctx.organizationId, "timesheet", row.id, "create", result, ctx, request); return result;
}
export async function updatePayrollTimesheet(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:timesheets"); const values = timesheetUpdateSchema.parse(input);
  return transaction(ctx, async tx => {
    const saved = await ownedTimesheet(tx, ctx, id); draft(saved.row); const merged = { ...saved.row, ...values }; orderedDates(merged.periodStart, merged.periodEnd);
    if (saved.entries.some(e => e.date < merged.periodStart || e.date > merged.periodEnd)) throw new AuthError("Period must contain every entry date", 400);
    const [row] = await tx.update(timesheet).set({ ...values, updatedAt: new Date() }).where(tsScope(ctx, id)).returning(); const result = tsDto(row);
    await auditTax(tx, ctx.organizationId, "timesheet", id, "update", result, ctx, request); return result;
  });
}
export async function listPayrollTimesheetEntries(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:timesheets"); return transaction(ctx, async tx => (await ownedTimesheet(tx, ctx, id)).entries);
}
export async function createPayrollTimesheetEntry(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:timesheets"); const values = timeEntryCreateSchema.parse(input);
  return transaction(ctx, async tx => {
    const saved = await ownedTimesheet(tx, ctx, id); draft(saved.row);
    if (values.date < saved.row.periodStart || values.date > saved.row.periodEnd) throw new AuthError("Entry date must be within the timesheet period", 400);
    if (values.projectId) await ownedProject(tx, ctx, values.projectId, true);
    const totalHours = timeFromUnits(timeUnits(saved.row.totalHours) + timeUnits(values.hours));
    const [row] = await tx.insert(timesheetEntry).values({ timesheetId: id, ...values }).returning(); const result = entryDto(row);
    const [updated] = await tx.update(timesheet).set({ totalHours, updatedAt: new Date() }).where(tsScope(ctx, id)).returning(); tsDto(updated);
    await auditTax(tx, ctx.organizationId, "timesheetEntry", row.id, "create", { entry: result, totalHours }, ctx, request); return result;
  });
}
export async function deletePayrollTimesheetEntry(ctx: AuthContext, id: string, entryId: string, request?: Request) {
  requireRole(ctx, "manage:timesheets"); timeId.parse(entryId);
  return transaction(ctx, async tx => {
    const saved = await ownedTimesheet(tx, ctx, id); draft(saved.row); const row = saved.entries.find(e => e.id === entryId);
    if (!row) throw new AuthError("Entry not found in this timesheet", 404);
    const totalHours = timeFromUnits(timeUnits(saved.row.totalHours) - timeUnits(row.hours));
    await tx.delete(timesheetEntry).where(and(eq(timesheetEntry.id, entryId), eq(timesheetEntry.timesheetId, id)));
    const [updated] = await tx.update(timesheet).set({ totalHours, updatedAt: new Date() }).where(tsScope(ctx, id)).returning(); tsDto(updated);
    await auditTax(tx, ctx.organizationId, "timesheetEntry", entryId, "delete", { entry: row, totalHours }, ctx, request); return { success: true };
  });
}
async function transitionTimesheet(ctx: AuthContext, id: string, status: "submitted" | "approved" | "rejected", reason: string | null | undefined, request?: Request) {
  return transaction(ctx, async tx => {
    const saved = await ownedTimesheet(tx, ctx, id);
    if (status === "submitted") draft(saved.row); else if (saved.row.status !== "submitted") throw new AuthError("Only submitted timesheets can be approved or rejected", 409);
    const approvedBy = status === "approved" ? await ownMember(tx, ctx) : undefined;
    const [row] = await tx.update(timesheet).set({ status, updatedAt: new Date(),
      ...(status === "submitted" ? { submittedAt: new Date() } : status === "approved" ? { approvedBy, approvedAt: new Date() } : { rejectionReason: reason ?? null }),
    }).where(tsScope(ctx, id)).returning(); const result = tsDto(row);
    await auditTax(tx, ctx.organizationId, "timesheet", id, status === "submitted" ? "submit" : status === "approved" ? "approve" : "reject", result, ctx, request); return result;
  });
}
export async function submitPayrollTimesheet(ctx: AuthContext, id: string, request?: Request) { requireRole(ctx, "manage:timesheets"); return transitionTimesheet(ctx, id, "submitted", undefined, request); }
export async function approvePayrollTimesheet(ctx: AuthContext, id: string, request?: Request) { requireRole(ctx, "approve:payroll"); return transitionTimesheet(ctx, id, "approved", undefined, request); }
export async function rejectPayrollTimesheet(ctx: AuthContext, id: string, input: unknown, request?: Request) { requireRole(ctx, "approve:payroll"); const p = timeRejectSchema.parse(input); return transitionTimesheet(ctx, id, "rejected", p.reason, request); }

export async function listPayrollShifts(ctx: AuthContext) { requireRole(ctx, "manage:shifts"); return transaction(ctx, async tx => (await tx.select().from(shiftDefinition).where(shiftScope(ctx)).orderBy(asc(shiftDefinition.id))).map(shiftDto)); }
export async function getPayrollShift(ctx: AuthContext, id: string) { requireRole(ctx, "manage:shifts"); timeId.parse(id); return transaction(ctx, async tx => {
  const [row] = await tx.select().from(shiftDefinition).where(shiftScope(ctx, id)); if (!row) throw new AuthError("Shift not found", 404); return shiftDto(row);
}); }
export async function createPayrollShift(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:shifts"); const values = shiftCreateSchema.parse(input);
  return transaction(ctx, async tx => { const [row] = await tx.insert(shiftDefinition).values({ organizationId: ctx.organizationId, ...values }).returning(); const result = shiftDto(row);
    await auditTax(tx, ctx.organizationId, "shiftDefinition", row.id, "create", result, ctx, request); return result; });
}
export async function updatePayrollShift(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:shifts"); timeId.parse(id); const values = shiftUpdateSchema.parse(input);
  return transaction(ctx, async tx => {
    const [old] = await tx.select().from(shiftDefinition).where(shiftScope(ctx, id)); if (!old) throw new AuthError("Shift not found", 404); shiftDto(old);
    const [row] = await tx.update(shiftDefinition).set(values).where(shiftScope(ctx, id)).returning(); const result = shiftDto(row);
    await auditTax(tx, ctx.organizationId, "shiftDefinition", id, "update", result, ctx, request); return result;
  });
}
export async function deletePayrollShift(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:shifts"); timeId.parse(id);
  return transaction(ctx, async tx => {
    const [old] = await tx.select().from(shiftDefinition).where(shiftScope(ctx, id)); if (!old) throw new AuthError("Shift not found", 404); const before = shiftDto(old);
    await tx.update(shiftDefinition).set({ deletedAt: new Date() }).where(shiftScope(ctx, id));
    await auditTax(tx, ctx.organizationId, "shiftDefinition", id, "delete", before, ctx, request); return { success: true };
  });
}
export async function listPayrollEmployeeSchedules(ctx: AuthContext, employeeId: string) {
  requireRole(ctx, "manage:payroll"); return transaction(ctx, async tx => {
    await employee(tx, ctx, employeeId); const rows = await tx.select().from(employeeSchedule).where(eq(employeeSchedule.employeeId, employeeId)).orderBy(asc(employeeSchedule.id));
    return Promise.all(rows.map(async row => ({ ...scheduleDto(row), shift: await ownedShift(tx, ctx, row.shiftId) })));
  });
}
export async function createPayrollEmployeeSchedule(ctx: AuthContext, employeeId: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const values = scheduleCreateSchema.parse(input); orderedDates(values.effectiveFrom, values.effectiveTo);
  return transaction(ctx, async tx => { await employee(tx, ctx, employeeId); await ownedShift(tx, ctx, values.shiftId, true);
    const [row] = await tx.insert(employeeSchedule).values({ employeeId, ...values }).returning(); const result = scheduleDto(row);
    await auditTax(tx, ctx.organizationId, "employeeSchedule", row.id, "create", result, ctx, request); return result; });
}
export async function listPayrollLeavePolicies(ctx: AuthContext) { requireRole(ctx, "manage:leave"); return transaction(ctx, async tx => (await tx.select().from(leavePolicy).where(policyScope(ctx)).orderBy(asc(leavePolicy.id))).map(policyDto)); }
export async function getPayrollLeavePolicy(ctx: AuthContext, id: string) { requireRole(ctx, "manage:leave"); timeId.parse(id); return transaction(ctx, async tx => {
  const [row] = await tx.select().from(leavePolicy).where(policyScope(ctx, id)); if (!row) throw new AuthError("Leave policy not found", 404); return policyDto(row);
}); }
export async function createPayrollLeavePolicy(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:leave"); const values = leavePolicyCreateSchema.parse(input);
  return transaction(ctx, async tx => { const [row] = await tx.insert(leavePolicy).values({ organizationId: ctx.organizationId, ...values }).returning(); const result = policyDto(row);
    await auditTax(tx, ctx.organizationId, "leavePolicy", row.id, "create", result, ctx, request); return result; });
}
export async function updatePayrollLeavePolicy(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:leave"); timeId.parse(id); const values = leavePolicyUpdateSchema.parse(input);
  return transaction(ctx, async tx => {
    const [old] = await tx.select().from(leavePolicy).where(policyScope(ctx, id)); if (!old) throw new AuthError("Leave policy not found", 404); policyDto(old);
    const [row] = await tx.update(leavePolicy).set(values).where(policyScope(ctx, id)).returning(); const result = policyDto(row);
    await auditTax(tx, ctx.organizationId, "leavePolicy", id, "update", result, ctx, request); return result;
  });
}
async function ownedLeave(tx: TaxTx, ctx: AuthContext, id: string) {
  timeId.parse(id); const [row] = await tx.select().from(leaveRequest).where(leaveScope(ctx, id)).for("update");
  if (!row) throw new AuthError("Leave request not found", 404); leaveDto(row);
  return { row, employee: await employee(tx, ctx, row.employeeId), policy: await ownedPolicy(tx, ctx, row.policyId) };
}
export async function listPayrollLeaveRequests(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:leave"); const p = leaveListSchema.parse(input);
  return transaction(ctx, async tx => {
    const scope = and(leaveScope(ctx), p.status ? eq(leaveRequest.status, p.status) : undefined);
    const rows = await tx.select().from(leaveRequest).where(scope).orderBy(desc(leaveRequest.createdAt), asc(leaveRequest.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(leaveRequest).where(scope);
    const data = await Promise.all(rows.map(async r => { const saved = await ownedLeave(tx, ctx, r.id); return { ...leaveDto(saved.row), employee: saved.employee, policy: saved.policy }; }));
    return paginatedResponse(data, legacyMinor(BigInt(count.count)), p.page, p.limit);
  });
}
export async function getPayrollLeaveRequest(ctx: AuthContext, id: string) { requireRole(ctx, "manage:leave"); return transaction(ctx, async tx => {
  const saved = await ownedLeave(tx, ctx, id); return { ...leaveDto(saved.row), employee: saved.employee, policy: saved.policy };
}); }
async function insertLeave(tx: TaxTx, ctx: AuthContext, values: typeof leaveRequestCreateSchema._output, request?: Request) {
  await ownedPolicy(tx, ctx, values.policyId, true);
  const [row] = await tx.insert(leaveRequest).values({ organizationId: ctx.organizationId, ...values }).returning(); const result = leaveDto(row);
  await auditTax(tx, ctx.organizationId, "leaveRequest", row.id, "create", result, ctx, request); return result;
}
export async function createPayrollLeaveRequest(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:leave"); const values = leaveRequestCreateSchema.parse(input); leaveDates(values.startDate, values.endDate);
  return transaction(ctx, async tx => { await employee(tx, ctx, values.employeeId); return insertLeave(tx, ctx, values, request); });
}
export async function updatePayrollLeaveRequest(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:leave"); const values = leaveRequestUpdateSchema.parse(input);
  return transaction(ctx, async tx => {
    const saved = await ownedLeave(tx, ctx, id);
    if (saved.row.status !== "pending" || (values.status && values.status !== "pending" && values.status !== "cancelled")) throw new AuthError("Only pending reasons/cancellation may be edited; use approve/reject endpoints", 409);
    const [row] = await tx.update(leaveRequest).set(values).where(leaveScope(ctx, id)).returning(); const result = leaveDto(row);
    await auditTax(tx, ctx.organizationId, "leaveRequest", id, "update", result, ctx, request); return result;
  });
}
export async function approvePayrollLeaveRequest(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:payroll");
  return transaction(ctx, async tx => {
    const saved = await ownedLeave(tx, ctx, id);
    if (saved.row.status !== "pending") throw new AuthError("Only pending leave requests can be approved", 409);
    await ownedPolicy(tx, ctx, saved.row.policyId, true); const approvedBy = await ownMember(tx, ctx);
    const year = Number(saved.row.startDate.slice(0, 4));
    const balances = await tx.select().from(employeeLeaveBalance).where(and(eq(employeeLeaveBalance.employeeId, saved.row.employeeId), eq(employeeLeaveBalance.policyId, saved.row.policyId), eq(employeeLeaveBalance.year, year))).for("update");
    if (balances.length !== 1) throw new AuthError("One leave balance is required for the request's Gregorian year", 409);
    const balance = balanceDto(balances[0]), requested = timeUnits(saved.row.hours);
    if (timeUnits(balance.balance) < requested) throw new AuthError("Insufficient available leave hours", 409);
    const hours = { balance: timeFromUnits(timeUnits(balance.balance) - requested), usedHours: timeFromUnits(timeUnits(balance.usedHours) + requested) };
    const [updatedBalance] = await tx.update(employeeLeaveBalance).set({ ...hours, updatedAt: new Date() }).where(eq(employeeLeaveBalance.id, balance.id)).returning(); balanceDto(updatedBalance);
    const [row] = await tx.update(leaveRequest).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(leaveScope(ctx, id)).returning(); const result = leaveDto(row);
    await auditTax(tx, ctx.organizationId, "leaveRequest", id, "approve", { request: result, balance: updatedBalance }, ctx, request); return result;
  });
}
export async function rejectPayrollLeaveRequest(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "approve:payroll"); const values = timeRejectSchema.parse(input);
  return transaction(ctx, async tx => {
    const saved = await ownedLeave(tx, ctx, id); if (saved.row.status !== "pending") throw new AuthError("Only pending leave requests can be rejected", 409);
    const [row] = await tx.update(leaveRequest).set({ status: "rejected", rejectionReason: values.reason ?? null }).where(leaveScope(ctx, id)).returning(); const result = leaveDto(row);
    await auditTax(tx, ctx.organizationId, "leaveRequest", id, "reject", result, ctx, request); return result;
  });
}
async function balances(tx: TaxTx, ctx: AuthContext, employeeId: string) {
  const rows = await tx.select().from(employeeLeaveBalance).where(eq(employeeLeaveBalance.employeeId, employeeId)).orderBy(asc(employeeLeaveBalance.year), asc(employeeLeaveBalance.id));
  const seen = new Set<string>();
  return Promise.all(rows.map(async row => {
    const key = `${row.policyId}:${row.year}`; if (seen.has(key)) throw new WireCompatibilityError("Duplicate saved policy/year leave balances"); seen.add(key);
    return { ...balanceDto(row), policy: await ownedPolicy(tx, ctx, row.policyId) };
  }));
}
export async function getPayrollEmployeeLeaveBalances(ctx: AuthContext, employeeId: string) {
  requireRole(ctx, "manage:leave"); return transaction(ctx, async tx => { await employee(tx, ctx, employeeId); return balances(tx, ctx, employeeId); });
}
export async function listSelfPayrollTimesheets(ctx: AuthContext) {
  requireRole(ctx, "self-service:payroll"); return transaction(ctx, async tx => {
    const emp = await selfEmployee(tx, ctx); const rows = await tx.select().from(timesheet).where(and(tsScope(ctx), eq(timesheet.employeeId, emp.id))).orderBy(desc(timesheet.createdAt), asc(timesheet.id));
    return Promise.all(rows.map(async row => {
      const saved = await ownedTimesheet(tx, ctx, row.id);
      // Self-service retains entry rows only; project financial details require managerial access.
      return { ...tsDto(row), entries: saved.entries.map(e => ({ id: e.id, timesheetId: e.timesheetId, date: e.date, hours: e.hours,
        shiftType: e.shiftType, description: e.description, projectId: e.projectId })) };
    }));
  });
}
export async function createSelfPayrollTimesheet(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "self-service:payroll"); const values = selfTimesheetCreateSchema.parse(input); orderedDates(values.periodStart, values.periodEnd);
  return transaction(ctx, async tx => { const emp = await selfEmployee(tx, ctx); return insertTimesheet(tx, ctx, { ...values, employeeId: emp.id }, request); });
}
export async function createSelfPayrollLeaveRequest(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "self-service:payroll"); const values = selfLeaveCreateSchema.parse(input); leaveDates(values.startDate, values.endDate);
  return transaction(ctx, async tx => { const emp = await selfEmployee(tx, ctx); return insertLeave(tx, ctx, { ...values, employeeId: emp.id }, request); });
}
export async function getSelfPayrollLeaveBalances(ctx: AuthContext) {
  requireRole(ctx, "self-service:payroll"); return transaction(ctx, async tx => { const emp = await selfEmployee(tx, ctx); return balances(tx, ctx, emp.id); });
}
