import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { employeeCreateSchema, employeeUpdateSchema, contractorCreateSchema, contractorUpdateSchema,
  payrollMasterId, payrollMasterListSchema } from "@/lib/api/payroll-master-wire";
import { listPayrollEmployees, getPayrollEmployee, createPayrollEmployee, updatePayrollEmployee, deletePayrollEmployee,
  listPayrollContractors, getPayrollContractor, createPayrollContractor, updatePayrollContractor, deletePayrollContractor } from "@/lib/api/payroll-master";

export function registerPayrollMasterTools(server: McpServer, ctx: AuthContext) {
  const employeeId = { employeeId: payrollMasterId.describe("Live payroll employee UUID owned by the authenticated organization") };
  const contractorId = { contractorId: payrollMasterId.describe("Live contractor UUID owned by the authenticated organization") };
  server.registerTool("list_payroll_employees", { description: "List live organization payroll employees, filtered by active status and paginated; manage:payroll required. Returns employees, total, page, limit. salary is annual integer cents and hourlyRate is integer cents per hour, with salaryMinor/hourlyRateMinor strings (nullable hourly rate). taxRate is basis points, PTO is hours. Safe money range 0..9007199254740991; currencies never rescale cents.",
    inputSchema: payrollMasterListSchema }, args => wrapTool(ctx, () => listPayrollEmployees(ctx, args)));
  server.registerTool("get_payroll_employee", { description: "Get an owned live payroll employee with numeric cents and exact salaryMinor/hourlyRateMinor aliases and an organization-scoped member/user profile without credentials. manage:payroll required; returns employee.",
    inputSchema: z.object(employeeId).strict() }, args => wrapTool(ctx, async () => ({ employee: await getPayrollEmployee(ctx, args.employeeId) })));
  server.registerTool("create_payroll_employee", { description: "Create a payroll employee atomically with audit; manage:payroll required. Annual salary or salaryMinor is required, zero allowed for hourly staff. Hourly rate is cents per hour. Nonnegative safe integer cents or matching canonical *Minor strings, max 9007199254740991; taxRate is basis points 0..10000. Dates are Gregorian, member must be owned, currency defaults USD. Returns employee. Does not create or post a pay run.",
    inputSchema: employeeCreateSchema }, args => wrapTool(ctx, async () => ({ employee: await createPayrollEmployee(ctx, args) })));
  server.registerTool("update_payroll_employee", { description: "Patch an owned live employee atomically with audit; manage:payroll required. Money is safe nonnegative integer cents or matching *Minor strings; nullable hourly rate clears with null. Omitted fields retain values. Salary is annual, taxRate basis points; dates/member ownership validated. Returns employee; posted payroll history is retained.",
    inputSchema: employeeUpdateSchema.extend(employeeId) }, args => wrapTool(ctx, async () => {
      const { employeeId, ...body } = args; return { employee: await updatePayrollEmployee(ctx, employeeId, body) };
    }));
  server.registerTool("delete_payroll_employee", { description: "Soft-delete an owned live employee atomically with audit; manage:payroll required. Returns success; retains historical payroll records. Repeated deletion returns 404.",
    inputSchema: z.object(employeeId).strict() }, args => wrapTool(ctx, () => deletePayrollEmployee(ctx, args.employeeId)));
  server.registerTool("list_contractors", { description: "List owned live contractors, optionally filtered by active status and paginated; manage:contractors required. Returns contractors, total, page, limit, numeric integer cents hourlyRate and nullable hourlyRateMinor strings. Safe range 0..9007199254740991; cents never rescale by currency.",
    inputSchema: payrollMasterListSchema }, args => wrapTool(ctx, () => listPayrollContractors(ctx, args)));
  server.registerTool("get_contractor", { description: "Get an owned live contractor and its historical payments; manage:contractors required. Returns contractor with numeric cents hourlyRate/amount and nullable hourlyRateMinor/amountMinor strings. Payments keep their own currency and status; no currency conversion or summing occurs.",
    inputSchema: z.object(contractorId).strict() }, args => wrapTool(ctx, async () => ({ contractor: await getPayrollContractor(ctx, args.contractorId) })));
  server.registerTool("create_contractor", { description: "Create an owned contractor atomically with audit; manage:contractors required. Hourly rate is nullable nonnegative safe integer cents per hour or a matching hourlyRateMinor string, max 9007199254740991; defaults null. Currency defaults USD without rescaling cents. Returns contractor; no payment or ledger posting occurs.",
    inputSchema: contractorCreateSchema }, args => wrapTool(ctx, async () => ({ contractor: await createPayrollContractor(ctx, args) })));
  server.registerTool("update_contractor", { description: "Patch an owned live contractor atomically with audit; manage:contractors required. Hourly rate uses safe nonnegative integer cents or matching hourlyRateMinor string; null clears. Omitted fields retain values. Currency changes require no payment history. Returns contractor.",
    inputSchema: contractorUpdateSchema.extend(contractorId) }, args => wrapTool(ctx, async () => {
      const { contractorId, ...body } = args; return { contractor: await updatePayrollContractor(ctx, contractorId, body) };
    }));
  server.registerTool("delete_contractor", { description: "Soft-delete an owned live contractor atomically with audit; manage:contractors required. Returns success; retains payment history. Repeated deletion returns 404.",
    inputSchema: z.object(contractorId).strict() }, args => wrapTool(ctx, () => deletePayrollContractor(ctx, args.contractorId)));
}
