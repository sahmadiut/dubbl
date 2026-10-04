import { z } from "zod";
import { and, eq, asc, desc, gte, lte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { debitNote, debitNoteLine, bill, billLine, organization, numberSequence, payment, paymentAllocation,
  journalEntry, journalLine, chartAccount, inventoryMovement, inventoryCostLayer, auditLog, inventoryItem, warehouse, taxRate } from "@/lib/db/schema";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { references, taxRates } from "./invoice-writes";
import { invoiceWriteLineSchema, safeInvoiceMinor } from "./invoice-write-wire";
import { receivablePostingRate, postReceivable, receivableAccount } from "./invoice-lifecycle";
import { ensureControlAccount } from "./journal-automation";
import { billWriteDto } from "./bill-write-wire";
import { billSettlementBalances } from "./bill-lifecycle-wire";
import { billStockMovement } from "./bill-stock";
import { publicLineDto, publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { creditAmount } from "./credit-wire";
import { debitNoteCreateFields, debitNoteMcpCreateFields, debitNoteUpdateFields, debitNoteMcpUpdateFields,
  debitNoteApplyFields, debitNoteListFields, debitNoteTotals, debitNoteDto, debitNoteRelations, debitNoteBalances } from "./debit-note-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Note = typeof debitNote.$inferSelect;
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
const scope = (ctx: AuthContext, id: string) => and(eq(debitNote.id, id), eq(debitNote.organizationId, ctx.organizationId), notDeleted(debitNote.deletedAt));
async function lockOrg(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  currencyCodeSchema.parse(org.defaultCurrency ?? "USD"); return org;
}
async function nextNumber(tx: Tx, ctx: AuthContext, kind: "debit_note" | "payment") {
  const [seq] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, ctx.organizationId), eq(numberSequence.entityType, kind))).for("update");
  const table = kind === "debit_note" ? debitNote : payment;
  const column = kind === "debit_note" ? debitNote.debitNoteNumber : payment.paymentNumber;
  const [max] = seq ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${column}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(table).where(eq(table.organizationId, ctx.organizationId));
  const value = BigInt(seq?.lastNumber ?? max.value) + 1n, prefix = kind === "debit_note" ? "DN" : "PAY";
  if (value < 1n || value > 2147483647n) unsupported("Debit-note/payment numbering exceeds int32 capacity");
  if (seq) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, seq.id));
  else await tx.insert(numberSequence).values({ organizationId: ctx.organizationId, entityType: kind, prefix, lastNumber: Number(value) });
  return `${prefix}-${String(value).padStart(5, "0")}`;
}
async function targetBill(tx: Tx, ctx: AuthContext, id: string, supplier: string, currency: string) {
  const [row] = await tx.select().from(bill).where(and(eq(bill.id, id), eq(bill.organizationId, ctx.organizationId), notDeleted(bill.deletedAt))).for("update");
  if (!row) throw new AuthError("Bill not found", 404);
  billWriteDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  if (row.contactId !== supplier || row.currencyCode !== currency) fail("Debit note and bill must have the same supplier and currency");
  return row;
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id); const org = await lockOrg(tx, ctx);
  const [row] = await tx.select().from(debitNote).where(scope(ctx, id)).for("update");
  if (!row) throw new AuthError("Debit note not found", 404);
  debitNoteDto(row); currencyCodeSchema.parse(row.currencyCode); rateDateSchema.parse(row.issueDate);
  const lines = await tx.select().from(debitNoteLine).where(eq(debitNoteLine.debitNoteId, id)).orderBy(debitNoteLine.sortOrder, debitNoteLine.id);
  debitNoteBalances(row, lines);
  await references(tx, ctx.organizationId, row.contactId, lines.map(line => invoiceWriteLineSchema.parse({ ...line, quantity: line.quantity / 100 })), true);
  if (row.billId) await targetBill(tx, ctx, row.billId, row.contactId, row.currencyCode);
  if (row.amountApplied < 0 || row.amountRemaining < 0 || (row.status === "draft" && (row.amountApplied || row.amountRemaining || row.journalEntryId)) ||
    (["sent", "applied"].includes(row.status) && (row.total <= 0 || !row.journalEntryId || safeInvoiceMinor(BigInt(row.amountApplied) + BigInt(row.amountRemaining)) !== row.total)))
    unsupported("Debit-note saved state/balances are inconsistent");
  return { row, org, lines };
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "debit_note", entityId: id, action,
    ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request?.headers.get("user-agent") || null });
}
async function update(tx: Tx, ctx: AuthContext, id: string, patch: Partial<typeof debitNote.$inferInsert>) {
  const [row] = await tx.update(debitNote).set({ ...patch, updatedAt: new Date() }).where(scope(ctx, id)).returning();
  const result = debitNoteDto(row); stringifyWire(result); return result;
}
export async function listDebitNotes(ctx: AuthContext, input: unknown) {
  const p = z.object(debitNoteListFields).strict().parse(input);
  return db.transaction(async tx => {
    const where = and(eq(debitNote.organizationId, ctx.organizationId), notDeleted(debitNote.deletedAt),
      p.status ? eq(debitNote.status, p.status) : undefined, p.contactId ? eq(debitNote.contactId, p.contactId) : undefined,
      p.startDate ? gte(debitNote.issueDate, p.startDate) : undefined, p.endDate ? lte(debitNote.issueDate, p.endDate) : undefined);
    const column = p.sortBy === "date" ? debitNote.issueDate : p.sortBy === "total" ? debitNote.total : p.sortBy === "number" ? debitNote.debitNoteNumber : debitNote.createdAt;
    const rows = await tx.query.debitNote.findMany({ where, with: { contact: true }, orderBy: [p.sortOrder === "asc" ? asc(column) : desc(column), asc(debitNote.id)], limit: p.limit, offset: (p.page - 1) * p.limit });
    const [count] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(debitNote).where(where);
    return { rows: rows.map(row => debitNoteRelations(debitNoteDto(row), ctx.organizationId)), total: count.count };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getDebitNote(ctx: AuthContext, id: string) {
  return db.transaction(async tx => {
    await load(tx, ctx, id);
    const row = await tx.query.debitNote.findFirst({ where: scope(ctx, id), with: { contact: true, lines: { with: { account: true, taxRate: true } }, journalEntry: true } });
    if (!row) throw new AuthError("Debit note not found", 404);
    if (row.journalEntry && (row.journalEntry.sourceType !== "debit_note" ||
      (row.journalEntry.sourceId !== null ? row.journalEntry.sourceId !== id : row.journalEntry.reference !== row.debitNoteNumber)))
      unsupported("Debit-note journal is not qualified for this document");
    return { debitNote: debitNoteRelations(debitNoteDto(row), ctx.organizationId) };
  });
}
export async function createDebitNote(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:debit-notes");
  const p = z.object(transport === "rest" ? debitNoteCreateFields : debitNoteMcpCreateFields).strict().parse(input);
  return db.transaction(async tx => {
    await lockOrg(tx, ctx); await assertNotLocked(ctx.organizationId, p.issueDate);
    const lines = p.lines.map(line => invoiceWriteLineSchema.parse(line));
    await references(tx, ctx.organizationId, p.contactId, lines);
    if (p.billId) await targetBill(tx, ctx, p.billId, p.contactId, p.currencyCode);
    const totals = debitNoteTotals(p.lines, transport, p.currencyCode, await taxRates(tx, lines));
    const [row] = await tx.insert(debitNote).values({ organizationId: ctx.organizationId, contactId: p.contactId, billId: p.billId ?? null,
      debitNoteNumber: await nextNumber(tx, ctx, "debit_note"), issueDate: p.issueDate, currencyCode: p.currencyCode, reference: p.reference ?? null,
      notes: p.notes ?? null, subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total, createdBy: ctx.userId }).returning();
    await tx.insert(debitNoteLine).values(totals.processedLines.map(line => ({ ...line, debitNoteId: row.id })));
    const result = { debitNote: debitNoteDto(row) }; stringifyWire(result); await audit(tx, ctx, row.id, "create", request); return result;
  });
}
export async function updateDebitNote(ctx: AuthContext, id: string, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:debit-notes");
  const p = z.object(transport === "rest" ? debitNoteUpdateFields : debitNoteMcpUpdateFields).strict().parse(input);
  return db.transaction(async tx => {
    const { row } = await load(tx, ctx, id); if (row.status !== "draft") fail("Only draft debit notes can be edited");
    await assertNotLocked(ctx.organizationId, row.issueDate); await assertNotLocked(ctx.organizationId, p.issueDate ?? row.issueDate);
    const supplier = p.contactId ?? row.contactId, currency = p.currencyCode ?? row.currencyCode, link = p.billId === undefined ? row.billId : p.billId;
    await references(tx, ctx.organizationId, supplier, []); if (link) await targetBill(tx, ctx, link, supplier, currency);
    const patch: Partial<typeof debitNote.$inferInsert> = { contactId: supplier, currencyCode: currency, billId: link, issueDate: p.issueDate ?? row.issueDate,
      ...(p.reference !== undefined ? { reference: p.reference } : {}), ...(p.notes !== undefined ? { notes: p.notes } : {}) };
    if (p.lines) {
      const lines = p.lines.map(line => invoiceWriteLineSchema.parse(line)); await references(tx, ctx.organizationId, supplier, lines);
      const totals = debitNoteTotals(p.lines, transport, currency, await taxRates(tx, lines));
      Object.assign(patch, { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total });
      await tx.delete(debitNoteLine).where(eq(debitNoteLine.debitNoteId, id));
      await tx.insert(debitNoteLine).values(totals.processedLines.map(line => ({ ...line, debitNoteId: id })));
    }
    const result = { debitNote: await update(tx, ctx, id, patch) }; await audit(tx, ctx, id, "update", request); return result;
  });
}
export async function deleteDebitNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:debit-notes"); return db.transaction(async tx => {
    const { row } = await load(tx, ctx, id); if (row.status !== "draft") fail("Only draft debit notes can be deleted");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    await tx.update(debitNote).set({ ...softDelete(), updatedAt: new Date() }).where(scope(ctx, id));
    await audit(tx, ctx, id, "delete", request); return { success: true };
  });
}
async function ownedAccount(tx: Tx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!row) unsupported("Debit-note account belongs to another organization"); return row;
}
async function savedJournal(tx: Tx, ctx: AuthContext, id: string | null, source: string, documentId: string, currency: string, supplier: string) {
  const [entry] = id ? await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId))).for("update") : [];
  if (!entry || entry.status !== "posted" || entry.deletedAt || entry.reversedByEntryId || entry.sourceType !== source || entry.sourceId !== documentId)
    unsupported("Debit-note operation requires qualified unreversed recognition history");
  const lines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).orderBy(journalLine.id);
  if (!lines.length) unsupported("Recognition journal has no lines");
  let debit = 0n, credit = 0n;
  const first = lines[0];
  for (const line of lines) {
    journalLineDto(line); await ownedAccount(tx, ctx, line.accountId);
    if (line.currencyCode !== currency || !line.rateExact || line.rateExact !== first.rateExact || line.rateDirection !== "quote_per_base" ||
      line.rateFormatVersion !== 1 || line.rateMigrationStatus !== "exact" || toLegacyRate(line.rateExact) !== line.exchangeRate || line.debitAmount < 0 || line.creditAmount < 0)
      unsupported("Recognition journal requires consistent saved exact transaction FX");
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit); if (debit !== credit) unsupported("Recognition journal does not balance");
  await references(tx, ctx.organizationId, supplier,
    lines.map(line => invoiceWriteLineSchema.parse({ ...line, description: "Saved debit journal", quantity: 1 })), true);
  return { entry, lines, rateExact: first.rateExact! };
}
async function mirrorJournal(tx: Tx, ctx: AuthContext, note: Note, saved: Awaited<ReturnType<typeof savedJournal>>, source: string, markReversed: boolean) {
  await assertNotLocked(ctx.organizationId, saved.entry.date);
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
  const next = BigInt(max.value) + 1n; if (next > 2147483647n) unsupported("Journal numbering exceeds int32 capacity");
  const [entry] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: Number(next), date: note.issueDate,
    description: `${source} ${note.debitNoteNumber}`, reference: note.debitNoteNumber, sourceType: source, sourceId: note.id,
    status: "posted", postedAt: new Date(), createdBy: ctx.userId, reversesEntryId: markReversed ? saved.entry.id : null }).returning();
  await tx.insert(journalLine).values(saved.lines.map(line => ({
    journalEntryId: entry.id, accountId: line.accountId, description: `${source} ${note.debitNoteNumber}`,
    debitAmount: line.creditAmount, creditAmount: line.debitAmount, currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate, rateExact: line.rateExact, rateDirection: line.rateDirection,
    rateFormatVersion: line.rateFormatVersion, rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance,
    costCenterId: line.costCenterId, projectId: line.projectId })));
  if (markReversed) await tx.update(journalEntry).set({ reversedByEntryId: entry.id, updatedAt: new Date() }).where(eq(journalEntry.id, saved.entry.id));
  return entry;
}

export async function sendDebitNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:debit-notes"); return db.transaction(async tx => {
    const { row, org, lines } = await load(tx, ctx, id);
    if (row.status !== "draft") fail("Only draft debit notes can be sent");
    if (row.total <= 0 || !lines.length || lines.some(line => line.amount < 0 || line.taxAmount < 0 || line.quantity < 0 || line.unitPrice < 0)) fail("Sending requires a positive total and nonnegative lines");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    const base = org.defaultCurrency ?? "USD";
    const linked = row.billId ? await targetBill(tx, ctx, row.billId, row.contactId, row.currencyCode) : null;
    if (linked && (!["received", "partial", "paid", "overdue"].includes(linked.status) || safeInvoiceMinor(BigInt(linked.amountPaid) + BigInt(linked.amountDue)) !== linked.total))
      unsupported("Debit-note linked bill requires recognized tax-inclusive supplier payable");
    const original = linked ? await savedJournal(tx, ctx, linked.journalEntryId, "bill", linked.id, linked.currencyCode, row.contactId) : null;
    const originalLines = linked ? await tx.select().from(billLine).where(eq(billLine.billId, linked.id)).orderBy(billLine.sortOrder, billLine.id) : [];
    originalLines.forEach(publicLineDto);
    if (linked) await references(tx, ctx.organizationId, row.contactId, originalLines.map(line => invoiceWriteLineSchema.parse({ ...line, quantity: line.quantity / 100 })), true);
    const stock = originalLines.some(line => line.inventoryItemId || line.goodsReceiptLineId);
    let entry;
    if (stock) {
      // Debit-note lines have no stock dimension. Only a complete, unambiguous
      // original receipt return can be represented without inventing a mapping.
      if (!linked || !original || linked.status === "void" || row.total !== linked.total || row.subtotal !== linked.subtotal || row.taxTotal !== linked.taxTotal ||
        originalLines.length !== lines.length || originalLines.some((line, i) => line.goodsReceiptLineId || line.amount !== lines[i].amount ||
          line.taxAmount !== lines[i].taxAmount || line.quantity !== lines[i].quantity || line.accountId !== lines[i].accountId ||
          line.taxRateId !== lines[i].taxRateId || line.costCenterId !== lines[i].costCenterId))
        unsupported("Stock debit notes require a complete matching non-GRNI bill return; partial stock/GRNI returns need separate qualification");
      const others = await tx.select({ id: debitNote.id }).from(debitNote).where(and(eq(debitNote.organizationId, ctx.organizationId), eq(debitNote.billId, linked.id),
        inArray(debitNote.status, ["sent", "applied"]), notDeleted(debitNote.deletedAt)));
      if (others.length) fail("Linked stock bill already has an active debit note");
      const movements = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId), eq(inventoryMovement.referenceId, linked.id), eq(inventoryMovement.referenceType, "bill"))).for("update");
      const expected = originalLines.filter(line => line.inventoryItemId && line.quantity >= 50).map(line => `${line.inventoryItemId}/${line.warehouseId ?? ""}/${Math.floor((line.quantity + 50) / 100)}`).sort();
      const actual = movements.map(m => `${m.inventoryItemId}/${m.warehouseId ?? ""}/${m.quantity}`).sort();
      if (!movements.length || JSON.stringify(expected) !== JSON.stringify(actual) || movements.some(m => m.quantity <= 0 || m.journalEntryId !== original.entry.id)) unsupported("Linked bill stock history is unqualified");
      for (const m of movements) {
        const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, m.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
        const [store] = m.warehouseId ? await tx.select({ id: warehouse.id }).from(warehouse).where(and(eq(warehouse.id, m.warehouseId), eq(warehouse.organizationId, ctx.organizationId))) : [];
        if (!item || item.deletedAt || !item.isActive || item.trackingMethod !== "none" || !["average", "fifo"].includes(item.costMethod) || (m.warehouseId && !store))
          unsupported("Debit-note stock return requires organization-owned untracked average/FIFO receipts");
      }
      entry = await mirrorJournal(tx, ctx, row, original, "debit_note", false);
      for (const m of movements) {
        const returned = await billStockMovement(tx, ctx, { billId: id, itemId: m.inventoryItemId, warehouseId: m.warehouseId, quantity: -m.quantity,
          value: safeInvoiceMinor(-BigInt(m.value)), journalEntryId: entry.id, reverseMovementId: m.id });
        await tx.update(inventoryMovement).set({ referenceType: "debit_note" }).where(eq(inventoryMovement.id, returned.id));
      }
    } else {
      // Standard fully recoverable input VAT is supported here. Reverse charge /
      // partial recoverability need a payable-specific header, not total-as-credit.
      const taxIds = [...new Set(lines.flatMap(line => line.taxRateId ? [line.taxRateId] : []))];
      const taxes = taxIds.length ? await tx.select().from(taxRate).where(inArray(taxRate.id, taxIds)) : [];
      if (taxes.some(tax => tax.kind === "reverse_charge" || tax.recoverablePercent !== 10000)) unsupported("Debit notes require standard fully recoverable input VAT");
      if (linked && safeInvoiceMinor(BigInt(linked.amountPaid) + BigInt(linked.amountDue)) !== linked.total) unsupported("Debit-note linked payable differs from the tax-inclusive document total");
      const ap = await receivableAccount(tx, ctx.organizationId, "2100");
      const legs = [];
      for (const line of lines) {
        if (!line.accountId && line.amount) fail("Debit-note expense line requires an account");
        if (line.accountId) { const account = await ownedAccount(tx, ctx, line.accountId); if (!account.isActive || account.deletedAt) fail("Debit-note account is unavailable");
          legs.push({ accountId: line.accountId, debitAmount: 0, creditAmount: line.amount, costCenterId: line.costCenterId }); }
      }
      if (row.taxTotal) {
        const vat = await ensureControlAccount(ctx.organizationId, "inputVat", base, tx);
        if (!vat || !vat.isActive || vat.deletedAt) fail("Input VAT account unavailable");
        legs.push({ accountId: vat.id, debitAmount: 0, creditAmount: row.taxTotal });
      }
      legs.push({ accountId: ap.id, debitAmount: row.total, creditAmount: 0 });
      const fx = original ? { rateExact: original.rateExact, source: "saved_bill_recognition", effectiveDate: row.issueDate } : await receivablePostingRate(ctx, row.currencyCode, base, row.issueDate);
      entry = await postReceivable(tx, ctx, { date: row.issueDate, description: `Debit note ${row.debitNoteNumber}`, reference: row.debitNoteNumber, sourceType: "debit_note", sourceId: id }, legs, row.currencyCode, base, fx);
    }
    const result = { debitNote: await update(tx, ctx, id, { status: "sent", sentAt: new Date(), amountRemaining: row.total, journalEntryId: entry.id }) };
    await audit(tx, ctx, id, "send", request); return result;
  });
}

export async function applyDebitNote(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:debit-notes"); const p = z.object(debitNoteApplyFields).strict().parse(input), amount = creditAmount(p);
  return db.transaction(async tx => {
    const { row } = await load(tx, ctx, id); if (row.status !== "sent") fail("Only sent debit notes with remaining credit can be applied");
    const target = await targetBill(tx, ctx, p.billId, row.contactId, row.currencyCode), balances = billSettlementBalances(target, amount);
    if (amount > row.amountRemaining) fail("Amount exceeds debit-note remaining balance");
    const recognized = await savedJournal(tx, ctx, row.journalEntryId, "debit_note", id, row.currencyCode, row.contactId);
    const payable = await savedJournal(tx, ctx, target.journalEntryId, "bill", target.id, target.currencyCode, row.contactId);
    const ap = await receivableAccount(tx, ctx.organizationId, "2100");
    if (recognized.rateExact !== payable.rateExact || !recognized.lines.some(line => line.accountId === ap.id && line.debitAmount > 0) ||
      !payable.lines.some(line => line.accountId === ap.id && line.creditAmount > 0)) unsupported("Debit-note allocation requires matching saved AP account and carrying FX; differing-FX settlement remains MON-021");
    const noteAp = recognized.lines.filter(line => line.accountId === ap.id).reduce((sum, line) => sum + BigInt(line.debitAmount) - BigInt(line.creditAmount), 0n);
    const billAp = payable.lines.filter(line => line.accountId === ap.id).reduce((sum, line) => sum + BigInt(line.creditAmount) - BigInt(line.debitAmount), 0n);
    const billPayable = BigInt(target.amountPaid) + BigInt(target.amountDue);
    if (noteAp <= 0n || billAp <= 0n || noteAp * billPayable !== billAp * BigInt(row.total))
      unsupported("Debit-note/bill proportional AP carrying values differ; rounded-FX settlement remains MON-021");
    await assertNotLocked(ctx.organizationId, row.issueDate); await assertNotLocked(ctx.organizationId, target.issueDate);
    const remaining = safeInvoiceMinor(BigInt(row.amountRemaining) - BigInt(amount)), applied = safeInvoiceMinor(BigInt(row.amountApplied) + BigInt(amount));
    const [carrier] = await tx.insert(payment).values({ organizationId: ctx.organizationId, contactId: row.contactId, paymentNumber: await nextNumber(tx, ctx, "payment"),
      type: "made", date: row.issueDate, amount, method: "other", reference: target.billNumber, notes: `Debit note ${row.debitNoteNumber} applied to ${target.billNumber}`,
      currencyCode: row.currencyCode, createdBy: ctx.userId }).returning();
    await tx.insert(paymentAllocation).values([{ paymentId: carrier.id, documentType: "debit_note", documentId: id, amount }, { paymentId: carrier.id, documentType: "bill", documentId: target.id, amount }]);
    const status = balances.amountDue === 0 ? "paid" : "partial";
    const [updatedBill] = await tx.update(bill).set({ ...balances, status, paidAt: status === "paid" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(bill.id, target.id), eq(bill.organizationId, ctx.organizationId))).returning();
    const result = { debitNote: await update(tx, ctx, id, { amountApplied: applied, amountRemaining: remaining, status: remaining === 0 ? "applied" : "sent" }), bill: billWriteDto(updatedBill) };
    stringifyWire(result); await audit(tx, ctx, id, "apply", request); return result;
  });
}

export async function voidDebitNote(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:debit-notes"); return db.transaction(async tx => {
    const { row } = await load(tx, ctx, id); if (row.status === "void") fail("Already voided");
    await assertNotLocked(ctx.organizationId, row.issueDate);
    if (row.status !== "draft") {
      const saved = await savedJournal(tx, ctx, row.journalEntryId, "debit_note", id, row.currencyCode, row.contactId);
      const reversal = await mirrorJournal(tx, ctx, row, saved, "debit_note_void", true);
      const returned = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId), eq(inventoryMovement.referenceId, id), eq(inventoryMovement.referenceType, "debit_note"))).for("update");
      if (row.billId) {
        const original = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
          eq(inventoryMovement.referenceId, row.billId), eq(inventoryMovement.referenceType, "bill")));
        const dimensions = (rows: typeof original, reverse = false) => rows.map(m => `${m.inventoryItemId}/${m.warehouseId ?? ""}/${reverse ? -m.quantity : m.quantity}/${reverse ? -m.value : m.value}`).sort();
        if (JSON.stringify(dimensions(original)) !== JSON.stringify(dimensions(returned, true))) unsupported("Debit-note stock returns do not match original bill receipt history");
      } else if (returned.length) unsupported("Debit-note stock returns require a linked bill");
      for (const movement of returned) {
        publicMoneyDto(movement, ["value", "unitCost"]);
        if (movement.quantity >= 0 || movement.value > 0 || movement.journalEntryId !== saved.entry.id || !row.billId) unsupported("Debit-note saved stock return is unqualified");
        const [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, movement.inventoryItemId), eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
        const [store] = movement.warehouseId ? await tx.select({ id: warehouse.id }).from(warehouse).where(and(eq(warehouse.id, movement.warehouseId), eq(warehouse.organizationId, ctx.organizationId))) : [];
        if (!item || item.trackingMethod !== "none" || !["average", "fifo"].includes(item.costMethod) || (movement.warehouseId && !store))
          unsupported("Saved debit-note stock dimensions are unavailable or foreign");
        const restored = await billStockMovement(tx, ctx, { billId: id, itemId: movement.inventoryItemId, warehouseId: movement.warehouseId,
          quantity: -movement.quantity, value: safeInvoiceMinor(-BigInt(movement.value)), journalEntryId: reversal.id });
        await tx.update(inventoryMovement).set({ referenceType: "debit_note_void" }).where(eq(inventoryMovement.id, restored.id));
        const createdLayers = await tx.select().from(inventoryCostLayer).where(eq(inventoryCostLayer.sourceMovementId, restored.id));
        {
          const originalMovements = await tx.select({ id: inventoryMovement.id }).from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId),
            eq(inventoryMovement.referenceId, row.billId), eq(inventoryMovement.referenceType, "bill"), eq(inventoryMovement.inventoryItemId, movement.inventoryItemId),
            movement.warehouseId ? eq(inventoryMovement.warehouseId, movement.warehouseId) : isNull(inventoryMovement.warehouseId), eq(inventoryMovement.quantity, -movement.quantity)));
          const originalLayers = originalMovements.length ? await tx.select().from(inventoryCostLayer).where(inArray(inventoryCostLayer.sourceMovementId, originalMovements.map(m => m.id))).for("update") : [];
          if (!!createdLayers.length !== !!originalLayers.length) unsupported("Stock cost method changed after debit-note recognition");
          if (!originalLayers.length) continue;
          const layer = originalLayers.find(layer => layer.remainingQuantity === 0 && layer.originalQuantity === -movement.quantity && safeInvoiceMinor(BigInt(layer.unitCost) * BigInt(layer.originalQuantity)) === -movement.value);
          if (!layer || layer.organizationId !== ctx.organizationId) unsupported("Original FIFO receipt layer cannot be restored");
          await tx.delete(inventoryCostLayer).where(inArray(inventoryCostLayer.id, createdLayers.map(layer => layer.id)));
          await tx.update(inventoryCostLayer).set({ remainingQuantity: layer.originalQuantity }).where(eq(inventoryCostLayer.id, layer.id));
        }
      }
    }
    const allocations = await tx.select({ paymentId: paymentAllocation.paymentId }).from(paymentAllocation)
      .innerJoin(payment, eq(payment.id, paymentAllocation.paymentId))
      .where(and(eq(paymentAllocation.documentType, "debit_note"), eq(paymentAllocation.documentId, id), notDeleted(payment.deletedAt)));
    const ids = [...new Set(allocations.map(a => a.paymentId))];
    if (ids.length) {
      const carriers = await tx.select().from(payment).where(inArray(payment.id, ids)).for("update");
      const links = await tx.select().from(paymentAllocation).where(inArray(paymentAllocation.paymentId, ids));
      if (carriers.length !== ids.length || carriers.some(p => p.organizationId !== ctx.organizationId || p.contactId !== row.contactId || p.currencyCode !== row.currencyCode ||
        p.type !== "made" || p.journalEntryId || p.deletedAt || p.bankAccountId || p.bankTransactionId || p.stripePaymentIntentId || p.date !== row.issueDate))
        unsupported("Debit-note carrier payments are unqualified, bank-linked or foreign");
      let total = 0n; const byBill = new Map<string, bigint>();
      for (const p of carriers) {
        publicMoneyDto(p, ["amount"]); const pair = links.filter(a => a.paymentId === p.id); pair.forEach(a => publicMoneyDto(a, ["amount"]));
        const note = pair.filter(a => a.documentType === "debit_note" && a.documentId === id), bills = pair.filter(a => a.documentType === "bill");
        if (pair.length !== 2 || note.length !== 1 || bills.length !== 1 || p.amount <= 0 || pair.some(a => a.amount !== p.amount)) unsupported("Debit-note allocation pairs must agree");
        total += BigInt(p.amount); byBill.set(bills[0].documentId, (byBill.get(bills[0].documentId) ?? 0n) + BigInt(p.amount));
      }
      if (safeInvoiceMinor(total) !== row.amountApplied) unsupported("Applied debit-note balance does not match allocations");
      for (const [billId, amount] of [...byBill].sort(([a], [b]) => a.localeCompare(b))) {
        const target = await targetBill(tx, ctx, billId, row.contactId, row.currencyCode); await assertNotLocked(ctx.organizationId, target.issueDate);
        if (!["received", "partial", "paid", "overdue"].includes(target.status) || amount > BigInt(target.amountPaid)) unsupported("Bill cannot unwind debit-note allocation");
        const paid = safeInvoiceMinor(BigInt(target.amountPaid) - amount), due = safeInvoiceMinor(BigInt(target.amountDue) + amount);
        await tx.update(bill).set({ amountPaid: paid, amountDue: due, status: paid === 0 ? "received" : due === 0 ? "paid" : "partial", paidAt: due === 0 ? target.paidAt : null, updatedAt: new Date() })
          .where(and(eq(bill.id, target.id), eq(bill.organizationId, ctx.organizationId)));
      }
      await tx.delete(payment).where(and(eq(payment.organizationId, ctx.organizationId), inArray(payment.id, ids)));
    } else if (row.amountApplied !== 0) unsupported("Applied debit note has no allocations; legacy remediation required");
    const result = { debitNote: await update(tx, ctx, id, { status: "void", voidedAt: new Date(), amountApplied: 0, amountRemaining: 0 }) };
    await audit(tx, ctx, id, "void", request); return result;
  });
}
