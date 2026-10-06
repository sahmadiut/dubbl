import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, notFound } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { previewRecurringInvoice } from "@/lib/api/recurring-invoice";
import { previewRecurringPayable } from "@/lib/api/recurring-payable";

async function target(org: string, id: string) {
  z.string().uuid().parse(id);
  return db.query.recurringTemplate.findFirst({ where: and(eq(recurringTemplate.id, id), eq(recurringTemplate.organizationId, org),
    inArray(recurringTemplate.type, ["invoice", "bill", "expense"]), notDeleted(recurringTemplate.deletedAt)) });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const ctx = await getAuthContext(request);
    const count = Number(new URL(request.url).searchParams.get("count") ?? "5");
    const row = await target(ctx.organizationId, id); if (!row) return notFound("Recurring template");
    return jsonResponse(row.type === "invoice" ? await previewRecurringInvoice(ctx, id, count) : await previewRecurringPayable(ctx, id, count));
  } catch (err) { return handleError(err); }
}
