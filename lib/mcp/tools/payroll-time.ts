import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listPayrollTimesheets, createPayrollTimesheet, getPayrollTimesheet, updatePayrollTimesheet, listPayrollTimesheetEntries, createPayrollTimesheetEntry, deletePayrollTimesheetEntry, submitPayrollTimesheet, approvePayrollTimesheet, rejectPayrollTimesheet, listPayrollShifts, createPayrollShift, getPayrollShift, updatePayrollShift, listPayrollLeavePolicies, createPayrollLeavePolicy, getPayrollLeavePolicy, updatePayrollLeavePolicy, deletePayrollShift, listPayrollEmployeeSchedules, createPayrollEmployeeSchedule, listPayrollLeaveRequests, createPayrollLeaveRequest, getPayrollLeaveRequest, updatePayrollLeaveRequest, approvePayrollLeaveRequest, rejectPayrollLeaveRequest, getPayrollEmployeeLeaveBalances, listSelfPayrollTimesheets, createSelfPayrollTimesheet, createSelfPayrollLeaveRequest, getSelfPayrollLeaveBalances } from "@/lib/api/payroll-time";
import { timeId, leaveListSchema, leavePolicyCreateSchema, leavePolicyUpdateSchema, leaveRequestCreateSchema, leaveRequestUpdateSchema, scheduleCreateSchema, selfLeaveCreateSchema, selfTimesheetCreateSchema, shiftCreateSchema, shiftUpdateSchema, timeEntryCreateSchema, timeRejectSchema, timesheetCreateSchema, timesheetListSchema, timesheetUpdateSchema } from "@/lib/api/payroll-time-wire";
export function registerPayrollTimeTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_payroll_timesheets", { description: "List payroll timesheets. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns paginated data and pagination. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: timesheetListSchema }, args => wrapTool(ctx, async () => {
    const result = await listPayrollTimesheets(ctx, args);
    return result;
  }));
  server.registerTool("create_payroll_timesheet", { description: "Create payroll timesheet. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: timesheetCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollTimesheet(ctx, args);
    return { timesheet: result };
  }));
  server.registerTool("get_payroll_timesheet", { description: "Get payroll timesheet. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollTimesheet(ctx, args.id);
    return { timesheet: result };
  }));
  server.registerTool("update_payroll_timesheet", { description: "Update payroll timesheet. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: timesheetUpdateSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await updatePayrollTimesheet(ctx, id, body);
    return { timesheet: result };
  }));
  server.registerTool("list_payroll_timesheet_entries", { description: "List payroll timesheet entries. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await listPayrollTimesheetEntries(ctx, args.id);
    return { data: result };
  }));
  server.registerTool("create_payroll_timesheet_entry", { description: "Create payroll timesheet entry. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns entry. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: timeEntryCreateSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await createPayrollTimesheetEntry(ctx, id, body);
    return { entry: result };
  }));
  server.registerTool("delete_payroll_timesheet_entry", { description: "Delete payroll timesheet entry. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns success. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID"), entryId: timeId.describe("Entry UUID belonging to id timesheet") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollTimesheetEntry(ctx, args.id, args.entryId);
    return result;
  }));
  server.registerTool("submit_payroll_timesheet", { description: "Submit payroll timesheet. Requires manage:timesheets. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await submitPayrollTimesheet(ctx, args.id);
    return { timesheet: result };
  }));
  server.registerTool("approve_payroll_timesheet", { description: "Approve payroll timesheet. Requires approve:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await approvePayrollTimesheet(ctx, args.id);
    return { timesheet: result };
  }));
  server.registerTool("reject_payroll_timesheet", { description: "Reject payroll timesheet. Requires approve:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: timeRejectSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await rejectPayrollTimesheet(ctx, id, body);
    return { timesheet: result };
  }));
  server.registerTool("list_payroll_shifts", { description: "List payroll shifts. Requires manage:shifts. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listPayrollShifts(ctx);
    return { data: result };
  }));
  server.registerTool("create_payroll_shift", { description: "Create payroll shift. Requires manage:shifts. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns shift.", inputSchema: shiftCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollShift(ctx, args);
    return { shift: result };
  }));
  server.registerTool("get_payroll_shift", { description: "Get payroll shift. Requires manage:shifts. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns shift.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollShift(ctx, args.id);
    return { shift: result };
  }));
  server.registerTool("update_payroll_shift", { description: "Update payroll shift. Requires manage:shifts. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns shift.", inputSchema: shiftUpdateSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await updatePayrollShift(ctx, id, body);
    return { shift: result };
  }));
  server.registerTool("list_payroll_leave_policies", { description: "List payroll leave policies. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listPayrollLeavePolicies(ctx);
    return { data: result };
  }));
  server.registerTool("create_payroll_leave_policy", { description: "Create payroll leave policy. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns policy.", inputSchema: leavePolicyCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollLeavePolicy(ctx, args);
    return { policy: result };
  }));
  server.registerTool("get_payroll_leave_policy", { description: "Get payroll leave policy. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns policy.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollLeavePolicy(ctx, args.id);
    return { policy: result };
  }));
  server.registerTool("update_payroll_leave_policy", { description: "Update payroll leave policy. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns policy.", inputSchema: leavePolicyUpdateSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await updatePayrollLeavePolicy(ctx, id, body);
    return { policy: result };
  }));
  server.registerTool("delete_payroll_shift", { description: "Delete payroll shift. Requires manage:shifts. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns success.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollShift(ctx, args.id);
    return result;
  }));
  server.registerTool("list_payroll_employee_schedules", { description: "List payroll employee schedules. Requires manage:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data.", inputSchema: z.object({ employeeId: timeId.describe("Live owned employee UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await listPayrollEmployeeSchedules(ctx, args.employeeId);
    return { data: result };
  }));
  server.registerTool("create_payroll_employee_schedule", { description: "Create payroll employee schedule. Requires manage:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns schedule.", inputSchema: scheduleCreateSchema.extend({ employeeId: timeId.describe("Live owned employee UUID") }) }, args => wrapTool(ctx, async () => {
    const { employeeId, ...body } = args;
    const result = await createPayrollEmployeeSchedule(ctx, employeeId, body);
    return { schedule: result };
  }));
  server.registerTool("list_payroll_leave_requests", { description: "List payroll leave requests. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns paginated data and pagination.", inputSchema: leaveListSchema }, args => wrapTool(ctx, async () => {
    const result = await listPayrollLeaveRequests(ctx, args);
    return result;
  }));
  server.registerTool("create_payroll_leave_request", { description: "Create payroll leave request. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns request.", inputSchema: leaveRequestCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollLeaveRequest(ctx, args);
    return { request: result };
  }));
  server.registerTool("get_payroll_leave_request", { description: "Get payroll leave request. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns request.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollLeaveRequest(ctx, args.id);
    return { request: result };
  }));
  server.registerTool("update_payroll_leave_request", { description: "Update payroll leave request. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns request. Only pending reasons/cancellation; use separate approval/rejection tools.", inputSchema: leaveRequestUpdateSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await updatePayrollLeaveRequest(ctx, id, body);
    return { request: result };
  }));
  server.registerTool("approve_payroll_leave_request", { description: "Approve payroll leave request. Requires approve:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns request. Requires approve:payroll, pending status and one sufficient owned balance for request year; deducts once. No retry mutation.", inputSchema: z.object({ id: timeId.describe("Live owned record UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await approvePayrollLeaveRequest(ctx, args.id);
    return { request: result };
  }));
  server.registerTool("reject_payroll_leave_request", { description: "Reject payroll leave request. Requires approve:payroll. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns request.", inputSchema: timeRejectSchema.extend({ id: timeId.describe("Live owned record UUID") }) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args;
    const result = await rejectPayrollLeaveRequest(ctx, id, body);
    return { request: result };
  }));
  server.registerTool("get_employee_leave_balances", { description: "Get employee leave balances. Requires manage:leave. Owned live organization records only. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns balances in hours by policy/year.", inputSchema: z.object({ employeeId: timeId.describe("Live owned employee UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollEmployeeLeaveBalances(ctx, args.employeeId);
    return { balances: result.map(b => ({ id: b.id, policyId: b.policyId, policyName: b.policy.name, leaveType: b.policy.leaveType, year: b.year, balance: b.balance, usedHours: b.usedHours })) };
  }));
  server.registerTool("list_self_payroll_timesheets", { description: "List self payroll timesheets. Requires self-service:payroll. Self-service: resolves one live employee from authenticated organization membership; no employee override. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listSelfPayrollTimesheets(ctx);
    return { data: result };
  }));
  server.registerTool("create_self_payroll_timesheet", { description: "Create self payroll timesheet. Requires self-service:payroll. Self-service: resolves one live employee from authenticated organization membership; no employee override. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns timesheet. Edits/submit require draft; approve/reject require submitted; entries must fit period and any project must be owned.", inputSchema: selfTimesheetCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createSelfPayrollTimesheet(ctx, args);
    return { timesheet: result };
  }));
  server.registerTool("create_self_payroll_leave_request", { description: "Create self payroll leave request. Requires self-service:payroll. Self-service: resolves one live employee from authenticated organization membership; no employee override. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Writes and audit are atomic; unsupported storage precision/history rejects before commit. Returns request.", inputSchema: selfLeaveCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createSelfPayrollLeaveRequest(ctx, args);
    return { request: result };
  }));
  server.registerTool("get_self_payroll_leave_balances", { description: "Get self payroll leave balances. Requires self-service:payroll. Self-service: resolves one live employee from authenticated organization membership; no employee override. Physical hours and decimal premium percentages stay numeric binary32 exact; not cents, minutes or basis points. Gregorian dates must be ordered; leave requests use one Gregorian year. Returns data.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await getSelfPayrollLeaveBalances(ctx);
    return { data: result };
  }));
}
