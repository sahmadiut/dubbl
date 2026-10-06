import { db } from "@/lib/db";
import { budget, budgetLine, budgetPeriod, journalEntry, journalLine, organization } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertBudgetReadScope } from "./budget-write";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { safeBudgetMinor } from "./budget-wire";
import { budgetReportSchema, budgetReportActual, budgetReportCurrency, budgetReportDates,
  budgetReportMoney, budgetReportRound, budgetReportStoredAmount, type BudgetReportActual } from "./budget-report-wire";

/** Read-only snapshot: header, periods and posted base-currency GL activity agree. */
export async function getBudgetReport(ctx: AuthContext, input: unknown, now = new Date()) {
  requireRole(ctx, "view:data");
  const { budgetId } = budgetReportSchema.parse(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) });
    if (!org) throw new AuthError("Organization not found", 404);
    const currencyCode = budgetReportCurrency(org.defaultCurrency);
    const found = await tx.query.budget.findFirst({
      where: and(eq(budget.organizationId, ctx.organizationId), isNull(budget.deletedAt),
        budgetId ? eq(budget.id, budgetId) : undefined),
      orderBy: [desc(budget.createdAt), desc(budget.id)],
      with: { fiscalYear: true, lines: { orderBy: asc(budgetLine.id), with: { account: true,
        periods: { orderBy: [asc(budgetPeriod.sortOrder), asc(budgetPeriod.id)] } } } },
    });
    if (!found) return { currencyCode, budget: null, comparisons: [],
      ...budgetReportMoney({ totalBudgeted: 0n, totalActual: 0n, totalVariance: 0n, totalBurnRate: 0n }),
      daysElapsed: 0, daysRemaining: 0, totalDays: 0 };
    assertBudgetReadScope(ctx, found);
    if ((found.fiscalYearId && !found.fiscalYear) || found.lines.some(line => !line.account)) {
      throw new AuthError("Budget reference not found in this organization", 404);
    }
    if (found.lines.length > 500 || found.lines.reduce((n, line) => n + line.periods.length, 0) > 10000) {
      throw new WireCompatibilityError("Budget report supports at most 500 lines and 10000 periods");
    }
    const days = budgetReportDates(found.startDate, found.endDate, now);
    for (const line of found.lines) {
      budgetReportStoredAmount(line.total);
      for (const period of line.periods) {
        budgetReportStoredAmount(period.amount);
        budgetReportDates(period.startDate, period.endDate, now);
      }
    }
    const posted = and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"),
      isNull(journalEntry.deletedAt));
    // SUM(bigint) returns numeric. Text avoids driver Number conversion or narrowing.
    const sums = { debit: sql<string>`coalesce(sum(${journalLine.debitAmount}), 0)::text`,
      credit: sql<string>`coalesce(sum(${journalLine.creditAmount}), 0)::text` };
    const actuals = found.lines.length ? await tx.select({ accountId: journalLine.accountId, ...sums })
      .from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
      .where(and(posted, inArray(journalLine.accountId, found.lines.map(line => line.accountId)),
        gte(journalEntry.date, found.startDate), lte(journalEntry.date, found.endDate)))
      .groupBy(journalLine.accountId) : [];
    const actualMap = new Map<string, BudgetReportActual>(actuals.map(row => [row.accountId,
      { debit: BigInt(row.debit), credit: BigInt(row.credit) }]));
    // A single query includes arbitrary/overlapping explicit periods. Unposted,
    // deleted and foreign entries are excluded. GL is already in base currency.
    const periodActuals = found.lines.some(line => line.periods.length) ? await tx.select({ periodId: budgetPeriod.id, ...sums })
      .from(budgetPeriod).innerJoin(budgetLine, eq(budgetPeriod.budgetLineId, budgetLine.id))
      .innerJoin(journalLine, eq(journalLine.accountId, budgetLine.accountId))
      .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
      .where(and(eq(budgetLine.budgetId, found.id), posted,
        sql`${journalEntry.date} >= ${budgetPeriod.startDate}::date`,
        sql`${journalEntry.date} <= ${budgetPeriod.endDate}::date`)).groupBy(budgetPeriod.id) : [];
    const periodMap = new Map<string, BudgetReportActual>(periodActuals.map(row => [row.periodId,
      { debit: BigInt(row.debit), credit: BigInt(row.credit) }]));
    const project = (amount: bigint) => days.daysElapsed ? budgetReportRound(amount * BigInt(days.totalDays), BigInt(days.daysElapsed)) : 0n;
    let totalBudgeted = 0n, totalActual = 0n;
    const comparisons = found.lines.map(line => {
      const account = line.account!;
      const budgeted = budgetReportStoredAmount(line.total), actual = budgetReportActual(account.type, actualMap.get(line.accountId));
      const variance = budgeted - actual, burnRate = project(actual);
      totalBudgeted += budgeted; totalActual += actual;
      return { accountId: line.accountId, accountName: account.name, accountCode: account.code,
        ...budgetReportMoney({ budgeted, actual, variance, burnRate, projected: burnRate }),
        variancePct: budgeted === 0n ? 0 : safeBudgetMinor(budgetReportRound(variance * 100n, budgeted)),
        periods: line.periods.map(period => {
          const budgeted = budgetReportStoredAmount(period.amount), actual = budgetReportActual(account.type, periodMap.get(period.id));
          return { id: period.id, label: period.label, startDate: period.startDate, endDate: period.endDate,
            sortOrder: period.sortOrder, ...budgetReportMoney({ budgeted, actual, variance: budgeted - actual }) };
        }),
      };
    });
    const result = { currencyCode, budget: { id: found.id, name: found.name, startDate: found.startDate,
      endDate: found.endDate, periodType: found.periodType }, comparisons, ...days,
      ...budgetReportMoney({ totalBudgeted, totalActual, totalVariance: totalBudgeted - totalActual, totalBurnRate: project(totalActual) }) };
    stringifyWire(result);
    return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
