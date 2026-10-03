import { z } from "zod";
import { and, eq, asc, desc, gte, lte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { salesReceipt, salesReceiptLine, organization, numberSequence, bankAccount, chartAccount,
  journalEntry, journalLine, inventoryMovement } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { logAudit } from "./audit";
import { references, taxRates } from "./invoice-writes";
import { safeInvoiceMinor, invoiceRound, type InvoiceWriteLine } from "./invoice-write-wire";
import { receivablePostingRate, postReceivable } from "./invoice-lifecycle";
import { ensureControlAccount } from "./journal-automation";
import { ensureBankLedgerAccount } from "./bank-ledger";
import { invoiceStock } from "./invoice-stock";
import { publicLineDto, publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { contactDto } from "./contact-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { checkMultiCurrency } from "./check-limit";
import { salesReceiptCreateSchema, salesReceiptUpdateSchema, salesReceiptPostSchema, salesReceiptListSchema,
  salesReceiptTotals, salesReceiptDto, salesReceiptBalances } from "./sales-receipt-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Receipt = typeof salesReceipt.$inferSelect;
type Line = typeof salesReceiptLine.$inferSelect;
function fail(message: string): never { throw new AuthError(message, 400); }
const scope = (ctx: AuthContext, id: string) => and(eq(salesReceipt.id, id), eq(salesReceipt.organizationId, ctx.organizationId), isNull(salesReceipt.deletedAt));
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404); return org;
}
function savedInput(lines: Line[]): InvoiceWriteLine[] {
  return lines.map(line => ({ ...line, quantity: line.quantity / 100 }));
}
async function account(tx: Tx, ctx: AuthContext, id: string, historical = false) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!row || (!historical && (!row.isActive || row.deletedAt))) fail("Sales receipt account must belong to this organization and be active");
  return row;
}
async function cashReferences(tx: Tx, ctx: AuthContext, bankId: string | null | undefined, depositId: string | null | undefined, historical = false) {
  let bank;
  if (bankId) {
    [bank] = await tx.select().from(bankAccount).where(and(eq(bankAccount.id, bankId), eq(bankAccount.organizationId, ctx.organizationId))).for("update");
    if (!bank || (!historical && bank.deletedAt)) fail("Sales receipt bank must belong to this organization and be available");
    if (bank.chartAccountId) await account(tx, ctx, bank.chartAccountId, historical);
  }
  if (depositId) await account(tx, ctx, depositId, historical);
  return bank;
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id); const org = await lockOrg(tx, ctx);
  const [row] = await tx.select().from(salesReceipt).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Sales receipt not found", 404);
  salesReceiptDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.date);
  const lines = await tx.select().from(salesReceiptLine).where(eq(salesReceiptLine.salesReceiptId, id)).orderBy(salesReceiptLine.sortOrder, salesReceiptLine.id);
  salesReceiptBalances(row, lines);
  await references(tx, ctx.organizationId, row.contactId, savedInput(lines), true);
  await cashReferences(tx, ctx, row.bankAccountId, row.depositAccountId, true);
  return { row, org, lines };
}
async function number(tx: Tx, ctx: AuthContext) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, ctx.organizationId), eq(numberSequence.entityType, "sales_receipt"))).for("update");
  const [max] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${salesReceipt.receiptNumber}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(salesReceipt).where(eq(salesReceipt.organizationId, ctx.organizationId));
  const value = BigInt(sequence?.lastNumber ?? max.value) + 1n;
  if (value < 1n || value > 2147483647n) fail("Sales receipt numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: ctx.organizationId, entityType: "sales_receipt", prefix: "SR", lastNumber: Number(value) });
  return `SR-${String(value).padStart(5, "0")}`;
}
async function audit(ctx: AuthContext, id: string, action: string, request?: Request) {
  await logAudit({ ctx, action, entityType: "sales_receipt", entityId: id, request });
}

export async function listSalesReceipts(ctx: AuthContext, input: unknown) {
  const parsed = salesReceiptListSchema.parse(input);
  const conditions = and(eq(salesReceipt.organizationId, ctx.organizationId), isNull(salesReceipt.deletedAt),
    parsed.status ? eq(salesReceipt.status, parsed.status) : undefined, parsed.contactId ? eq(salesReceipt.contactId, parsed.contactId) : undefined,
    parsed.startDate ? gte(salesReceipt.date, parsed.startDate) : undefined, parsed.endDate ? lte(salesReceipt.date, parsed.endDate) : undefined);
  const column = { date: salesReceipt.date, total: salesReceipt.total, number: salesReceipt.receiptNumber, created: salesReceipt.createdAt }[parsed.sortBy];
  return db.transaction(async tx => {
    const rows = await tx.query.salesReceipt.findMany({ where: conditions, with: { contact: true },
      orderBy: [parsed.sortOrder === "asc" ? asc(column) : desc(column), asc(salesReceipt.id)], limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit });
    const [count] = await tx.select({ value: sql<number>`count(*)`.mapWith(Number) }).from(salesReceipt).where(conditions);
    const receipts = rows.map(row => {
      if (row.contact && row.contact.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Sales receipt contact is outside this organization");
      return { ...salesReceiptDto(row), contact: row.contact ? contactDto(row.contact) : null };
    });
    stringifyWire(receipts); return { salesReceipts: receipts, total: count.value };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getSalesReceipt(ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  return db.transaction(async tx => {
    const row = await tx.query.salesReceipt.findFirst({ where: scope(ctx, id), with: { contact: true,
      lines: { with: { account: true, taxRate: true } }, bankAccount: true, depositAccount: true, journalEntry: true } });
    if (!row) throw new AuthError("Sales receipt not found", 404);
    for (const related of [row.contact, row.bankAccount, row.depositAccount, row.journalEntry,
      ...row.lines.flatMap(line => [line.account, line.taxRate])]) {
      if (related && related.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Sales receipt contains a reference outside this organization");
    }
    await references(tx, ctx.organizationId, row.contactId, savedInput(row.lines), true);
    await cashReferences(tx, ctx, row.bankAccountId, row.depositAccountId, true);
    if (row.journalEntry && (row.journalEntry.sourceType !== "sales_receipt" ||
      (row.journalEntry.sourceId !== null ? row.journalEntry.sourceId !== id : row.journalEntry.reference !== row.receiptNumber)))
      throw new WireCompatibilityError("Sales receipt journal belongs to another document");
    const bank = row.bankAccount ? { ...publicMoneyDto(row.bankAccount, ["balance"]),
      lowBalanceThresholdMinor: row.bankAccount.lowBalanceThreshold === null ? null : publicMoneyDto(row.bankAccount, ["lowBalanceThreshold"]).lowBalanceThresholdMinor } : null;
    const result = { salesReceipt: { ...salesReceiptDto(row), contact: row.contact ? contactDto(row.contact) : null,
      lines: row.lines.map(publicLineDto), bankAccount: bank } };
    salesReceiptBalances(row, row.lines); stringifyWire(result); return result;
  });
}
export async function createSalesReceipt(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices"); const parsed = salesReceiptCreateSchema.parse(input);
  const result = await db.transaction(async tx => {
    const org = await lockOrg(tx, ctx);
    const customer = await references(tx, ctx.organizationId, parsed.contactId, parsed.lines);
    await cashReferences(tx, ctx, parsed.bankAccountId, parsed.depositAccountId);
    await assertNotLocked(ctx.organizationId, parsed.date);
    const currencyCode = currencyCodeSchema.parse(parsed.currencyCode ?? customer.currencyCode ?? org.defaultCurrency ?? "USD");
    await checkMultiCurrency(ctx.organizationId, currencyCode);
    const totals = salesReceiptTotals(parsed.lines, currencyCode, await taxRates(tx, parsed.lines));
    const [row] = await tx.insert(salesReceipt).values({ organizationId: ctx.organizationId, contactId: parsed.contactId,
      receiptNumber: await number(tx, ctx), date: parsed.date, reference: parsed.reference || null, notes: parsed.notes || null,
      currencyCode, bankAccountId: parsed.bankAccountId ?? null, depositAccountId: parsed.depositAccountId ?? null,
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, createdBy: ctx.userId }).returning();
    await tx.insert(salesReceiptLine).values(totals.processedLines.map(line => ({ ...line, salesReceiptId: row.id })));
    return { salesReceipt: salesReceiptDto(row) };
  }); await audit(ctx, result.salesReceipt.id, "create", request); return result;
}
export async function updateSalesReceipt(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices"); const parsed = salesReceiptUpdateSchema.parse(input);
  const result = await db.transaction(async tx => {
    const { row } = await load(tx, ctx, id);
    if (row.status !== "draft" || row.journalEntryId) fail("Only unposted draft sales receipts can be edited");
    await assertNotLocked(ctx.organizationId, row.date); await assertNotLocked(ctx.organizationId, parsed.date ?? row.date);
    const contactId = parsed.contactId ?? row.contactId, currencyCode = parsed.currencyCode ?? row.currencyCode;
    await references(tx, ctx.organizationId, contactId, parsed.lines ?? []);
    await checkMultiCurrency(ctx.organizationId, currencyCode);
    await cashReferences(tx, ctx, parsed.bankAccountId === undefined ? row.bankAccountId : parsed.bankAccountId,
      parsed.depositAccountId === undefined ? row.depositAccountId : parsed.depositAccountId);
    const { lines: replacement, ...patch } = parsed;
    const totals = replacement ? salesReceiptTotals(replacement, currencyCode, await taxRates(tx, replacement)) : undefined;
    if (totals) {
      await tx.delete(salesReceiptLine).where(eq(salesReceiptLine.salesReceiptId, id));
      await tx.insert(salesReceiptLine).values(totals.processedLines.map(line => ({ ...line, salesReceiptId: id })));
    }
    const [updated] = await tx.update(salesReceipt).set({ ...patch, ...(totals ? { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total } : {}), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { salesReceipt: salesReceiptDto(updated) };
  }); await audit(ctx, id, "update", request); return result;
}
export async function deleteSalesReceipt(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const result = await db.transaction(async tx => {
    const { row } = await load(tx, ctx, id);
    if (row.status !== "draft" || row.journalEntryId) fail("Only unposted draft sales receipts can be deleted");
    await assertNotLocked(ctx.organizationId, row.date);
    await tx.update(salesReceipt).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id));
    return { success: true };
  }); await audit(ctx, id, "delete", request); return result;
}
export async function postSalesReceipt(ctx: AuthContext, id: string, input: unknown = {}, request?: Request) {
  requireRole(ctx, "approve:invoices"); const parsed = salesReceiptPostSchema.parse(input);
  const result = await db.transaction(async tx => {
    const { row, org, lines } = await load(tx, ctx, id);
    if (row.status !== "draft" || row.journalEntryId) fail("Only unposted draft sales receipts can be posted");
    await assertNotLocked(ctx.organizationId, row.date);
    await references(tx, ctx.organizationId, row.contactId, savedInput(lines));
    if (!lines.length || row.total <= 0 || lines.some(line => !line.accountId || line.amount < 0 || line.taxAmount < 0))
      fail("Posting requires positive receipt totals and nonnegative lines with active revenue accounts");
    const bankId = parsed.bankAccountId === undefined ? row.bankAccountId : parsed.bankAccountId;
    const depositId = parsed.depositAccountId === undefined ? row.depositAccountId : parsed.depositAccountId;
    const bank = await cashReferences(tx, ctx, bankId, depositId);
    const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD");
    if (bank && bank.currencyCode !== row.currencyCode) throw new WireCompatibilityError("Sales receipt bank currency must match the receipt; no implicit cash FX");
    const fx = await receivablePostingRate(ctx, row.currencyCode, base, row.date);
    const cashId = bank ? await ensureBankLedgerAccount(ctx.organizationId, bank, tx) : depositId ?? (await ensureControlAccount(ctx.organizationId, "undepositedFunds", base, tx))?.id;
    if (!cashId) fail("Sales receipt cash account unavailable"); await account(tx, ctx, cashId);
    const legs = lines.map(line => ({ accountId: line.accountId!, debitAmount: 0, creditAmount: line.amount, costCenterId: line.costCenterId, projectId: line.projectId }));
    if (row.taxTotal > 0) {
      const vat = await ensureControlAccount(ctx.organizationId, "outputVat", base, tx);
      if (!vat) fail("Sales receipt output tax account unavailable"); await account(tx, ctx, vat.id);
      legs.push({ accountId: vat.id, debitAmount: 0, creditAmount: row.taxTotal, costCenterId: null, projectId: null });
    }
    const entry = await postReceivable(tx, ctx, { date: row.date, description: `Sales receipt ${row.receiptNumber}`, reference: row.receiptNumber,
      sourceType: "sales_receipt", sourceId: id }, [{ accountId: cashId, debitAmount: row.total, creditAmount: 0 }, ...legs], row.currencyCode, base, fx);
    const stock = await invoiceStock(tx, ctx, base, id, lines);
    if (stock.legs.some(leg => leg.debitAmount || leg.creditAmount)) {
      const cogs = await postReceivable(tx, ctx, { date: row.date, description: `Cost of sales ${row.receiptNumber}`, reference: row.receiptNumber,
        sourceType: "sales_receipt_cogs", sourceId: id }, stock.legs, base, base, { rateExact: "1", source: "same", effectiveDate: row.date });
      await tx.update(inventoryMovement).set({ journalEntryId: cogs.id }).where(inArray(inventoryMovement.id, stock.movements));
    }
    const [updated] = await tx.update(salesReceipt).set({ status: "paid", journalEntryId: entry.id, bankAccountId: bankId,
      depositAccountId: depositId, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { salesReceipt: salesReceiptDto(updated) };
  }); await audit(ctx, id, "post", request); return result;
}

async function reverse(tx: Tx, ctx: AuthContext, row: Receipt, id: string, cogs = false) {
  const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt))).for("update");
  if (!entry || entry.status !== "posted" || entry.reversedByEntryId || entry.sourceType !== (cogs ? "sales_receipt_cogs" : "sales_receipt") ||
    (entry.sourceId !== null ? entry.sourceId !== row.id : entry.reference !== row.receiptNumber)) throw new WireCompatibilityError("Saved receipt journal is unavailable, reversed or belongs to another document");
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
  if (!lines.length) fail("Saved receipt journal has no lines");
  let debit = 0n, credit = 0n;
  for (const line of lines) {
    journalLineDto(line); await account(tx, ctx, line.accountId, true);
    await references(tx, ctx.organizationId, row.contactId, [{ description: "Saved journal", quantity: 1, discountPercent: 0,
      costCenterId: line.costCenterId, projectId: line.projectId }], true);
    if (!line.rateExact || line.rateMigrationStatus !== "exact" || line.rateDirection !== "quote_per_base" || line.rateFormatVersion !== 1)
      throw new WireCompatibilityError("Receipt reversal requires qualified saved transaction FX");
    if (line.debitAmount < 0 || line.creditAmount < 0) fail("Saved receipt journal contains negative legs");
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit);
  if (debit !== credit) fail("Saved receipt journal must balance");
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
  if (BigInt(max.value) >= 2147483647n) fail("Journal numbering exceeds int32 capacity");
  const description = `Void sales receipt ${row.receiptNumber}`;
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: Number(BigInt(max.value) + 1n), date: row.date,
    description, reference: row.receiptNumber, status: "posted", sourceType: cogs ? "sales_receipt_void_cogs" : "sales_receipt_void", sourceId: row.id,
    reversesEntryId: id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(lines.map(line => ({ journalEntryId: reversal.id, accountId: line.accountId, description,
    debitAmount: line.creditAmount, creditAmount: line.debitAmount, currencyCode: line.currencyCode, exchangeRate: line.exchangeRate,
    rateExact: line.rateExact, rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion, rateMigrationStatus: line.rateMigrationStatus,
    rateProvenance: line.rateProvenance, costCenterId: line.costCenterId, projectId: line.projectId })));
  await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() }).where(eq(journalEntry.id, id));
  return reversal;
}
export async function voidSalesReceipt(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:invoices");
  const result = await db.transaction(async tx => {
    const { row, org, lines } = await load(tx, ctx, id);
    if (row.status === "void") fail("Already voided");
    await assertNotLocked(ctx.organizationId, row.date);
    if ((row.status === "draft" && row.journalEntryId) || (row.status === "paid" && !row.journalEntryId))
      throw new WireCompatibilityError("Receipt status and recognition journal disagree");
    if (row.journalEntryId) {
      // Unsupported unlinked historical inventory is rejected rather than valued at today's cost.
      const expected = lines.flatMap(line => {
        const units = Number(invoiceRound(BigInt(line.quantity), 100n));
        return line.inventoryItemId && units > 0 ? [`${line.inventoryItemId}/${line.warehouseId ?? ""}/${-units}`] : [];
      }).sort();
      const saved = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
        eq(inventoryMovement.referenceId, id), eq(inventoryMovement.referenceType, "sale")));
      const actual = saved.map(issue => `${issue.inventoryItemId}/${issue.warehouseId ?? ""}/${issue.quantity}`).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual))
        throw new WireCompatibilityError("Receipt stock reversal requires matching linked saved issues; historical unlinked stock needs qualification");
      const originals = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "sales_receipt_cogs"), eq(journalEntry.sourceId, id)));
      for (const issue of saved) {
        if (issue.value > 0 || issue.unitCost < 0 || (issue.value !== 0 && !issue.journalEntryId) ||
          (issue.journalEntryId && !originals.some(entry => entry.id === issue.journalEntryId)))
          throw new WireCompatibilityError("Receipt saved stock costs require their own COGS journal");
      }
      for (const entry of originals) {
        const legs = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
        legs.forEach(leg => journalLineDto(leg));
        const cost = safeInvoiceMinor(saved.filter(issue => issue.journalEntryId === entry.id).reduce((sum, issue) => sum - BigInt(issue.value), 0n));
        if (cost !== safeInvoiceMinor(legs.reduce((sum, leg) => sum + BigInt(leg.debitAmount), 0n)) ||
          legs.some(leg => leg.currencyCode !== (org.defaultCurrency ?? "USD") || leg.exchangeRate !== 1000000))
          throw new WireCompatibilityError("Receipt saved COGS and stock values/base currency must agree");
      }
      await reverse(tx, ctx, row, row.journalEntryId);
      const stock = await invoiceStock(tx, ctx, org.defaultCurrency ?? "USD", id, lines, true);
      if (stock.legs.some(leg => leg.debitAmount || leg.creditAmount) && !originals.length) throw new WireCompatibilityError("Receipt saved COGS journal unavailable");
      for (const original of originals) {
        const reversal = await reverse(tx, ctx, row, original.id, true);
        if (stock.movements.length) await tx.update(inventoryMovement).set({ journalEntryId: reversal.id }).where(inArray(inventoryMovement.id, stock.movements));
      }
    }
    const [updated] = await tx.update(salesReceipt).set({ status: "void", voidedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    return { salesReceipt: salesReceiptDto(updated) };
  }); await audit(ctx, id, "void", request); return result;
}
