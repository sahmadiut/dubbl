import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { budget, journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and, desc, sql, isNull, gte, lte } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { budgetCreateSchema, budgetUpdateSchema } from "@/lib/api/budget-wire";
import { createBudget, updateBudget, deleteBudget, getBudget, assertBudgetReadScope } from "@/lib/api/budget-write";
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
    "Budget-vs-actual report for one budget. For each budget line it compares the budgeted amount against actual posted general-ledger activity for that account within the budget's date range, with a per-period breakdown, variance (budgeted − actual), variance percent, and a burn-rate projection (actual / days elapsed × total days). Actuals are natural-signed by account type (expense/asset = debit − credit; otherwise credit − debit). All amounts are in integer cents. Pass budgetId to target a specific budget; if omitted the most recent non-deleted budget is used. Returns null budget and zeroed totals when no budget exists.",
    {
      budgetId: z
        .string()
        .optional()
        .describe("UUID of the budget to report on. Omit to use the most recent non-deleted budget."),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const found = await db.query.budget.findFirst({
          where: params.budgetId
            ? and(
                eq(budget.id, params.budgetId),
                eq(budget.organizationId, ctx.organizationId),
                isNull(budget.deletedAt)
              )
            : and(eq(budget.organizationId, ctx.organizationId), isNull(budget.deletedAt)),
          with: {
            lines: {
              with: {
                account: true,
                periods: true,
              },
            },
          },
        });

        if (!found) {
          return {
            budget: null,
            comparisons: [],
            totalBudgeted: 0,
            totalActual: 0,
            totalVariance: 0,
            totalBurnRate: 0,
            daysElapsed: 0,
            daysRemaining: 0,
            totalDays: 0,
          };
        }

        // Actual GL balances per account across the budget's full date range.
        const actuals = await db
          .select({
            accountId: journalLine.accountId,
            debit: sql<number>`COALESCE(SUM(${journalLine.debitAmount}), 0)`.as("debit"),
            credit: sql<number>`COALESCE(SUM(${journalLine.creditAmount}), 0)`.as("credit"),
          })
          .from(journalLine)
          .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
          .where(
            and(
              eq(journalEntry.organizationId, ctx.organizationId),
              eq(journalEntry.status, "posted"),
              isNull(journalEntry.deletedAt),
              gte(journalEntry.date, found.startDate),
              lte(journalEntry.date, found.endDate)
            )
          )
          .groupBy(journalLine.accountId);

        const actualMap = new Map<string, { debit: number; credit: number }>();
        for (const row of actuals) {
          actualMap.set(row.accountId, {
            debit: Number(row.debit),
            credit: Number(row.credit),
          });
        }

        // Per-period actuals, fetched once per unique date range.
        const allPeriods = found.lines.flatMap((l) =>
          (l.periods || []).map((p) => ({
            accountId: l.accountId,
            periodId: p.id,
            startDate: p.startDate,
            endDate: p.endDate,
          }))
        );

        const periodActualMap = new Map<string, { debit: number; credit: number }>();

        if (allPeriods.length > 0) {
          const uniqueDateRanges = new Map<string, { startDate: string; endDate: string }>();
          for (const p of allPeriods) {
            uniqueDateRanges.set(`${p.startDate}_${p.endDate}`, {
              startDate: p.startDate,
              endDate: p.endDate,
            });
          }

          for (const range of uniqueDateRanges.values()) {
            const periodActuals = await db
              .select({
                accountId: journalLine.accountId,
                debit: sql<number>`COALESCE(SUM(${journalLine.debitAmount}), 0)`.as("debit"),
                credit: sql<number>`COALESCE(SUM(${journalLine.creditAmount}), 0)`.as("credit"),
              })
              .from(journalLine)
              .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
              .where(
                and(
                  eq(journalEntry.organizationId, ctx.organizationId),
                  eq(journalEntry.status, "posted"),
                  isNull(journalEntry.deletedAt),
                  gte(journalEntry.date, range.startDate),
                  lte(journalEntry.date, range.endDate)
                )
              )
              .groupBy(journalLine.accountId);

            for (const pa of periodActuals) {
              const key = `${pa.accountId}_${range.startDate}_${range.endDate}`;
              periodActualMap.set(key, {
                debit: Number(pa.debit),
                credit: Number(pa.credit),
              });
            }
          }
        }

        // Days, for burn-rate projection.
        const startMs = new Date(found.startDate + "T00:00:00").getTime();
        const endMs = new Date(found.endDate + "T00:00:00").getTime();
        const nowMs = Date.now();
        const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
        const daysElapsed = Math.max(
          0,
          Math.min(totalDays, Math.round((nowMs - startMs) / 86400000))
        );
        const daysRemaining = Math.max(0, totalDays - daysElapsed);

        function computeActual(
          accountType: string | undefined,
          actData: { debit: number; credit: number } | undefined
        ): number {
          if (!actData) return 0;
          if (accountType === "expense" || accountType === "asset") {
            return actData.debit - actData.credit;
          }
          return actData.credit - actData.debit;
        }

        const comparisons = found.lines.map((line) => {
          const act = actualMap.get(line.accountId);
          const accountType = line.account?.type;
          const actualAmount = computeActual(accountType, act);
          const budgeted = line.total;
          const variance = budgeted - actualAmount;
          const variancePct = budgeted === 0 ? 0 : Math.round((variance / budgeted) * 100);

          const sortedPeriods = [...(line.periods || [])].sort((a, b) => a.sortOrder - b.sortOrder);
          const periodBreakdown = sortedPeriods.map((p) => {
            const key = `${line.accountId}_${p.startDate}_${p.endDate}`;
            const pAct = periodActualMap.get(key);
            const periodActual = computeActual(accountType, pAct);
            return {
              id: p.id,
              label: p.label,
              startDate: p.startDate,
              endDate: p.endDate,
              budgeted: p.amount,
              actual: periodActual,
              variance: p.amount - periodActual,
              sortOrder: p.sortOrder,
            };
          });

          const burnRate =
            daysElapsed > 0 ? Math.round((actualAmount / daysElapsed) * totalDays) : 0;

          return {
            accountId: line.accountId,
            accountName: line.account?.name || "Unknown",
            accountCode: line.account?.code || "",
            budgeted,
            actual: actualAmount,
            variance,
            variancePct,
            burnRate,
            projected: burnRate,
            periods: periodBreakdown,
          };
        });

        const totalBudgeted = comparisons.reduce((s, c) => s + c.budgeted, 0);
        const totalActual = comparisons.reduce((s, c) => s + c.actual, 0);
        const totalVariance = totalBudgeted - totalActual;
        const totalBurnRate =
          daysElapsed > 0 ? Math.round((totalActual / daysElapsed) * totalDays) : 0;

        return {
          budget: {
            id: found.id,
            name: found.name,
            startDate: found.startDate,
            endDate: found.endDate,
            periodType: found.periodType,
          },
          comparisons,
          totalBudgeted,
          totalActual,
          totalVariance,
          totalBurnRate,
          daysElapsed,
          daysRemaining,
          totalDays,
        };
      })
  );
}
