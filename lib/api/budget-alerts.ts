import { db } from "@/lib/db";
import { budget, budgetLine, budgetPeriod, journalLine, journalEntry, member, notification } from "@/lib/db/schema";
import { eq, and, sql, gte, lte, inArray, isNull, asc } from "drizzle-orm";
import { deliverNotificationEmail, type SendNotificationParams } from "@/lib/notifications/send";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertBudgetReadScope } from "./budget-write";
import { budgetReportDates, budgetReportStoredAmount } from "./budget-report-wire";
import { budgetAlertAmounts, budgetAlertBody, budgetAlertSchema } from "./budget-alert-wire";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";

async function runBudgetAlerts(organizationId?: string, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new WireCompatibilityError("Invalid budget alert clock");
  const today = now.toISOString().slice(0, 10);
  const result = await db.transaction(async tx => {
    // All scheduled and scoped callers share this lock. READ COMMITTED reads after
    // acquisition see a previous caller's inserts, avoiding repeatable-read races.
    await tx.execute(sql`select pg_advisory_xact_lock(123, 105)`);
    const budgets = await tx.query.budget.findMany({
      where: and(eq(budget.isActive, true), isNull(budget.deletedAt),
        sql`${budget.varianceThresholdPct} IS NOT NULL`,
        organizationId ? eq(budget.organizationId, organizationId) : undefined),
      orderBy: asc(budget.id),
      with: { organization: true, fiscalYear: true, lines: { orderBy: asc(budgetLine.id),
        with: { account: true, periods: { orderBy: [asc(budgetPeriod.sortOrder), asc(budgetPeriod.id)] } } } },
    });
    const evaluations: ({ budgetId: string; accountId: string; periodId: string } & ReturnType<typeof budgetAlertAmounts>)[] = [];
    const pending: SendNotificationParams[] = [];
    let checked = 0;
    for (const b of budgets) {
      assertBudgetReadScope({ organizationId: b.organizationId } as AuthContext, b);
      if (!b.organization || (b.fiscalYearId && !b.fiscalYear)
        || b.fiscalYear?.deletedAt || b.lines.some(line => !line.account || line.account.deletedAt)) {
        throw new AuthError("Budget reference not found in this organization", 404);
      }
      if (b.lines.length > 500 || b.lines.reduce((n, line) => n + line.periods.length, 0) > 10000) {
        throw new WireCompatibilityError("Budget alerts support at most 500 lines and 10000 periods per budget");
      }
      budgetReportDates(b.startDate, b.endDate, now);
      // Validate stored configuration even for a budget with no current periods.
      budgetAlertAmounts(0, 0n, b.varianceThresholdPct!, b.organization.defaultCurrency);
      const admins = await tx.query.member.findMany({ where: and(eq(member.organizationId, b.organizationId),
        inArray(member.role, ["owner", "admin"])) });
      const userIds = [...new Set(admins.map(admin => admin.userId))];
      for (const line of b.lines) {
        budgetReportStoredAmount(line.total);
        for (const period of line.periods) {
          budgetReportStoredAmount(period.amount);
          budgetReportDates(period.startDate, period.endDate, now);
          if (period.startDate > today || period.endDate < today) continue;
          checked++;
          const [actual] = await tx.select({
            total: sql<string>`coalesce(sum(${journalLine.debitAmount}) - sum(${journalLine.creditAmount}), 0)::text`,
          }).from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
            .where(and(eq(journalEntry.organizationId, b.organizationId), eq(journalEntry.status, "posted"),
              isNull(journalEntry.deletedAt), eq(journalLine.accountId, line.accountId),
              gte(journalEntry.date, period.startDate), lte(journalEntry.date, period.endDate)));
          const amounts = budgetAlertAmounts(period.amount, BigInt(actual?.total ?? "0"), b.varianceThresholdPct!, b.organization.defaultCurrency);
          evaluations.push({ budgetId: b.id, accountId: line.accountId, periodId: period.id, ...amounts });
          if (!amounts.exceedsThreshold) continue;
          const body = budgetAlertBody(period.label, amounts);
          for (const userId of userIds) {
            const exists = await tx.query.notification.findFirst({ where: and(
              eq(notification.organizationId, b.organizationId), eq(notification.userId, userId),
              eq(notification.type, "budget_exceeded"), eq(notification.entityType, "budget_period"),
              eq(notification.entityId, period.id), eq(notification.channel, "in_app")) });
            if (exists) continue;
            pending.push({ orgId: b.organizationId, userId, type: "budget_exceeded",
              title: `Budget "${b.name}" exceeded threshold`, body, entityType: "budget_period", entityId: period.id });
          }
        }
      }
    }
    // Preflight the entire selected slice before any notification/digest mutation.
    stringifyWire({ checked, alerted: pending.length, evaluations, pending });
    const deliveries = [];
    for (const params of pending) {
      const [created] = await tx.insert(notification).values({ organizationId: params.orgId, userId: params.userId,
        type: params.type, title: params.title, body: params.body, entityType: params.entityType,
        entityId: params.entityId, channel: "in_app" }).returning({ id: notification.id });
      deliveries.push({ params, created });
    }
    return { checked, alerted: deliveries.length, evaluations, deliveries };
  }, { isolationLevel: "read committed" });
  // Delivery failures do not erase committed alerts or cause duplicates on retry.
  for (const { params, created } of result.deliveries) {
    try { await deliverNotificationEmail(params, created); } catch { /* Best-effort email/digest delivery. */ }
  }
  return { checked: result.checked, alerted: result.alerted, evaluations: result.evaluations };
}

/** Internal scheduled worker only: all organizations, count-only legacy envelope. */
export async function checkBudgetVariances(): Promise<{ checked: number; alerted: number }> {
  const { checked, alerted } = await runBudgetAlerts();
  return { checked, alerted };
}

/** Public REST/MCP operation: no caller-selected tenant or clock. */
export async function checkBudgetAlerts(ctx: AuthContext, input: unknown, now = new Date()) {
  requireRole(ctx, "manage:budgets");
  budgetAlertSchema.parse(input);
  return runBudgetAlerts(ctx.organizationId, now);
}
