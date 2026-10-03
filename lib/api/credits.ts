import { z } from "zod";
import { and, eq, asc, desc, gte, lte, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditNote, creditNoteLine, customerCredit, invoice, invoiceLine, organization, numberSequence,
  payment, paymentAllocation, journalEntry, journalLine, bankAccount, chartAccount, contact } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { logAudit } from "./audit";
import { references, taxRates } from "./invoice-writes";
import { invoiceWriteLineSchema, safeInvoiceMinor, invoiceRound } from "./invoice-write-wire";
import { lifecycleDto } from "./invoice-lifecycle-wire";
import { receivablePostingRate, postReceivable, receivableAccount } from "./invoice-lifecycle";
import { ensureControlAccount } from "./journal-automation";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { invoiceStock, stockQuantity } from "./invoice-stock";
import { restockCredit, undoCreditStock } from "./credit-stock";
import { publicLineDto, publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { checkMultiCurrency } from "./check-limit";
import { creditCreateFields, creditMcpCreateFields, parseCreditUpdate, creditTotals, creditNoteDto, customerCreditDto,
  creditRelations, creditBalances, creditListFields, creditApplyFields, customerCreditApplyFields,
  customerCreditCreateFields, creditAmount } from "./credit-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const fail = (message: string): never => { throw new AuthError(message, 400); };
const scope = (ctx: AuthContext, id: string) => and(eq(creditNote.id, id), eq(creditNote.organizationId, ctx.organizationId), notDeleted(creditNote.deletedAt));
const customerScope = (ctx: AuthContext, id: string) => and(eq(customerCredit.id, id), eq(customerCredit.organizationId, ctx.organizationId), notDeleted(customerCredit.deletedAt));
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404); currencyCodeSchema.parse(org.defaultCurrency ?? "USD"); return org;
}
async function number(tx: Tx, ctx: AuthContext, kind: "credit_note" | "payment") {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, ctx.organizationId), eq(numberSequence.entityType, kind))).for("update");
  const table = kind === "credit_note" ? creditNote : payment;
  const column = kind === "credit_note" ? creditNote.creditNoteNumber : payment.paymentNumber;
  const [max] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${column}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(table).where(eq(table.organizationId, ctx.organizationId));
  const value = BigInt(sequence?.lastNumber ?? max.value) + 1n, prefix = kind === "credit_note" ? "CN" : "PAY";
  if (value < 1n || value > 2147483647n) fail("Credit/payment numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: ctx.organizationId, entityType: kind, prefix, lastNumber: Number(value) });
  return `${prefix}-${String(value).padStart(5, "0")}`;
}
async function targetInvoice(tx: Tx, ctx: AuthContext, id: string, contactId: string, currency: string, historical = false) {
  const [row] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, ctx.organizationId),
    historical ? undefined : notDeleted(invoice.deletedAt))).for("update");
  if (!row) throw new AuthError("Invoice not found", 404);
  lifecycleDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  if (row.contactId !== contactId) fail("Credit and invoice must belong to the same customer");
  if (row.currencyCode !== currency) fail("Credit currency must match the invoice currency"); return row;
}
async function loadNote(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id); const org = await lockOrg(tx, ctx);
  const [row] = await tx.select().from(creditNote).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Credit note not found", 404);
  creditNoteDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  const lines = await tx.select().from(creditNoteLine).where(eq(creditNoteLine.creditNoteId, id)).orderBy(creditNoteLine.sortOrder, creditNoteLine.id);
  creditBalances(row, lines);
  await references(tx, ctx.organizationId, row.contactId, lines.map(line => invoiceWriteLineSchema.parse({ ...line, quantity: line.quantity / 100 })), true);
  if (row.invoiceId) await targetInvoice(tx, ctx, row.invoiceId, row.contactId, row.currencyCode, true);
  if (row.amountApplied < 0 || row.amountRemaining < 0 || (row.status === "draft" && (row.amountApplied !== 0 || row.amountRemaining !== 0)) ||
    (["sent", "applied"].includes(row.status) && safeInvoiceMinor(BigInt(row.amountApplied) + BigInt(row.amountRemaining)) !== row.total))
    fail("Invalid saved credit-note balances");
  return { row, org, lines };
}
async function loadCustomerCredit(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id); const org = await lockOrg(tx, ctx);
  const [row] = await tx.select().from(customerCredit).where(customerScope(ctx, id)).for("update");
  if (!row) throw new AuthError("Customer credit not found", 404);
  customerCreditDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.date);
  if (row.originalAmount <= 0 || row.amountRemaining < 0 || row.amountRemaining > row.originalAmount) fail("Invalid saved customer-credit balances");
  await references(tx, ctx.organizationId, row.contactId, [], true);
  if (!row.journalEntryId) throw new WireCompatibilityError("Customer-credit application requires a posted recognition journal");
  if (row.journalEntryId) {
    const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!entry || entry.deletedAt || entry.status !== "posted" || entry.sourceType !== "customer_credit" || (entry.sourceId && entry.sourceId !== id))
      throw new WireCompatibilityError("Customer-credit recognition journal is unavailable or belongs to another document");
  }
  return { row, org };
}
async function audit(ctx: AuthContext, entityType: string, id: string, action: string, request?: Request) {
  await logAudit({ ctx, entityType, entityId: id, action, request });
}

export async function listCredits(ctx: AuthContext, input: unknown, customer = false) {
  const parsed = z.object(creditListFields).strict().parse(input);
  if (parsed.status) z.enum(customer ? ["open", "applied", "void", "refunded"] : ["draft", "sent", "applied", "void"]).parse(parsed.status);
  return db.transaction(async tx => {
    if (customer) {
      const conditions = and(eq(customerCredit.organizationId, ctx.organizationId), notDeleted(customerCredit.deletedAt),
        parsed.status ? eq(customerCredit.status, parsed.status as "open" | "applied" | "void" | "refunded") : undefined,
        parsed.contactId ? eq(customerCredit.contactId, parsed.contactId) : undefined,
        parsed.startDate ? gte(customerCredit.date, parsed.startDate) : undefined, parsed.endDate ? lte(customerCredit.date, parsed.endDate) : undefined);
      const column = parsed.sortBy === "date" ? customerCredit.date : parsed.sortBy === "amount" ? customerCredit.originalAmount : parsed.sortBy === "remaining" ? customerCredit.amountRemaining : customerCredit.createdAt;
      const rows = await tx.query.customerCredit.findMany({ where: conditions, with: { contact: true }, orderBy: [parsed.sortOrder === "asc" ? asc(column) : desc(column), asc(customerCredit.id)], limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit });
      const [count] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(customerCredit).where(conditions);
      return { rows: rows.map(row => creditRelations(customerCreditDto(row), ctx.organizationId)), total: count.count };
    }
    const conditions = and(eq(creditNote.organizationId, ctx.organizationId), notDeleted(creditNote.deletedAt),
      parsed.status ? eq(creditNote.status, parsed.status as "draft" | "sent" | "applied" | "void") : undefined,
      parsed.contactId ? eq(creditNote.contactId, parsed.contactId) : undefined,
      parsed.startDate ? gte(creditNote.issueDate, parsed.startDate) : undefined, parsed.endDate ? lte(creditNote.issueDate, parsed.endDate) : undefined);
    const column = parsed.sortBy === "date" ? creditNote.issueDate : parsed.sortBy === "total" ? creditNote.total : parsed.sortBy === "remaining" ? creditNote.amountRemaining : parsed.sortBy === "number" ? creditNote.creditNoteNumber : creditNote.createdAt;
    const rows = await tx.query.creditNote.findMany({ where: conditions, with: { contact: true }, orderBy: [parsed.sortOrder === "asc" ? asc(column) : desc(column), asc(creditNote.id)], limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit });
    const [count] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(creditNote).where(conditions);
    return { rows: rows.map(row => creditRelations(creditNoteDto(row), ctx.organizationId)), total: count.count };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getCreditNote(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const row = await tx.query.creditNote.findFirst({ where: scope(ctx, id), with: { contact: true, lines: { with: { account: true, taxRate: true } } } });
    if (!row) throw new AuthError("Credit note not found", 404);
    const result = creditRelations(creditNoteDto(row), ctx.organizationId);
    try {
      await references(tx, ctx.organizationId, row.contactId, row.lines.map(line => invoiceWriteLineSchema.parse({ ...line, quantity: line.quantity / 100 })), true);
      if (row.invoiceId) await targetInvoice(tx, ctx, row.invoiceId, row.contactId, row.currencyCode, true);
    } catch (err) {
      if (err instanceof AuthError || err instanceof z.ZodError) throw new WireCompatibilityError("Credit-note saved references are unavailable in this organization");
      throw err;
    }
    return { creditNote: result };
  });
}
export async function getCustomerCredit(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const row = await db.query.customerCredit.findFirst({ where: customerScope(ctx, id), with: { contact: true, journalEntry: true } });
  if (!row) throw new AuthError("Customer credit not found", 404);
  if (row.journalEntry && (row.journalEntry.sourceType !== "customer_credit" || (row.journalEntry.sourceId && row.journalEntry.sourceId !== id)))
    throw new WireCompatibilityError("Customer-credit recognition belongs to another document");
  return { customerCredit: creditRelations(customerCreditDto(row), ctx.organizationId) };
}
export async function creditNoteSummary(ctx: AuthContext) {
  const rows = await db.select({ currency: creditNote.currencyCode, status: creditNote.status,
    total: sql<string>`${creditNote.total}::text`, applied: sql<string>`${creditNote.amountApplied}::text`, remaining: sql<string>`${creditNote.amountRemaining}::text` })
    .from(creditNote).where(and(eq(creditNote.organizationId, ctx.organizationId), notDeleted(creditNote.deletedAt)));
  if (new Set(rows.map(row => row.currency)).size > 1) throw new WireCompatibilityError("Credit-note summary cannot combine different currencies");
  let totalAmount = 0n, totalApplied = 0n, totalRemaining = 0n;
  const statusBreakdown: Record<string, { count: number; amount: number; amountMinor: string }> = Object.fromEntries(["draft", "sent", "applied", "void"].map(status => [status, { count: 0, amount: 0, amountMinor: "0" }]));
  for (const row of rows) {
    for (const value of [row.total, row.applied, row.remaining]) safeInvoiceMinor(BigInt(value));
    totalAmount += BigInt(row.total); totalApplied += BigInt(row.applied); totalRemaining += BigInt(row.remaining);
    const status = statusBreakdown[row.status]; status.count++;
    status.amountMinor = (BigInt(status.amountMinor) + BigInt(row.total)).toString(); status.amount = safeInvoiceMinor(BigInt(status.amountMinor));
  }
  return { ...publicMoneyDto({ totalCount: rows.length, totalAmount: safeInvoiceMinor(totalAmount), totalApplied: safeInvoiceMinor(totalApplied), totalRemaining: safeInvoiceMinor(totalRemaining) }, ["totalAmount", "totalApplied", "totalRemaining"]),
    currencyCode: rows[0]?.currency ?? null, statusBreakdown };
}
export async function createCreditNote(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:credit-notes"); const parsed = z.object(transport === "rest" ? creditCreateFields : creditMcpCreateFields).strict().parse(input);
  const result = await db.transaction(async tx => {
    await lockOrg(tx, ctx); await assertNotLocked(ctx.organizationId, parsed.issueDate);
    const lines = parsed.lines.map(line => invoiceWriteLineSchema.parse(line));
    await references(tx, ctx.organizationId, parsed.contactId, lines);
    if (parsed.invoiceId) await targetInvoice(tx, ctx, parsed.invoiceId, parsed.contactId, parsed.currencyCode);
    const totals = creditTotals(parsed.lines, transport, parsed.currencyCode, await taxRates(tx, lines));
    const [row] = await tx.insert(creditNote).values({ organizationId: ctx.organizationId, contactId: parsed.contactId,
      invoiceId: parsed.invoiceId ?? null, creditNoteNumber: await number(tx, ctx, "credit_note"), issueDate: parsed.issueDate,
      reference: parsed.reference ?? null, notes: parsed.notes ?? null, currencyCode: parsed.currencyCode,
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, createdBy: ctx.userId }).returning();
    await tx.insert(creditNoteLine).values(totals.processedLines.map(line => ({ ...line, creditNoteId: row.id })));
    return { creditNote: creditNoteDto(row) };
  }); await audit(ctx, "credit_note", result.creditNote.id, "create", request); return result;
}
export async function updateCreditNote(ctx: AuthContext, id: string, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:credit-notes"); const parsed = parseCreditUpdate(input, transport);
  const result = await db.transaction(async tx => {
    const { row } = await loadNote(tx, ctx, id); if (row.status !== "draft") fail("Only draft credit notes can be edited");
    await assertNotLocked(ctx.organizationId, row.issueDate); await assertNotLocked(ctx.organizationId, parsed.issueDate ?? row.issueDate);
    const contactId = parsed.contactId ?? row.contactId, currency = parsed.currencyCode ?? row.currencyCode;
    await references(tx, ctx.organizationId, contactId, []);
    const invoiceId = parsed.invoiceId === undefined ? row.invoiceId : parsed.invoiceId;
    if (invoiceId) await targetInvoice(tx, ctx, invoiceId, contactId, currency);
    const patch: Partial<typeof creditNote.$inferInsert> = { contactId, invoiceId, currencyCode: currency,
      issueDate: parsed.issueDate ?? row.issueDate, ...(parsed.reference !== undefined ? { reference: parsed.reference } : {}), ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}) };
    if (parsed.lines) {
      const lines = parsed.lines.map(line => invoiceWriteLineSchema.parse(line)); await references(tx, ctx.organizationId, contactId, lines);
      const totals = creditTotals(parsed.lines, transport, currency, await taxRates(tx, lines));
      Object.assign(patch, { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total });
      await tx.delete(creditNoteLine).where(eq(creditNoteLine.creditNoteId, id));
      await tx.insert(creditNoteLine).values(totals.processedLines.map(line => ({ ...line, creditNoteId: id })));
    }
    const [updated] = await tx.update(creditNote).set({ ...patch, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { creditNote: creditNoteDto(updated) };
  }); await audit(ctx, "credit_note", id, "update", request); return result;
}
export async function deleteCreditNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:credit-notes"); await db.transaction(async tx => {
    const { row } = await loadNote(tx, ctx, id); if (row.status !== "draft") fail("Only draft credit notes can be deleted");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    await tx.delete(creditNoteLine).where(eq(creditNoteLine.creditNoteId, id)); await tx.update(creditNote).set(softDelete()).where(scope(ctx, id));
  }); await audit(ctx, "credit_note", id, "delete", request); return { success: true };
}
async function restockLines(tx: Tx, ctx: AuthContext, row: typeof creditNote.$inferSelect) {
  if (!row.invoiceId) return [];
  const original = await targetInvoice(tx, ctx, row.invoiceId, row.contactId, row.currencyCode, true);
  const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, original.id)); lines.forEach(publicLineDto);
  await references(tx, ctx.organizationId, row.contactId, lines.map(line => invoiceWriteLineSchema.parse({ ...line, quantity: line.quantity / 100 })), true);
  const numerator = original.total > 0 ? BigInt(Math.min(row.total, original.total)) : 1n;
  const denominator = original.total > 0 ? BigInt(original.total) : 1n;
  return lines.filter(line => line.inventoryItemId).map(line => ({ inventoryItemId: line.inventoryItemId,
    quantity: stockQuantity(invoiceRound(BigInt(line.quantity) * numerator, denominator)), warehouseId: line.warehouseId })).filter(line => line.quantity > 0);
}
export async function sendCreditNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:credit-notes"); const result = await db.transaction(async tx => {
    const { row, org, lines } = await loadNote(tx, ctx, id); if (row.status !== "draft") fail("Only draft credit notes can be sent");
    if (row.total <= 0 || lines.some(line => line.amount < 0 || line.taxAmount < 0)) fail("Sending requires positive total and nonnegative credit lines");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    const base = org.defaultCurrency ?? "USD", fx = await receivablePostingRate(ctx, row.currencyCode, base, row.issueDate);
    const ar = await receivableAccount(tx, ctx.organizationId, "1200");
    const legs = [];
    for (const line of lines) {
      const account = line.accountId ? await activeAccount(tx, ctx, line.accountId) : await receivableAccount(tx, ctx.organizationId, "4000");
      legs.push({ accountId: account.id, debitAmount: line.amount, creditAmount: 0, costCenterId: line.costCenterId });
    }
    if (row.taxTotal) {
      const vat = await control(tx, ctx, "outputVat", base); legs.push({ accountId: vat.id, debitAmount: row.taxTotal, creditAmount: 0 });
    }
    legs.push({ accountId: ar.id, debitAmount: 0, creditAmount: row.total });
    const entry = await postReceivable(tx, ctx, { date: row.issueDate, description: `Credit note ${row.creditNoteNumber}`, reference: row.creditNoteNumber,
      sourceType: "credit_note", sourceId: id }, legs, row.currencyCode, base, fx);
    const stock = await restockCredit(tx, ctx, base, id, await restockLines(tx, ctx, row));
    if (stock.legs.some(line => line.debitAmount || line.creditAmount)) await postReceivable(tx, ctx, { date: row.issueDate,
      description: `Credit note restock ${row.creditNoteNumber}`, reference: row.creditNoteNumber, sourceType: "credit_note_cogs", sourceId: id }, stock.legs, base, base,
      { rateExact: "1", source: "base_inventory", effectiveDate: row.issueDate });
    const [updated] = await tx.update(creditNote).set({ status: "sent", sentAt: new Date(), amountRemaining: row.total, journalEntryId: entry.id, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { creditNote: creditNoteDto(updated), journalEntryId: entry.id };
  }); await audit(ctx, "credit_note", id, "send", request); return result;
}
async function activeAccount(tx: Tx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId), notDeleted(chartAccount.deletedAt), eq(chartAccount.isActive, true))).for("share");
  if (!row) fail("Active account must belong to this organization"); return row;
}
async function control(tx: Tx, ctx: AuthContext, kind: "customerDeposits" | "outputVat", base: string) {
  const row = await ensureControlAccount(ctx.organizationId, kind, base, tx);
  if (!row) throw new AuthError("Control account unavailable", 400); return activeAccount(tx, ctx, row.id);
}
export async function createCustomerCredit(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments"); const parsed = z.object(customerCreditCreateFields).strict().parse(input), amount = creditAmount(parsed);
  if (!!parsed.bankAccountId === !!parsed.depositAccountId) fail("Exactly one bankAccountId or depositAccountId is required");
  const result = await db.transaction(async tx => {
    const org = await lockOrg(tx, ctx), customer = await references(tx, ctx.organizationId, parsed.contactId, []);
    const currency = currencyCodeSchema.parse(parsed.currencyCode ?? customer.currencyCode ?? org.defaultCurrency ?? "USD"), base = org.defaultCurrency ?? "USD";
    await assertNotLocked(ctx.organizationId, parsed.date); await checkMultiCurrency(ctx.organizationId, currency);
    const fx = await receivablePostingRate(ctx, currency, base, parsed.date);
    let cash;
    if (parsed.bankAccountId) {
      const [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, parsed.bankAccountId), eq(bankAccount.organizationId, ctx.organizationId), notDeleted(bankAccount.deletedAt))).for("update");
      if (!bank) throw new AuthError("Bank account not found", 404);
      if (bank.currencyCode !== currency) fail("Bank currency must match the credit currency");
      cash = await activeAccount(tx, ctx, await ensureBankLedgerAccount(ctx.organizationId, bank, tx));
    } else cash = await activeAccount(tx, ctx, parsed.depositAccountId!);
    if (cash.type !== "asset") fail("Cash deposit account must be an asset");
    const deposits = await control(tx, ctx, "customerDeposits", base), id = crypto.randomUUID();
    const entry = await postReceivable(tx, ctx, { date: parsed.date, description: `Customer ${parsed.sourceType} received`, reference: parsed.sourceType,
      sourceType: "customer_credit", sourceId: id }, [{ accountId: cash.id, debitAmount: amount, creditAmount: 0 },
      { accountId: deposits.id, debitAmount: 0, creditAmount: amount }], currency, base, fx);
    const [row] = await tx.insert(customerCredit).values({ id, organizationId: ctx.organizationId, contactId: parsed.contactId,
      date: parsed.date, currencyCode: currency, originalAmount: amount, amountRemaining: amount, sourceType: parsed.sourceType,
      notes: parsed.notes ?? null, journalEntryId: entry.id, createdBy: ctx.userId }).returning();
    return { customerCredit: customerCreditDto(row) };
  }); await audit(ctx, "customer_credit", result.customerCredit.id, "create", request); return result;
}
export async function applyCredit(ctx: AuthContext, id: string, input: unknown, customer = false, request?: Request) {
  requireRole(ctx, customer ? "manage:payments" : "manage:credit-notes");
  const parsed = customer ? z.object(customerCreditApplyFields).strict().parse(input) : { ...z.object(creditApplyFields).strict().parse(input), date: undefined };
  const amount = creditAmount(parsed);
  const result = await db.transaction(async tx => {
    const { row, org } = customer ? await loadCustomerCredit(tx, ctx, id) : await loadNote(tx, ctx, id);
    if (row.status !== (customer ? "open" : "sent")) fail(customer ? "Only open customer credits can be applied" : "Only sent credit notes can be applied");
    if (!customer) {
      const [recognized] = row.journalEntryId ? await tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId),
        eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), notDeleted(journalEntry.deletedAt))).for("share") : [];
      if (!recognized || recognized.sourceType !== "credit_note" || (recognized.sourceId && recognized.sourceId !== id))
        throw new WireCompatibilityError("Credit-note application requires its own posted recognition journal");
    }
    const inv = await targetInvoice(tx, ctx, parsed.invoiceId, row.contactId, row.currencyCode);
    if (!["sent", "partial", "overdue"].includes(inv.status) || inv.amountPaid < 0 || inv.amountDue <= 0 || safeInvoiceMinor(BigInt(inv.amountPaid) + BigInt(inv.amountDue)) !== inv.total)
      fail("Cannot apply credit to this invoice status or balance");
    if (amount > row.amountRemaining || amount > inv.amountDue) fail("Amount exceeds credit remaining balance or invoice amount due");
    const date = customer ? parsed.date ?? new Date().toISOString().slice(0, 10) : (row as typeof creditNote.$inferSelect).issueDate;
    await assertNotLocked(ctx.organizationId, date); await assertNotLocked(ctx.organizationId, inv.issueDate);
    const paid = safeInvoiceMinor(BigInt(inv.amountPaid) + BigInt(amount)), due = safeInvoiceMinor(BigInt(inv.total) - BigInt(paid));
    const remaining = safeInvoiceMinor(BigInt(row.amountRemaining) - BigInt(amount));
    const applied = customer ? 0 : safeInvoiceMinor(BigInt((row as typeof creditNote.$inferSelect).amountApplied) + BigInt(amount));
    let entryId: string | null = null;
    if (customer) {
      const base = org.defaultCurrency ?? "USD", fx = await receivablePostingRate(ctx, row.currencyCode, base, date);
      const ar = await receivableAccount(tx, ctx.organizationId, "1200"), deposits = await control(tx, ctx, "customerDeposits", base);
      entryId = (await postReceivable(tx, ctx, { date, description: `Apply customer credit to invoice ${inv.invoiceNumber}`, reference: inv.invoiceNumber,
        sourceType: "customer_credit_application", sourceId: id }, [{ accountId: deposits.id, debitAmount: amount, creditAmount: 0 },
        { accountId: ar.id, debitAmount: 0, creditAmount: amount }], row.currencyCode, base, fx)).id;
    }
    const [carrier] = await tx.insert(payment).values({ organizationId: ctx.organizationId, contactId: row.contactId, paymentNumber: await number(tx, ctx, "payment"),
      type: "received", date, amount, method: "other", reference: inv.invoiceNumber, notes: `Credit applied to invoice ${inv.invoiceNumber}`,
      currencyCode: row.currencyCode, journalEntryId: entryId, createdBy: ctx.userId }).returning();
    await tx.insert(paymentAllocation).values([{ paymentId: carrier.id, documentType: customer ? "prepayment" : "credit_note", documentId: id, amount },
      { paymentId: carrier.id, documentType: "invoice", documentId: inv.id, amount }]);
    const status = due === 0 ? "paid" : "partial";
    const [updatedInvoice] = await tx.update(invoice).set({ amountPaid: paid, amountDue: due, status, paidAt: status === "paid" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(invoice.id, inv.id), eq(invoice.organizationId, ctx.organizationId))).returning();
    if (customer) {
      const [updated] = await tx.update(customerCredit).set({ amountRemaining: remaining, status: remaining === 0 ? "applied" : "open", updatedAt: new Date() }).where(customerScope(ctx, id)).returning();
      return { customerCredit: customerCreditDto(updated), invoice: lifecycleDto(updatedInvoice) };
    }
    const [updated] = await tx.update(creditNote).set({ amountApplied: applied, amountRemaining: remaining, status: remaining === 0 ? "applied" : "sent", updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { creditNote: creditNoteDto(updated), invoice: lifecycleDto(updatedInvoice) };
  }); await audit(ctx, customer ? "customer_credit" : "credit_note", id, "apply", request); return result;
}
export async function availableCredits(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, ctx.organizationId), notDeleted(invoice.deletedAt)));
    if (!row) throw new AuthError("Invoice not found", 404); lifecycleDto(row);
    const [customer] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, row.contactId), eq(contact.organizationId, ctx.organizationId)));
    if (!customer) throw new WireCompatibilityError("Invoice contact belongs to another organization");
    const rows = await tx.select({ id: customerCredit.id, date: customerCredit.date, currencyCode: customerCredit.currencyCode,
      originalAmount: customerCredit.originalAmount, amountRemaining: customerCredit.amountRemaining, sourceType: customerCredit.sourceType, notes: customerCredit.notes }).from(customerCredit)
      .where(and(eq(customerCredit.organizationId, ctx.organizationId), eq(customerCredit.contactId, row.contactId), eq(customerCredit.currencyCode, row.currencyCode),
        eq(customerCredit.status, "open"), gt(customerCredit.amountRemaining, 0), notDeleted(customerCredit.deletedAt))).orderBy(desc(customerCredit.date), asc(customerCredit.id));
    return { credits: rows.map(customerCreditDto), ...publicMoneyDto({ currencyCode: row.currencyCode, amountDue: row.amountDue }, ["amountDue"]) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function voidCreditNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:credit-notes"); const result = await db.transaction(async tx => {
    const { row, org } = await loadNote(tx, ctx, id); if (row.status === "void") fail("Already voided");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    if (row.total < 0) fail("A negative credit note cannot be voided into an open balance");
    const posted = row.status !== "draft";
    if (posted && !row.journalEntryId) throw new WireCompatibilityError("Posted credit note has no recognition journal");
    if (posted) {
      const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId!), eq(journalEntry.organizationId, ctx.organizationId),
        eq(journalEntry.status, "posted"), notDeleted(journalEntry.deletedAt))).for("share");
      if (!entry || !["credit_note", "credit_note_issue"].includes(entry.sourceType ?? "") || (entry.sourceId && entry.sourceId !== id)) throw new WireCompatibilityError("Credit-note recognition journal is unavailable or belongs to another document");
      const saved = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
      if (!saved.length) fail("Recognition journal has no lines");
      await reverseJournal(tx, ctx, row, saved, "credit_note_void");
      const base = org.defaultCurrency ?? "USD";
      const returned = await undoCreditStock(tx, ctx, id);
      if (returned?.saved.length) await reverseJournal(tx, ctx, row, returned.saved, "credit_note_void_cogs");
      // Historical send did not attach a source ID to its stock movements. Retain
      // its pro-rata/current-cost policy; new documents always use saved returns.
      const stock = !returned && entry.sourceId === null ? await invoiceStock(tx, ctx, base, id, await restockLines(tx, ctx, row)) : null;
      if (stock?.legs.some(line => line.debitAmount || line.creditAmount)) await postReceivable(tx, ctx, { date: row.issueDate,
        description: `Void credit note restock ${row.creditNoteNumber}`, reference: row.creditNoteNumber, sourceType: "credit_note_void_cogs", sourceId: id }, stock.legs, base, base,
        { rateExact: "1", source: "base_inventory", effectiveDate: row.issueDate });
    }
    const allocations = await tx.select().from(paymentAllocation).where(and(eq(paymentAllocation.documentType, "credit_note"), eq(paymentAllocation.documentId, id)));
    const paymentIds = [...new Set(allocations.map(a => a.paymentId))];
    if (paymentIds.length) {
      const carriers = await tx.select().from(payment).where(inArray(payment.id, paymentIds)).for("update");
      if (carriers.length !== paymentIds.length || carriers.some(p => p.organizationId !== ctx.organizationId || p.contactId !== row.contactId || p.currencyCode !== row.currencyCode || p.journalEntryId))
        throw new WireCompatibilityError("Credit allocations contain invalid or foreign carrier payments");
      const all = await tx.select().from(paymentAllocation).where(inArray(paymentAllocation.paymentId, paymentIds));
      let total = 0n; const byInvoice = new Map<string, bigint>();
      for (const carrier of carriers) {
        publicMoneyDto(carrier, ["amount"]);
        const links = all.filter(a => a.paymentId === carrier.id), note = links.filter(a => a.documentType === "credit_note" && a.documentId === id), invoices = links.filter(a => a.documentType === "invoice");
        links.forEach(a => publicMoneyDto(a, ["amount"]));
        if (links.length !== 2 || note.length !== 1 || invoices.length !== 1 || carrier.amount <= 0 || note[0].amount !== carrier.amount || invoices[0].amount !== carrier.amount)
          throw new WireCompatibilityError("Credit carrier allocations must agree");
        total += BigInt(carrier.amount); byInvoice.set(invoices[0].documentId, (byInvoice.get(invoices[0].documentId) ?? 0n) + BigInt(carrier.amount));
      }
      if (safeInvoiceMinor(total) !== row.amountApplied) fail("Credit applied balance does not match allocations");
      for (const [invoiceId, applied] of [...byInvoice].sort(([a], [b]) => a.localeCompare(b))) {
        const inv = await targetInvoice(tx, ctx, invoiceId, row.contactId, row.currencyCode, true);
        await assertNotLocked(ctx.organizationId, inv.issueDate);
        if (inv.status === "void") continue;
        if (applied > BigInt(inv.amountPaid) || safeInvoiceMinor(BigInt(inv.amountPaid) + BigInt(inv.amountDue)) !== inv.total) fail("Invoice balances cannot unwind credit allocation");
        const paid = safeInvoiceMinor(BigInt(inv.amountPaid) - applied), due = safeInvoiceMinor(BigInt(inv.total) - BigInt(paid));
        const status = paid === 0 ? "sent" : due === 0 ? "paid" : "partial";
        await tx.update(invoice).set({ amountPaid: paid, amountDue: due, status, paidAt: status === "paid" ? inv.paidAt : null, updatedAt: new Date() })
          .where(and(eq(invoice.id, inv.id), eq(invoice.organizationId, ctx.organizationId)));
      }
      await tx.delete(payment).where(and(inArray(payment.id, paymentIds), eq(payment.organizationId, ctx.organizationId)));
    } else if (row.amountApplied !== 0) fail("Applied credit note has no carrier allocations");
    const [updated] = await tx.update(creditNote).set({ status: "void", voidedAt: new Date(), amountApplied: 0, amountRemaining: row.total, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { creditNote: creditNoteDto(updated) };
  }); await audit(ctx, "credit_note", id, "void", request); return result;
}
async function reverseJournal(tx: Tx, ctx: AuthContext, row: typeof creditNote.$inferSelect, saved: (typeof journalLine.$inferSelect)[], sourceType: string) {
  await references(tx, ctx.organizationId, row.contactId, saved.map(line => invoiceWriteLineSchema.parse({ ...line, description: "Saved credit journal", quantity: 1 })), true);
  let debit = 0n, credit = 0n;
  for (const line of saved) {
    journalLineDto(line); await activeAccount(tx, ctx, line.accountId);
    if (line.debitAmount < 0 || line.creditAmount < 0) fail("Saved journal contains negative legs");
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit);
  if (debit !== credit) fail("Saved recognition journal does not balance");
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
  if (BigInt(max.value) >= 2147483647n) fail("Journal numbering exceeds int32 capacity");
  const description = `Void credit note ${row.creditNoteNumber}`;
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: Number(BigInt(max.value) + 1n), date: row.issueDate,
    description, reference: row.creditNoteNumber, status: "posted", sourceType, sourceId: row.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(saved.map(line => ({ journalEntryId: reversal.id, accountId: line.accountId, description,
    debitAmount: line.creditAmount, creditAmount: line.debitAmount, currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate, rateExact: line.rateExact, rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion,
    rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance, costCenterId: line.costCenterId, projectId: line.projectId })));
}
