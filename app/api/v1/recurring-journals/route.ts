import { jsonResponse } from "@/lib/api/json-response";
import { db } from "@/lib/db";
import { recurringTemplate } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { notDeleted } from "@/lib/db/soft-delete";
import { parsePagination, paginatedResponse } from "@/lib/api/pagination";
import { createRecurringJournal } from "@/lib/api/recurring-journal";
import { recurringJournalDto } from "@/lib/api/recurring-journal-wire";
import { assertJournalReferences } from "@/lib/api/journal-references";

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
    const status = url.searchParams.get("status");
    const frequency = url.searchParams.get("frequency");
    const sortBy = url.searchParams.get("sortBy") || "created";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    const conditions = [
      eq(recurringTemplate.organizationId, ctx.organizationId),
      eq(recurringTemplate.type, "journal"),
      notDeleted(recurringTemplate.deletedAt),
    ];

    if (status && ["active", "paused", "completed"].includes(status)) {
      conditions.push(
        eq(recurringTemplate.status, status as "active" | "paused" | "completed")
      );
    }
    if (
      frequency &&
      ["weekly", "fortnightly", "monthly", "quarterly", "semi_annual", "annual"].includes(frequency)
    ) {
      conditions.push(
        eq(recurringTemplate.frequency, frequency as typeof recurringTemplate.frequency.enumValues[number])
      );
    }

    const sortCol = SORT_COLUMNS[sortBy] || recurringTemplate.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const templates = await db.query.recurringTemplate.findMany({
      where: and(...conditions),
      orderBy: orderFn(sortCol),
      limit,
      offset,
      with: { lines: true },
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(recurringTemplate)
      .where(and(...conditions));

    for (const template of templates) await assertJournalReferences(ctx.organizationId, template.lines.map(line => ({ accountId: line.accountId ?? undefined, costCenterId: line.costCenterId })), undefined, true);
    return jsonResponse(
      paginatedResponse(templates.map(template => recurringJournalDto(template)), Number(countResult?.count || 0), page, limit)
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await createRecurringJournal(ctx, await request.json(), request), { status: 201 });
  } catch (err) { return handleError(err); }
}
