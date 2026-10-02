import { db } from "@/lib/db";
import { budget, budgetLine, budgetPeriod, chartAccount, fiscalYear } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { logAudit, diffChanges } from "./audit";
import { budgetCreateSchema, budgetUpdateSchema, prepareBudgetLines, validateBudgetDates } from "./budget-wire";
import type { PeriodType } from "@/lib/budget-periods";
import { budgetDto } from "./budget-wire";

type PreparedLines = ReturnType<typeof prepareBudgetLines>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function assertBudgetReadScope(ctx: AuthContext, value: {
  fiscalYear?: { organizationId: string } | null;
  lines?: { account: { organizationId: string } | null }[];
}) {
  if ((value.fiscalYear && value.fiscalYear.organizationId !== ctx.organizationId)
    || value.lines?.some(line => line.account && line.account.organizationId !== ctx.organizationId)) {
    throw new AuthError("Budget reference not found in this organization", 404);
  }
}

export async function getBudget(ctx: AuthContext, id: string) {
  const found = await db.query.budget.findFirst({ where: and(eq(budget.id, id),
    eq(budget.organizationId, ctx.organizationId), notDeleted(budget.deletedAt)),
    with: { fiscalYear: true, lines: { with: { account: true, periods: true } } },
  });
  if (!found) throw new AuthError("Budget not found", 404);
  assertBudgetReadScope(ctx, found);
  return budgetDto(found);
}

async function validateReferences(ctx: AuthContext, fiscalYearId: string | null | undefined, lines?: PreparedLines) {
  if (fiscalYearId) {
    const found = await db.query.fiscalYear.findFirst({ where: and(eq(fiscalYear.id, fiscalYearId),
      eq(fiscalYear.organizationId, ctx.organizationId), notDeleted(fiscalYear.deletedAt)) });
    if (!found) throw new AuthError("Fiscal year not found in this organization", 404);
  }
  const ids = [...new Set(lines?.map(line => line.accountId) ?? [])];
  if (ids.length) {
    const accounts = await db.select({ id: chartAccount.id }).from(chartAccount).where(and(
      inArray(chartAccount.id, ids), eq(chartAccount.organizationId, ctx.organizationId), notDeleted(chartAccount.deletedAt),
    ));
    if (accounts.length !== ids.length) throw new AuthError("Budget account not found in this organization", 404);
  }
}

async function insertLines(tx: Tx, id: string, lines: PreparedLines) {
  for (const line of lines) {
    const [saved] = await tx.insert(budgetLine).values({ budgetId: id, accountId: line.accountId, total: line.total }).returning();
    if (line.periods.length) await tx.insert(budgetPeriod).values(line.periods.map(period => ({ ...period, budgetLineId: saved.id })));
  }
}

export async function createBudget(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:budgets");
  const { lines, ...fields } = budgetCreateSchema.parse(input);
  const prepared = prepareBudgetLines(lines, fields.periodType, fields.startDate, fields.endDate);
  await validateReferences(ctx, fields.fiscalYearId, prepared);
  const saved = await db.transaction(async tx => {
    const [created] = await tx.insert(budget).values({ ...fields, organizationId: ctx.organizationId }).returning();
    await insertLines(tx, created.id, prepared);
    return created;
  });
  await logAudit({ ctx, action: "create", entityType: "budget", entityId: saved.id, request });
  return saved;
}

export async function updateBudget(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:budgets");
  const { lines, ...fields } = budgetUpdateSchema.parse(input);
  const existing = await db.query.budget.findFirst({ where: and(eq(budget.id, id),
    eq(budget.organizationId, ctx.organizationId), notDeleted(budget.deletedAt)),
    with: { lines: { with: { periods: true } } },
  });
  if (!existing) throw new AuthError("Budget not found", 404);
  const start = fields.startDate ?? existing.startDate, end = fields.endDate ?? existing.endDate;
  validateBudgetDates(start, end);
  const prepared = lines === undefined ? undefined : prepareBudgetLines(lines,
    (fields.periodType ?? existing.periodType) as PeriodType, start, end);
  await validateReferences(ctx, fields.fiscalYearId === undefined ? existing.fiscalYearId : fields.fiscalYearId, prepared);
  const saved = await db.transaction(async tx => {
    const [updated] = await tx.update(budget).set({ ...fields, updatedAt: new Date() }).where(and(
      eq(budget.id, id), eq(budget.organizationId, ctx.organizationId), notDeleted(budget.deletedAt),
    )).returning();
    if (!updated) throw new AuthError("Budget not found", 404);
    if (prepared !== undefined) {
      await tx.delete(budgetLine).where(eq(budgetLine.budgetId, id));
      await insertLines(tx, id, prepared);
    }
    return updated;
  });
  // Exclude eager lines from header diff; record replacement separately.
  const { lines: oldLines, ...oldHeader } = existing;
  await logAudit({ ctx, action: "update", entityType: "budget", entityId: id,
    changes: { ...diffChanges(oldHeader, saved), ...(prepared !== undefined && { linesReplaced: { from: oldLines.length, to: prepared.length } }) }, request });
  return saved;
}

export async function deleteBudget(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:budgets");
  const existing = await db.query.budget.findFirst({ where: and(eq(budget.id, id),
    eq(budget.organizationId, ctx.organizationId), notDeleted(budget.deletedAt)),
    with: { lines: { with: { periods: true } } },
  });
  if (!existing) throw new AuthError("Budget not found", 404);
  const [deleted] = await db.update(budget).set(softDelete()).where(and(eq(budget.id, id),
    eq(budget.organizationId, ctx.organizationId), notDeleted(budget.deletedAt))).returning();
  if (!deleted) throw new AuthError("Budget not found", 404);
  const { lines, ...header } = existing;
  void lines;
  await logAudit({ ctx, action: "delete", entityType: "budget", entityId: id, changes: header, request });
}
