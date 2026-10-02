import { jsonResponse } from "@/lib/api/json-response";
import { createBudget, assertBudgetReadScope } from "@/lib/api/budget-write";
import { db } from "@/lib/db";
import { budget } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { notDeleted } from "@/lib/db/soft-delete";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url);

    const conditions = [
      eq(budget.organizationId, ctx.organizationId),
      notDeleted(budget.deletedAt),
    ];

    const budgets = await db.query.budget.findMany({
      where: and(...conditions),
      orderBy: desc(budget.createdAt),
      limit,
      offset,
      with: { fiscalYear: true },
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(budget)
      .where(and(...conditions));

    budgets.forEach(item => assertBudgetReadScope(ctx, item));
    return jsonResponse(
      paginatedResponse(budgets, Number(countResult?.count || 0), page, limit)
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const created = await createBudget(ctx, await request.json(), request);
    return jsonResponse({ budget: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
