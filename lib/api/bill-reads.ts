import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bill, organization } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { getRateStatus } from "@/lib/currency/rate-status";
import type { AuthContext } from "./auth-context";
import { billCountsDto, billListSchema, billReadDto } from "./bill-read-wire";
import { documentBaseDto } from "./document-base-wire";

export async function listBills(ctx: AuthContext, input: unknown) {
  const parsed = billListSchema.parse(input);
  const conditions = [eq(bill.organizationId, ctx.organizationId), notDeleted(bill.deletedAt)];
  if (parsed.status) conditions.push(eq(bill.status, parsed.status));
  return db.transaction(async tx => {
    const rows = await tx.query.bill.findMany({ where: and(...conditions),
      orderBy: [desc(bill.createdAt), desc(bill.id)], limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit,
      with: { contact: true } });
    const [result] = await tx.select({ count: count() }).from(bill).where(and(...conditions));
    return { bills: rows.map(row => billReadDto(row, ctx.organizationId)), total: result.count,
      page: parsed.page, limit: parsed.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** REST and MCP both retain {bill, base}, with explicit issue-date display FX. */
export async function getBill(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const found = await db.query.bill.findFirst({ where: and(eq(bill.id, id),
    eq(bill.organizationId, ctx.organizationId), notDeleted(bill.deletedAt)),
    with: { contact: true, lines: { with: { account: true, taxRate: true } } } });
  if (!found) return null;
  const dto = billReadDto(found, ctx.organizationId);
  const org = await db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId),
    columns: { defaultCurrency: true } });
  const baseCurrency = org?.defaultCurrency ?? "USD";
  const status = await getRateStatus(ctx.organizationId, found.currencyCode, baseCurrency, found.issueDate);
  const base = documentBaseDto(found.currencyCode, baseCurrency, { subtotal: found.subtotal, taxTotal: found.taxTotal,
    total: found.total, amountDue: found.amountDue, amountPaid: found.amountPaid }, status);
  return { bill: dto, base };
}

export async function getBillCounts(ctx: AuthContext) {
  const rows = await db.select({ status: bill.status, count: count(),
    amount: sql<string>`sum(${bill.amountDue})::text`,
    minAmount: sql<string>`min(${bill.amountDue})::text`, maxAmount: sql<string>`max(${bill.amountDue})::text`,
    currencyCount: sql<number>`count(distinct ${bill.currencyCode})`.mapWith(Number),
    currencyCode: sql<string>`min(${bill.currencyCode})` })
    .from(bill).where(and(eq(bill.organizationId, ctx.organizationId), notDeleted(bill.deletedAt))).groupBy(bill.status);
  return billCountsDto(rows);
}
