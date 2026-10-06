import { createRecurringPayable, getRecurringPayable } from "@/lib/api/recurring-payable";
import { readRecurringInvoiceJson } from "@/lib/api/recurring-invoice-wire";
import { createRecurringInvoice, getRecurringInvoice } from "@/lib/api/recurring-invoice";
import { jsonResponse } from "@/lib/api/json-response";
import { db } from "@/lib/db";
import { recurringTemplate } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { notDeleted } from "@/lib/db/soft-delete";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SORT_COLUMNS: Record<string, any> = {
  created: recurringTemplate.createdAt,
  name: recurringTemplate.name,
  frequency: recurringTemplate.frequency,
  nextRun: recurringTemplate.nextRunDate,
  startDate: recurringTemplate.startDate,
};

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const frequency = url.searchParams.get("frequency");
    const sortBy = url.searchParams.get("sortBy") || "created";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    const conditions = [
      eq(recurringTemplate.organizationId, ctx.organizationId),
      notDeleted(recurringTemplate.deletedAt),
    ];

    if (type && ["invoice", "bill", "expense"].includes(type)) {
      conditions.push(eq(recurringTemplate.type, type));
    }
    if (status && ["active", "paused", "completed"].includes(status)) {
      conditions.push(eq(recurringTemplate.status, status as "active" | "paused" | "completed"));
    }
    if (frequency && ["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"].includes(frequency)) {
      conditions.push(eq(recurringTemplate.frequency, frequency as typeof recurringTemplate.frequency.enumValues[number]));
    }

    const sortCol = SORT_COLUMNS[sortBy] || recurringTemplate.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const templates = await db.query.recurringTemplate.findMany({
      where: and(...conditions),
      orderBy: orderFn(sortCol),
      limit,
      offset,
      with: { contact: true },
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(recurringTemplate)
      .where(and(...conditions));

    const safeTemplates = await Promise.all(templates.map(row => row.type === "invoice" ? getRecurringInvoice(ctx, row.id) : ["bill", "expense"].includes(row.type) ? getRecurringPayable(ctx, row.id) : row));
    return jsonResponse(
      paginatedResponse(safeTemplates, Number(countResult?.count || 0), page, limit)
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:recurring");

    const body = await readRecurringInvoiceJson(request);
    if (body?.type === "invoice") {
      const input = { ...body }; delete input.type;
      return jsonResponse(await createRecurringInvoice(ctx, input, request, "recurring_template"), { status: 201 });
    }
    return jsonResponse(await createRecurringPayable(ctx, body, request), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
