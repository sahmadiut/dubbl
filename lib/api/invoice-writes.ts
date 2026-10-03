import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoice, invoiceLine, contact, organization, chartAccount, taxRate, costCenter, project,
  inventoryItem, warehouse, priceList, priceListItem, customerCredit, numberSequence, member, approvalRequest } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { checkMonthlyLimit, checkMultiCurrency } from "./check-limit";
import { checkApprovalRequired } from "@/lib/approvals/engine";
import { logAudit, diffChanges } from "./audit";
import { publicMoneyDto, publicLineDto } from "./public-money-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { invoiceCreateSchema, invoiceUpdateSchema, invoiceWriteTotals, invoiceWriteDto, invoiceInputError,
  safeInvoiceMinor, hasInvoicePrice, type InvoiceWriteLine } from "./invoice-write-wire";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
function scope(id: string, orgId: string) {
  return and(eq(invoice.id, id), eq(invoice.organizationId, orgId), notDeleted(invoice.deletedAt));
}

/** Lock validated references until commit; retained history may be inactive but must be owned. */
async function references(tx: Transaction, orgId: string, contactId: string, lines: InvoiceWriteLine[], historical = false) {
  const [customer] = await tx.select().from(contact).where(and(eq(contact.id, contactId),
    eq(contact.organizationId, orgId), historical ? undefined : notDeleted(contact.deletedAt))).for("share");
  if (!customer) invoiceInputError("Invoice contact must belong to this organization and be available");
  const groups = [
    ["accountId", chartAccount], ["taxRateId", taxRate], ["costCenterId", costCenter],
    ["projectId", project], ["inventoryItemId", inventoryItem], ["warehouseId", warehouse], ["priceListId", priceList],
  ] as const;
  for (const [key, table] of groups) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, orgId), inArray(table.id, ids),
      historical ? undefined : notDeleted(table.deletedAt),
      historical || key === "priceListId" || !("isActive" in table) ? undefined : eq(table.isActive, true))).for("share");
    if (rows.length !== ids.length) invoiceInputError(`Invoice ${key} references must belong to this organization and be available`);
  }
  return customer;
}

async function taxRates(tx: Transaction, lines: InvoiceWriteLine[]) {
  const ids = [...new Set(lines.flatMap(line => line.taxRateId ? [line.taxRateId] : []))];
  const rows = ids.length ? await tx.select({ id: taxRate.id, rate: taxRate.rate }).from(taxRate).where(inArray(taxRate.id, ids)) : [];
  return new Map(rows.map(row => [row.id, row.rate]));
}

async function prices(tx: Transaction, orgId: string, baseCurrency: string, currency: string, date: string,
  lines: InvoiceWriteLine[], documentListId?: string | null) {
  const values: number[] = [];
  for (const line of lines) {
    const listId = line.priceListId ?? documentListId;
    const [list] = listId ? await tx.select().from(priceList).where(and(eq(priceList.id, listId), eq(priceList.organizationId, orgId))).for("share") : [];
    if (list && list.currencyCode !== currency) throw new WireCompatibilityError("Invoice price list currency must match the invoice; no implicit FX conversion");
    if (hasInvoicePrice(line) || !line.inventoryItemId) { values.push(0); continue; }
    if (list && list.isActive && (!list.effectiveFrom || date >= list.effectiveFrom) && (!list.effectiveTo || date <= list.effectiveTo)) {
      const tiers = await tx.select().from(priceListItem).where(and(eq(priceListItem.priceListId, list.id),
        eq(priceListItem.inventoryItemId, line.inventoryItemId))).for("share");
      const tier = tiers.filter(row => row.minQuantity <= (line.quantity || 1)).sort((a, b) => b.minQuantity - a.minQuantity)[0];
      if (tier) { values.push(tier.unitPrice); continue; }
    }
    // Inventory prices lack a currency snapshot; only the organization's base units are supported.
    if (baseCurrency !== currency) throw new WireCompatibilityError("Default inventory price requires the organization currency; provide an explicit price or matching price list");
    const [item] = await tx.select({ salePrice: inventoryItem.salePrice }).from(inventoryItem).where(eq(inventoryItem.id, line.inventoryItemId));
    values.push(item.salePrice);
  }
  return values;
}

async function nextNumber(tx: Transaction, orgId: string) {
  // All invoice CRUD callers lock the organization first, including first-sequence creation.
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, orgId), eq(numberSequence.entityType, "invoice"))).for("update");
  const [maximum] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${invoice.invoiceNumber}, '^[A-Z]+-', ''), '')::numeric), 0)::text` })
    .from(invoice).where(eq(invoice.organizationId, orgId));
  const next = BigInt(sequence?.lastNumber ?? maximum?.value ?? 0) + 1n;
  if (next > 2147483647n || next < 1n) invoiceInputError("Invoice numbering exceeds signed int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(next) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: orgId, entityType: "invoice", prefix: "INV", lastNumber: Number(next) });
  return `INV-${String(next).padStart(5, "0")}`;
}

async function creditWarning(tx: Transaction, orgId: string, customer: typeof contact.$inferSelect, currency: string, total: number) {
  if (customer.creditLimit === null) return null;
  if (customer.currencyCode !== currency) throw new WireCompatibilityError("Credit-limit comparison requires the contact and invoice currencies to agree");
  const amounts = await tx.select({ amount: sql<string>`${invoice.amountDue}::text`, currency: invoice.currencyCode }).from(invoice)
    .where(and(eq(invoice.organizationId, orgId), eq(invoice.contactId, customer.id), ne(invoice.status, "void"), notDeleted(invoice.deletedAt)));
  const credits = await tx.select({ amount: sql<string>`${customerCredit.amountRemaining}::text`, currency: customerCredit.currencyCode }).from(customerCredit)
    .where(and(eq(customerCredit.organizationId, orgId), eq(customerCredit.contactId, customer.id), ne(customerCredit.status, "void"), notDeleted(customerCredit.deletedAt)));
  if ([...amounts, ...credits].some(row => row.currency !== currency)) throw new WireCompatibilityError("Credit-limit comparison cannot combine different currencies");
  const sum = (rows: typeof amounts) => {
    let result = 0n;
    for (const row of rows) { const value = BigInt(row.amount); safeInvoiceMinor(value); result += value; }
    safeInvoiceMinor(result); return result;
  };
  const current = sum(amounts) - sum(credits), projected = current + BigInt(total), limit = BigInt(customer.creditLimit);
  safeInvoiceMinor(current); safeInvoiceMinor(projected); safeInvoiceMinor(limit);
  if (projected <= limit) return null;
  const warning = { creditLimit: Number(limit), currentOutstanding: Number(current), projectedOutstanding: Number(projected), exceededBy: safeInvoiceMinor(projected - limit) };
  return publicMoneyDto(warning, ["creditLimit", "currentOutstanding", "projectedOutstanding", "exceededBy"]);
}
export class InvoiceCreditLimitError extends AuthError {
  constructor(readonly creditLimitWarning: NonNullable<Awaited<ReturnType<typeof creditWarning>>>) {
    super(`Credit limit exceeded: projected ${creditLimitWarning.projectedOutstanding} minor units against a limit of ${creditLimitWarning.creditLimit} minor units`, 403);
  }
}

export async function createInvoice(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:invoices");
  const parsed = invoiceCreateSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
    if (!org) throw new AuthError("Organization not found", 404);
    const customer = await references(tx, ctx.organizationId, parsed.contactId, [...parsed.lines,
      ...(parsed.priceListId ? [{ ...parsed.lines[0], priceListId: parsed.priceListId }] : [])]);
    const currency = currencyCodeSchema.parse(parsed.currencyCode ?? (transport === "mcp" ? "USD" : customer.currencyCode ?? org.defaultCurrency ?? "USD"));
    await assertNotLocked(ctx.organizationId, parsed.issueDate); // Preserve strict create policy.
    await checkMonthlyLimit(ctx.organizationId, invoice, invoice.organizationId, invoice.createdAt, "invoicesPerMonth", invoice.deletedAt);
    await checkMultiCurrency(ctx.organizationId, currency);
    let dueDate = parsed.dueDate;
    if (!dueDate) {
      const terms = customer.paymentTermsDays ?? (org.defaultPaymentTerms ? parseInt(org.defaultPaymentTerms) : 30);
      const date = new Date(`${parsed.issueDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + (terms || 30));
      if (!Number.isFinite(date.getTime())) invoiceInputError("Invalid default payment terms");
      dueDate = rateDateSchema.parse(date.toISOString().slice(0, 10));
    }
    // Existing MCP omission default is zero. Price lookup is opt-in via priceListId there.
    const useLookup = transport === "rest" || parsed.priceListId || parsed.lines.some(line => line.priceListId);
    const fallback = useLookup ? await prices(tx, ctx.organizationId, org.defaultCurrency ?? "USD", currency, parsed.issueDate, parsed.lines, parsed.priceListId) : [];
    const totals = invoiceWriteTotals(parsed.lines, currency, transport === "rest", await taxRates(tx, parsed.lines), fallback);
    const warning = await creditWarning(tx, ctx.organizationId, customer, currency, totals.total);
    if (warning && parsed.enforceCreditLimit) throw new InvoiceCreditLimitError(warning);
    const values = { organizationId: ctx.organizationId, contactId: customer.id, issueDate: parsed.issueDate, dueDate,
      reference: parsed.reference || null, notes: parsed.notes || null, subtotal: totals.subtotal, taxTotal: totals.taxTotal,
      total: totals.total, amountPaid: 0, amountDue: totals.total, currencyCode: currency,
      invoiceType: parsed.invoiceType, depositPercent: parsed.depositPercent ?? null, createdBy: ctx.userId };
    const requester = parsed.submitForApproval ? await tx.query.member.findFirst({ where: and(eq(member.userId, ctx.userId), eq(member.organizationId, ctx.organizationId)) }) : undefined;
    const workflow = requester ? await checkApprovalRequired(ctx.organizationId, "invoice", values) : null;
    const pending = requester && workflow && workflow.steps.length > 0;
    const invoiceNumber = await nextNumber(tx, ctx.organizationId);
    const [created] = await tx.insert(invoice).values({ ...values, invoiceNumber, status: pending ? "pending_approval" : "draft" }).returning();
    await tx.insert(invoiceLine).values(totals.processedLines.map(line => ({ ...line, invoiceId: created.id })));
    if (pending) await tx.insert(approvalRequest).values({ organizationId: ctx.organizationId, workflowId: workflow.id,
      entityType: "invoice", entityId: created.id, requestedById: requester.id, currentStepOrder: 1 });
    return { invoice: invoiceWriteDto(created), creditLimitWarning: warning };
  });
  await logAudit({ ctx, action: "create", entityType: "invoice", entityId: result.invoice.id, request });
  if (result.invoice.status === "pending_approval") await logAudit({ ctx, action: "submit_for_approval", entityType: "invoice",
    entityId: result.invoice.id, changes: { previousStatus: "draft" }, request });
  return result;
}

async function draft(tx: Transaction, ctx: AuthContext, id: string) {
  await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  const [existing] = await tx.select().from(invoice).where(scope(id, ctx.organizationId)).for("update");
  if (!existing) throw new AuthError("Invoice not found", 404);
  if (existing.status !== "draft") throw new AuthError("Only draft invoices can be edited or deleted", 400);
  stringifyWire(invoiceWriteDto(existing)); // Preflight opaque saved JSON too, before any mutation.
  await assertNotLocked(ctx.organizationId, existing.issueDate);
  const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, id));
  lines.forEach(publicLineDto);
  const history = lines.map(line => ({ ...line, quantity: line.quantity / 100 }));
  await references(tx, ctx.organizationId, existing.contactId, history, true);
  return existing;
}

export async function updateInvoice(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices"); z.string().uuid().parse(id);
  const parsed = invoiceUpdateSchema.parse(input);
  const result = await db.transaction(async tx => {
    const existing = await draft(tx, ctx, id);
    await assertNotLocked(ctx.organizationId, parsed.issueDate ?? existing.issueDate);
    const patch: Partial<typeof invoice.$inferInsert> = { updatedAt: new Date() };
    if (parsed.issueDate !== undefined) patch.issueDate = parsed.issueDate;
    if (parsed.dueDate !== undefined) patch.dueDate = parsed.dueDate;
    if (parsed.reference !== undefined) patch.reference = parsed.reference || null;
    if (parsed.notes !== undefined) patch.notes = parsed.notes || null;
    if (parsed.lines) {
      await references(tx, ctx.organizationId, existing.contactId, parsed.lines);
      // PATCH keeps omission-as-zero and never resolves price lists.
      if (parsed.lines.some(line => line.priceListId)) invoiceInputError("Invoice update requires explicit prices; price-list lookup is create-only");
      const totals = invoiceWriteTotals(parsed.lines, existing.currencyCode, false, await taxRates(tx, parsed.lines));
      Object.assign(patch, { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total,
        amountDue: safeInvoiceMinor(BigInt(totals.total) - BigInt(existing.amountPaid)) });
      await tx.delete(invoiceLine).where(eq(invoiceLine.invoiceId, id));
      await tx.insert(invoiceLine).values(totals.processedLines.map(line => ({ ...line, invoiceId: id })));
    }
    const [updated] = await tx.update(invoice).set(patch).where(scope(id, ctx.organizationId)).returning();
    return { existing, invoice: invoiceWriteDto(updated) };
  });
  await logAudit({ ctx, action: "update", entityType: "invoice", entityId: id, changes: diffChanges(result.existing, result.invoice), request });
  return { invoice: result.invoice };
}

export async function deleteInvoice(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:invoices"); z.string().uuid().parse(id);
  const existing = await db.transaction(async tx => {
    const row = await draft(tx, ctx, id);
    await tx.delete(invoiceLine).where(eq(invoiceLine.invoiceId, id));
    await tx.update(invoice).set(softDelete()).where(scope(id, ctx.organizationId));
    return row;
  });
  await logAudit({ ctx, action: "delete", entityType: "invoice", entityId: id, changes: existing, request });
  return { success: true };
}
