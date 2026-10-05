import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getPayrollSettings, updatePayrollSettings, listPayrollDeductionTypes, getPayrollDeductionType, createPayrollDeductionType, updatePayrollDeductionType, deletePayrollDeductionType, listPayrollEmployeeDeductions, createPayrollEmployeeDeduction, updatePayrollEmployeeDeduction, deletePayrollEmployeeDeduction, getPayrollEmployeeTaxConfig, updatePayrollEmployeeTaxConfig, listPayrollTaxBrackets, getPayrollTaxBracket, createPayrollTaxBracket, updatePayrollTaxBracket, deletePayrollTaxBracket, listPayrollTaxAllowances, getPayrollTaxAllowance, createPayrollTaxAllowance, updatePayrollTaxAllowance, deletePayrollTaxAllowance } from "@/lib/api/payroll-config";
import { payrollConfigId, payrollSettingsUpdateSchema, deductionTypeCreateSchema, deductionTypeUpdateSchema, employeeDeductionCreateSchema, employeeDeductionUpdateSchema, employeeTaxUpdateSchema, taxBracketCreateSchema, taxBracketUpdateSchema, taxAllowanceCreateSchema, taxAllowanceUpdateSchema } from "@/lib/api/payroll-config-wire";
const configId = { id: payrollConfigId.describe("Owned live configuration UUID; for employee deductions, must belong to employeeId") };
const employeeId = { employeeId: payrollConfigId.describe("Owned live employee UUID") };
export function registerPayrollConfigTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_payroll_settings", { description: "Read or initialize owned payroll settings with manage:payroll. Returns settings with numeric cents thresholds and matching *Minor strings; rates remain basis points. Initialization and audit are atomic.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await getPayrollSettings(ctx); return { settings: result };
  }));
  server.registerTool("update_payroll_settings", { description: "Patch owned payroll settings with manage:payroll and atomic audit. Thresholds/wage bases use nonnegative integer cents or matching *Minor strings, max 9007199254740991. Rates are integer basis points; overtime controls must fit binary32 exactly. Account codes must be owned active accounts of the expected type. Returns settings; currency changes require no run history.", inputSchema: payrollSettingsUpdateSchema }, args => wrapTool(ctx, async () => {
    const body = args; const result = await updatePayrollSettings(ctx, body); return { settings: result };
  }));
  server.registerTool("list_payroll_deduction_types", { description: "List owned live deduction types with manage:payroll. Returns data with nullable numeric defaultAmount cents and defaultAmountMinor strings; defaultPercent is decimal percent of gross, not basis points.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listPayrollDeductionTypes(ctx); return { data: result };
  }));
  server.registerTool("get_payroll_deduction_type", { description: "Get an owned live deduction type with manage:payroll. Returns deductionType with nullable numeric integer cents and defaultAmountMinor, decimal defaultPercent and category.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollDeductionType(ctx, args.id); return { deductionType: result };
  }));
  server.registerTool("create_payroll_deduction_type", { description: "Create owned deduction type with manage:payroll and atomic audit. defaultAmount is nullable nonnegative safe integer cents or matching defaultAmountMinor. defaultPercent is 0..100 decimal percent and must fit binary32 exactly. Returns deductionType; no payroll or ledger posting.", inputSchema: deductionTypeCreateSchema }, args => wrapTool(ctx, async () => {
    const body = args; const result = await createPayrollDeductionType(ctx, body); return { deductionType: result };
  }));
  server.registerTool("update_payroll_deduction_type", { description: "Patch owned live deduction type with manage:payroll and atomic audit. Nullable nonnegative safe cents defaultAmount/defaultAmountMinor must agree; decimal percent must fit binary32 exactly. Null clears, omission retains. Returns deductionType.", inputSchema: deductionTypeUpdateSchema.extend(configId) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args; const result = await updatePayrollDeductionType(ctx, id, body); return { deductionType: result };
  }));
  server.registerTool("delete_payroll_deduction_type", { description: "Soft-delete owned live deduction type with manage:payroll and atomic audit. Returns success; retains assigned and posted deduction history; repeated deletion returns 404.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollDeductionType(ctx, args.id); return result;
  }));
  server.registerTool("list_payroll_employee_deductions", { description: "List deductions for an owned live employee with manage:payroll. Returns data with numeric cents amount and nullable amountMinor plus owned deductionType with exact aliases. Cross-tenant historical type links reject.", inputSchema: z.object(employeeId).strict() }, args => wrapTool(ctx, async () => {
    const result = await listPayrollEmployeeDeductions(ctx, args.employeeId); return { data: result };
  }));
  server.registerTool("create_payroll_employee_deduction", { description: "Assign a live owned type to an owned employee with manage:payroll and atomic audit. amount/amountMinor are nullable nonnegative safe integer cents; percent is decimal 0..100 binary32 exact. Dates are Gregorian YYYY-MM-DD with ordered endpoints. Returns deduction.", inputSchema: employeeDeductionCreateSchema.extend(employeeId) }, args => wrapTool(ctx, async () => {
    const { employeeId, ...body } = args; const result = await createPayrollEmployeeDeduction(ctx, employeeId, body); return { deduction: result };
  }));
  server.registerTool("update_payroll_employee_deduction", { description: "Patch a live deduction belonging to the specified owned employee with manage:payroll and atomic audit. amount/amountMinor are nullable safe cents; percent is decimal percent exact in binary32. Omitted fields retain values; null clears. Returns deduction; validates dates after merging.", inputSchema: employeeDeductionUpdateSchema.extend(employeeId).extend(configId) }, args => wrapTool(ctx, async () => {
    const { employeeId, id, ...body } = args; const result = await updatePayrollEmployeeDeduction(ctx, employeeId, id, body); return { deduction: result };
  }));
  server.registerTool("delete_payroll_employee_deduction", { description: "Soft-delete a live deduction belonging to the specified owned employee with manage:payroll and atomic audit. Returns success and retains posted history; repeated deletion returns 404.", inputSchema: z.object({...employeeId,...configId}).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollEmployeeDeduction(ctx, args.employeeId, args.id); return result;
  }));
  server.registerTool("get_payroll_employee_tax_config", { description: "Read or initialize owned live employee tax elections with manage:payroll. Returns taxConfig with nullable numeric cents additionalWithholding and additionalWithholdingMinor, int32 allowance counts and filing status. Initialization is atomic with audit.", inputSchema: z.object(employeeId).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollEmployeeTaxConfig(ctx, args.employeeId); return { taxConfig: result };
  }));
  server.registerTool("update_payroll_employee_tax_config", { description: "Patch tax elections for owned live employee with manage:payroll and atomic audit. additionalWithholding/additionalWithholdingMinor are nullable nonnegative safe cents per pay period; allowance counts are nonnegative int32, not money. Returns taxConfig.", inputSchema: employeeTaxUpdateSchema.extend(employeeId) }, args => wrapTool(ctx, async () => {
    const { employeeId, ...body } = args; const result = await updatePayrollEmployeeTaxConfig(ctx, employeeId, body); return { taxConfig: result };
  }));
  server.registerTool("list_payroll_tax_brackets", { description: "List owned live brackets with manage:tax-config. minIncome/maxIncome, baseAmountCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Ceiling must exceed floor; null means unbounded. Returns data; no ledger posting.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listPayrollTaxBrackets(ctx); return { data: result };
  }));
  server.registerTool("get_payroll_tax_bracket", { description: "Get owned live bracket with manage:tax-config. minIncome/maxIncome, baseAmountCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Ceiling must exceed floor; null means unbounded. Returns bracket; no ledger posting.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollTaxBracket(ctx, args.id); return { bracket: result };
  }));
  server.registerTool("create_payroll_tax_bracket", { description: "Create owned live bracket with manage:tax-config and atomic audit. minIncome/maxIncome, baseAmountCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Ceiling must exceed floor; null means unbounded. Returns bracket; no ledger posting.", inputSchema: taxBracketCreateSchema }, args => wrapTool(ctx, async () => {
    const body = args; const result = await createPayrollTaxBracket(ctx, body); return { bracket: result };
  }));
  server.registerTool("update_payroll_tax_bracket", { description: "Update owned live bracket with manage:tax-config and atomic audit. minIncome/maxIncome, baseAmountCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Ceiling must exceed floor; null means unbounded. Returns bracket; no ledger posting.", inputSchema: taxBracketUpdateSchema.extend(configId) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args; const result = await updatePayrollTaxBracket(ctx, id, body); return { bracket: result };
  }));
  server.registerTool("delete_payroll_tax_bracket", { description: "Delete owned live bracket with manage:tax-config and atomic audit. minIncome/maxIncome, baseAmountCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Ceiling must exceed floor; null means unbounded. Returns success; no ledger posting.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollTaxBracket(ctx, args.id); return result;
  }));
  server.registerTool("list_payroll_tax_allowances", { description: "List owned live allowances with manage:tax-config. allowanceValueCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Only one live configuration per jurisdiction/year; duplicates return 409. Returns data; no ledger posting.", inputSchema: z.object({}).strict() }, () => wrapTool(ctx, async () => {
    const result = await listPayrollTaxAllowances(ctx); return { data: result };
  }));
  server.registerTool("get_payroll_tax_allowance", { description: "Get owned live allowance with manage:tax-config. allowanceValueCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Only one live configuration per jurisdiction/year; duplicates return 409. Returns allowance; no ledger posting.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollTaxAllowance(ctx, args.id); return { allowance: result };
  }));
  server.registerTool("create_payroll_tax_allowance", { description: "Create owned live allowance with manage:tax-config and atomic audit. allowanceValueCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Only one live configuration per jurisdiction/year; duplicates return 409. Returns allowance; no ledger posting.", inputSchema: taxAllowanceCreateSchema }, args => wrapTool(ctx, async () => {
    const body = args; const result = await createPayrollTaxAllowance(ctx, body); return { allowance: result };
  }));
  server.registerTool("update_payroll_tax_allowance", { description: "Update owned live allowance with manage:tax-config and atomic audit. allowanceValueCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Only one live configuration per jurisdiction/year; duplicates return 409. Returns allowance; no ledger posting.", inputSchema: taxAllowanceUpdateSchema.extend(configId) }, args => wrapTool(ctx, async () => {
    const { id, ...body } = args; const result = await updatePayrollTaxAllowance(ctx, id, body); return { allowance: result };
  }));
  server.registerTool("delete_payroll_tax_allowance", { description: "Delete owned live allowance with manage:tax-config and atomic audit. allowanceValueCents and standardDeductionCents are nonnegative integer annual cents with matching *Minor aliases, max 9007199254740991; rates remain basis points. Gregorian year and jurisdiction labels are explicit; no statutory policy lookup. Only one live configuration per jurisdiction/year; duplicates return 409. Returns success; no ledger posting.", inputSchema: z.object(configId).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollTaxAllowance(ctx, args.id); return result;
  }));
}
