import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { budget } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { budgetCreateSchema, budgetUpdateSchema } from "@/lib/api/budget-wire";
import { createBudget, updateBudget, deleteBudget, getBudget, assertBudgetReadScope } from "@/lib/api/budget-write";
import { getBudgetReport } from "@/lib/api/budget-report";
import { budgetReportSchema } from "@/lib/api/budget-report-wire";
import { checkBudgetAlerts } from "@/lib/api/budget-alerts";
import { budgetAlertSchema } from "@/lib/api/budget-alert-wire";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for budgets: a named plan with one line per chart-of-accounts
 * account, each line broken into time periods (monthly/weekly/etc) within the
 * budget's date range, plus a budget-vs-actual report that compares each line's
 * plan against posted general-ledger activity.
 *
 * All monetary amounts — both INPUTS and RESULTS — are integer cents (e.g.
 * $12.50 = 1250). Direct DB access via Drizzle (no HTTP self-calls); every
 * query is scoped to the AuthContext's organization.
 */

export function registerBudgetTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("check_budget_alerts", {
    description: "Check this organization's active budgets for periods containing today (UTC); requires manage:budgets. Input is an empty object. Returns checked period count, alerted newly created recipient notification count and evaluations with currencyCode, budgeted/actual/threshold numeric cents and agreeing *Minor strings (+/-9007199254740991), thresholdPct and exceedsThreshold. Actual is absolute posted base-GL net activity; threshold is rounded half-up. No FX/rescaling. Notifies owners/admins once per period per user, including concurrent/repeated checks. Unsupported money/history fails with 422 LEGACY_NUMERIC_RANGE before notification writes; optional email delivery is best effort.",
    inputSchema: budgetAlertSchema,
  }, params => wrapTool(ctx, () => checkBudgetAlerts(ctx, params)));
  server.tool(
    "list_budgets",
    "List budgets for the organization with pagination, newest first. Each budget includes its fiscal year (when set). Returns the budgets and the total count. Returns headers only, without line totals or period amounts; get_budget returns those with exact cents aliases.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe("Number of budgets to return (max 100)"),
      page: z.number().int().min(1).optional().default(1).describe("Page number (1-based)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const conditions = [
          eq(budget.organizationId, ctx.organizationId),
          notDeleted(budget.deletedAt),
        ];

        const offset = (params.page - 1) * params.limit;
        const budgets = await db.query.budget.findMany({
          where: and(...conditions),
          orderBy: desc(budget.createdAt),
          limit: params.limit,
          offset,
          with: { fiscalYear: true },
        });

        const [countResult] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(budget)
          .where(and(...conditions));

        budgets.forEach(item => assertBudgetReadScope(ctx, item));
        return { budgets, total: Number(countResult?.count || 0) };
      })
  );

  server.tool(
    "get_budget",
    "Get a single budget by ID with its fiscal year and each budget line (with its chart account and the per-period breakdown). Line totals and period amounts retain numeric integer cents and add canonical totalMinor/amountMinor strings. Unsafe stored amounts fail with 422.",
    {
      budgetId: z.string().describe("The UUID of the budget"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        return { budget: await getBudget(ctx, params.budgetId) };
      })
  );

  server.tool(
    "create_budget",
    "Create a budget, returning its header. Lines accept total (signed safe integer cents) or totalMinor (canonical integer string); periods accept amount or amountMinor with exact agreement. Supported amounts/sums are +/-9007199254740991, at most 500 lines/10000 periods. Omitted amounts default to zero. Omit periods to distribute a total exactly. Explicit total retains precedence over period sum. All lines are validated before a transactional write.",
    budgetCreateSchema.shape,
    params => wrapTool(ctx, async () => ({ budget: await createBudget(ctx, params) })),
  );

  server.tool(
    "update_budget",
    "Update a budget, returning its header. Omitted lines stay unchanged; supplied lines replace all old lines/periods transactionally. total/totalMinor and amount/amountMinor are agreeing signed cents aliases, supported within +/-9007199254740991; max 500 lines/10000 periods. Omitted amounts default to zero. Explicit total retains precedence over period sum. Invalid aliases, sums or organization references fail before writes.",
    { budgetId: z.string().uuid().describe("UUID of this organization's budget"), ...budgetUpdateSchema.shape },
    params => wrapTool(ctx, async () => ({ budget: await updateBudget(ctx, params.budgetId, params) })),
  );

  server.tool(
    "delete_budget",
    "Soft-delete an organization-scoped budget. Retains its amounts and periods; returns {success:true}. Requires manage:budgets.",
    { budgetId: z.string().uuid().describe("UUID of this organization's budget to soft-delete") },
    params => wrapTool(ctx, async () => { await deleteBudget(ctx, params.budgetId); return { success: true }; }),
  );

  server.tool(
    "budget_vs_actual",
    "Compare a budget against posted organization-base GL activity, natural-signed (asset/expense debit minus credit; other types credit minus debit). Monetary outputs retain signed safe integer cents (+/-9007199254740991) and add agreeing Minor strings: budgeted, actual, variance, burnRate, projected, period values and total values. Returns currencyCode, budget, comparisons and UTC elapsed/remaining days. variancePct is an integer percent; burn projections and percentages round nearest with signed ties toward positive infinity. No FX conversion of already-base GL amounts. Omit budgetId for newest non-deleted budget, including inactive budgets; missing/foreign IDs return null budget and zero totals. Requires view:data. Unsupported amounts/history return 422 LEGACY_NUMERIC_RANGE.",
    budgetReportSchema.shape,
    params => wrapTool(ctx, () => getBudgetReport(ctx, params)),
  );
}
