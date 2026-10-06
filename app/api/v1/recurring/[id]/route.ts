import { z } from "zod";
import { db } from "@/lib/db";
import { recurringTemplate } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readRecurringInvoiceJson } from "@/lib/api/recurring-invoice-wire";
import { getRecurringInvoice, changeRecurringInvoice } from "@/lib/api/recurring-invoice";
import { getRecurringPayable, changeRecurringPayable } from "@/lib/api/recurring-payable";

async function target(org: string, id: string) {
  z.string().uuid().parse(id);
  return db.query.recurringTemplate.findFirst({ where: and(eq(recurringTemplate.id, id), eq(recurringTemplate.organizationId, org),
    inArray(recurringTemplate.type, ["invoice", "bill", "expense"]), notDeleted(recurringTemplate.deletedAt)) });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const ctx = await getAuthContext(request);
    const row = await target(ctx.organizationId, id); if (!row) return notFound("Recurring template");
    return jsonResponse({ template: row.type === "invoice" ? await getRecurringInvoice(ctx, id) : await getRecurringPayable(ctx, id) });
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:recurring");
    const row = await target(ctx.organizationId, id); if (!row) return notFound("Recurring template");
    const input = await readRecurringInvoiceJson(request);
    return jsonResponse(row.type === "invoice" ? await changeRecurringInvoice(ctx, id, input, request, "update", "recurring_template") : await changeRecurringPayable(ctx, id, input, request, "update"));
  } catch (err) { return handleError(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:recurring");
    const row = await target(ctx.organizationId, id); if (!row) return notFound("Recurring template");
    const input = {};
    return jsonResponse(row.type === "invoice" ? await changeRecurringInvoice(ctx, id, input, request, "delete", "recurring_template") : await changeRecurringPayable(ctx, id, input, request, "delete"));
  } catch (err) { return handleError(err); }
}
