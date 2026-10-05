import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { listPayrollRuns, createPayrollRun, getPayrollRun, updatePayrollRun, deletePayrollRun, processPayrollRun, submitPayrollRun, approvePayrollRun, rejectPayrollRun, createBonusPayrollRun, createTerminationPayrollRun, createCorrectionPayrollRun, listPayrollRunBonuses, createPayrollRunBonus, deletePayrollRunBonus, listPayrollRunItems } from "@/lib/api/payroll-runs";
import { bonusCreateSchema, bonusRunSchema, correctionRunSchema, runCreateSchema, runListSchema, runRejectSchema, runUpdateSchema, runProcessSchema, terminationRunSchema, runId } from "@/lib/api/payroll-run-wire";
export function registerPayrollRunTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_payroll_runs", { description: "List payroll runs. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns runs and pagination.", inputSchema: runListSchema }, args => wrapTool(ctx, async () => {
    const result = await listPayrollRuns(ctx, args);
    return { runs: result.data, ...result.pagination, pagination: result.pagination };
  }));
  server.registerTool("create_payroll_run", { description: "Create payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run. Creates a draft for active salary/hourly employees; approved entry dates are filtered to the period. Without approved timesheets legacy default hours remain 40/80/173; overtime threshold applies per run.", inputSchema: runCreateSchema }, args => wrapTool(ctx, async () => {
    const result = await createPayrollRun(ctx, args);
    return { run: result };
  }));
  server.registerTool("get_payroll_run", { description: "Get payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await getPayrollRun(ctx, args.payRunId);
    return { run: result };
  }));
  server.registerTool("update_payroll_run", { description: "Update payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run. Only unapproved drafts can change. Bonus edits recalculate payable amounts. Posted runs require corrections.", inputSchema: runUpdateSchema.extend({ payRunId: runId.describe("Owned payroll run UUID") }) }, args => wrapTool(ctx, async () => {
    const { payRunId, ...body } = args; void payRunId;
    const result = await updatePayrollRun(ctx, args.payRunId, body);
    return { run: result };
  }));
  server.registerTool("delete_payroll_run", { description: "Delete payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns success. Only unapproved drafts can change. Bonus edits recalculate payable amounts. Posted runs require corrections.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollRun(ctx, args.payRunId);
    return result;
  }));
  server.registerTool("process_payroll_run", { description: "Process payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run and journalEntryId. Optional accrued credits net wages to payable instead of bank. Posts one balanced journal atomically with audit; period locks and active approval chains apply. Special runs remain draft when approval is configured. Completed process retries return existing run.", inputSchema: runProcessSchema.extend({ payRunId: runId.describe("Owned payroll run UUID") }) }, args => wrapTool(ctx, async () => {
    const result = await processPayrollRun(ctx, args.payRunId, { accrued: args.accrued });
    return { run: result, journalEntryId: result.journalEntryId };
  }));
  server.registerTool("submit_payroll_run_for_approval", { description: "Submit payroll run for approval. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await submitPayrollRun(ctx, args.payRunId);
    return { run: result };
  }));
  server.registerTool("approve_payroll_run", { description: "Approve payroll run. Requires approve:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await approvePayrollRun(ctx, args.payRunId);
    return { run: result };
  }));
  server.registerTool("reject_payroll_run", { description: "Reject payroll run. Requires approve:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run.", inputSchema: runRejectSchema.extend({ payRunId: runId.describe("Owned payroll run UUID") }) }, args => wrapTool(ctx, async () => {
    const { payRunId, ...body } = args; void payRunId;
    const result = await rejectPayrollRun(ctx, args.payRunId, body);
    return { run: result };
  }));
  server.registerTool("create_bonus_payroll_run", { description: "Create bonus payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run. Posts one balanced journal atomically with audit; period locks and active approval chains apply. Special runs remain draft when approval is configured. Completed process retries return existing run.", inputSchema: bonusRunSchema }, args => wrapTool(ctx, async () => {
    const result = await createBonusPayrollRun(ctx, args);
    return { run: result };
  }));
  server.registerTool("create_termination_payroll_run", { description: "Create termination payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run. Posts one balanced journal atomically with audit; period locks and active approval chains apply. Special runs remain draft when approval is configured. Completed process retries return existing run.", inputSchema: terminationRunSchema }, args => wrapTool(ctx, async () => {
    const result = await createTerminationPayrollRun(ctx, args);
    return { run: result };
  }));
  server.registerTool("create_correction_payroll_run", { description: "Create correction payroll run. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns run. Posts one balanced journal atomically with audit; period locks and active approval chains apply. Special runs remain draft when approval is configured. Completed process retries return existing run. Uses one nonzero adjustment per parent employee, signed proportional tax/deduction snapshots and historical FX. No posted history is rewritten.", inputSchema: correctionRunSchema }, args => wrapTool(ctx, async () => {
    const result = await createCorrectionPayrollRun(ctx, args);
    return { run: result };
  }));
  server.registerTool("list_payroll_run_bonuses", { description: "List payroll run bonuses. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns bonuses.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await listPayrollRunBonuses(ctx, args.payRunId);
    return { bonuses: result };
  }));
  server.registerTool("create_payroll_run_bonus", { description: "Create payroll run bonus. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns bonus. Only unapproved drafts can change. Bonus edits recalculate payable amounts. Posted runs require corrections.", inputSchema: bonusCreateSchema.extend({ payRunId: runId.describe("Owned payroll run UUID") }) }, args => wrapTool(ctx, async () => {
    const { payRunId, ...body } = args; void payRunId;
    const result = await createPayrollRunBonus(ctx, args.payRunId, body);
    return { bonus: result };
  }));
  server.registerTool("delete_payroll_run_bonus", { description: "Delete payroll run bonus. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns success. Only unapproved drafts can change. Bonus edits recalculate payable amounts. Posted runs require corrections.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID"), bonusId: runId.describe("Bonus UUID belonging to payRunId") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await deletePayrollRunBonus(ctx, args.payRunId, args.bonusId);
    return result;
  }));
  server.registerTool("list_payroll_run_items", { description: "List payroll run items. Requires manage:payroll. Owned organization records only. Amounts are integer cents with matching Minor strings, max absolute 9007199254740991; aliases must agree. Employee amounts use employee currency; run totals use saved baseCurrency. Hours remain numeric binary32, tax rates basis points, rateExact is employee-to-run-base decimal quote_per_base. No rescaling. Returns items.", inputSchema: z.object({ payRunId: runId.describe("Owned payroll run UUID") }).strict() }, args => wrapTool(ctx, async () => {
    const result = await listPayrollRunItems(ctx, args.payRunId);
    return { items: result };
  }));
}
