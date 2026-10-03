import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quote, quoteLine, invoice, invoiceLine, organization, numberSequence } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { logAudit, diffChanges } from "./audit";
import { references, taxRates, prices, nextNumber } from "./invoice-writes";
import { publicLineDto } from "./public-money-wire";
import { stringifyWire } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { invoiceWriteDto } from "./invoice-write-wire";
import { quoteDto, quoteReadDto, quoteListSchema, quoteConvertSchema, quoteInputLines, quoteTotals,
  parseQuoteCreate, parseQuoteUpdate, quoteBilling, validateQuoteBalances } from "./quote-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = (ctx: AuthContext, id: string) => and(eq(quote.id, id), eq(quote.organizationId, ctx.organizationId), notDeleted(quote.deletedAt));
const fail = (message: string): never => { throw new AuthError(message, 400); };
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404); return org;
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const org = await lockOrg(tx, ctx);
  const [found] = await tx.select().from(quote).where(scope(ctx, id)).for("update");
  if (!found) throw new AuthError("Quote not found", 404);
  quoteDto(found); currencyCodeSchema.parse(found.currencyCode); rateDateSchema.parse(found.issueDate); rateDateSchema.parse(found.expiryDate);
  const lines = await tx.select().from(quoteLine).where(eq(quoteLine.quoteId, id)).orderBy(quoteLine.sortOrder, quoteLine.id);
  lines.forEach(publicLineDto); stringifyWire(lines);
  validateQuoteBalances(found, lines);
  const customer = await references(tx, ctx.organizationId, found.contactId,
    lines.map(line => ({ ...line, quantity: line.quantity / 100 })), true);
  return { found, org, lines, customer };
}
async function number(tx: Tx, orgId: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, orgId), eq(numberSequence.entityType, "quote"))).for("update");
  const [max] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${quote.quoteNumber}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(quote).where(eq(quote.organizationId, orgId));
  const value = BigInt(sequence?.lastNumber ?? max.value) + 1n;
  if (value > 2147483647n || value < 1n) fail("Quote numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: orgId, entityType: "quote", prefix: "QTE", lastNumber: Number(value) });
  return `QTE-${String(value).padStart(5, "0")}`;
}
export async function listQuotes(ctx: AuthContext, input: unknown) {
  const parsed = quoteListSchema.parse(input), conditions = and(eq(quote.organizationId, ctx.organizationId), notDeleted(quote.deletedAt),
    parsed.status ? eq(quote.status, parsed.status) : undefined);
  return db.transaction(async tx => {
    const rows = await tx.query.quote.findMany({ where: conditions, with: { contact: true }, orderBy: desc(quote.createdAt),
      limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit });
    const [count] = await tx.select({ value: sql<number>`count(*)`.mapWith(Number) }).from(quote).where(conditions);
    return { quotes: rows.map(row => quoteReadDto(row, ctx.organizationId)), total: count.value };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getQuote(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const row = await db.query.quote.findFirst({ where: scope(ctx, id), with: { contact: true, lines: { with: { account: true, taxRate: true } } } });
  if (!row) throw new AuthError("Quote not found", 404);
  return { quote: quoteReadDto(row, ctx.organizationId) };
}
export async function createQuote(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:invoices");
  const parsed = parseQuoteCreate(input, transport), lines = quoteInputLines(parsed.lines, transport);
  const result = await db.transaction(async tx => {
    const org = await lockOrg(tx, ctx);
    await references(tx, ctx.organizationId, parsed.contactId, [...lines, ...(parsed.priceListId ? [{ ...lines[0], priceListId: parsed.priceListId }] : [])]);
    await assertNotLocked(ctx.organizationId, parsed.issueDate);
    const fallback = await prices(tx, ctx.organizationId, org.defaultCurrency ?? "USD", parsed.currencyCode, parsed.issueDate, lines, parsed.priceListId);
    const totals = quoteTotals(lines, parsed.currencyCode, await taxRates(tx, lines), fallback);
    const [created] = await tx.insert(quote).values({ organizationId: ctx.organizationId, contactId: parsed.contactId,
      quoteNumber: await number(tx, ctx.organizationId), issueDate: parsed.issueDate, expiryDate: parsed.expiryDate,
      reference: parsed.reference || null, notes: parsed.notes || null, currencyCode: parsed.currencyCode,
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, createdBy: ctx.userId }).returning();
    await tx.insert(quoteLine).values(totals.processedLines.map(line => ({ ...line, quoteId: created.id })));
    return { quote: quoteDto(created) };
  });
  await logAudit({ ctx, action: "create", entityType: "quote", entityId: result.quote.id, request }); return result;
}
export async function updateQuote(ctx: AuthContext, id: string, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:invoices"); const parsed = parseQuoteUpdate(input, transport);
  const result = await db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== "draft") fail("Only draft quotes can be edited");
    await assertNotLocked(ctx.organizationId, found.issueDate); await assertNotLocked(ctx.organizationId, parsed.issueDate ?? found.issueDate);
    const contactId = parsed.contactId ?? found.contactId;
    if (parsed.contactId !== undefined) await references(tx, ctx.organizationId, contactId, []);
    const patch: Partial<typeof quote.$inferInsert> = { updatedAt: new Date() };
    for (const key of ["contactId", "issueDate", "expiryDate", "reference", "notes", "currencyCode"] as const)
      if (parsed[key] !== undefined) Object.assign(patch, { [key]: parsed[key] });
    if (parsed.lines) {
      const lines = quoteInputLines(parsed.lines, transport);
      if (lines.some(line => line.priceListId)) fail("Quote update requires explicit prices; price lookup is create-only");
      await references(tx, ctx.organizationId, contactId, lines);
      const totals = quoteTotals(lines, parsed.currencyCode ?? found.currencyCode, await taxRates(tx, lines));
      Object.assign(patch, { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total });
      await tx.delete(quoteLine).where(eq(quoteLine.quoteId, id));
      await tx.insert(quoteLine).values(totals.processedLines.map(line => ({ ...line, quoteId: id })));
    }
    const [updated] = await tx.update(quote).set(patch).where(scope(ctx, id)).returning();
    return { found, quote: quoteDto(updated) };
  });
  await logAudit({ ctx, action: "update", entityType: "quote", entityId: id, changes: diffChanges(result.found, result.quote), request });
  return { quote: result.quote };
}
export async function deleteQuote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const found = await db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== "draft") fail("Only draft quotes can be deleted"); await assertNotLocked(ctx.organizationId, found.issueDate);
    await tx.delete(quoteLine).where(eq(quoteLine.quoteId, id)); await tx.update(quote).set(softDelete()).where(scope(ctx, id)); return found;
  });
  await logAudit({ ctx, action: "delete", entityType: "quote", entityId: id, changes: found, request }); return { success: true };
}
async function transition(ctx: AuthContext, id: string, action: "send" | "accept" | "decline", request?: Request) {
  requireRole(ctx, "manage:invoices");
  const result = await db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== (action === "send" ? "draft" : "sent")) fail(`Quote cannot ${action} from its current status`);
    await assertNotLocked(ctx.organizationId, found.issueDate);
    if (action === "accept" && found.expiryDate < new Date().toISOString().slice(0, 10)) fail("This quote has expired");
    const [updated] = await tx.update(quote).set({ status: action === "send" ? "sent" : action === "accept" ? "accepted" : "declined",
      ...(action === "send" ? { sentAt: new Date() } : {}), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { quote: quoteDto(updated), previousStatus: found.status };
  });
  await logAudit({ ctx, action, entityType: "quote", entityId: id, changes: { previousStatus: result.previousStatus }, request });
  return { quote: result.quote };
}
export const sendQuote = (ctx: AuthContext, id: string, request?: Request) => transition(ctx, id, "send", request);
export const acceptQuote = (ctx: AuthContext, id: string, request?: Request) => transition(ctx, id, "accept", request);
export const declineQuote = (ctx: AuthContext, id: string, request?: Request) => transition(ctx, id, "decline", request);
export async function convertQuote(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "manage:invoices"); const parsed = quoteConvertSchema.parse(input);
  const result = await db.transaction(async tx => {
    const { found, lines, org, customer } = await load(tx, ctx, id);
    if (found.status !== "accepted") fail("Only accepted quotes can be converted to invoices");
    const today = new Date().toISOString().slice(0, 10);
    await assertNotLocked(ctx.organizationId, found.issueDate); await assertNotLocked(ctx.organizationId, today);
    const totals = quoteBilling(found, lines, parsed);
    const terms = customer.paymentTermsDays ?? (org.defaultPaymentTerms ? parseInt(org.defaultPaymentTerms) : 30);
    const due = new Date(`${today}T00:00:00Z`); due.setUTCDate(due.getUTCDate() + (terms || 30));
    if (!Number.isFinite(due.getTime())) fail("Invalid default payment terms");
    const dueDate = rateDateSchema.parse(due.toISOString().slice(0, 10));
    const [created] = await tx.insert(invoice).values({ organizationId: ctx.organizationId, contactId: found.contactId,
      invoiceNumber: await nextNumber(tx, ctx.organizationId), issueDate: today, dueDate, reference: found.reference, notes: found.notes,
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, amountPaid: 0, amountDue: totals.total,
      currencyCode: found.currencyCode, createdBy: ctx.userId }).returning();
    const nonzero = totals.billLines.filter(line => line.amount !== 0 || line.taxAmount !== 0);
    if (nonzero.length) await tx.insert(invoiceLine).values(nonzero.map(line => ({ ...line, invoiceId: created.id })));
    const [updated] = await tx.update(quote).set({ billedTotal: totals.billing.billedTotal,
      status: totals.billing.fullyBilled ? "converted" : "accepted", convertedInvoiceId: created.id, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    const result = { quote: quoteDto(updated), invoice: invoiceWriteDto(created), billing: totals.billing };
    stringifyWire(result); return result;
  });
  await logAudit({ ctx, action: "convert", entityType: "quote", entityId: id, changes: result.billing, request }); return result;
}
