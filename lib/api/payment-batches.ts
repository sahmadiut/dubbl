import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, paymentBatch, paymentBatchItem, invoice, bill, contact, auditLog, journalEntry } from "@/lib/db/schema";
import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { publicMoneyDto } from "./public-money-wire";
import { contactDto } from "./contact-wire";
import { billReadDto } from "./bill-read-wire";
import { invoiceInputError, safeInvoiceMinor } from "./invoice-write-wire";
import { paginatedResponse } from "./pagination";
import { createSettlementPaymentInTransaction } from "./payment-settlements";
import { batchIdField, batchCreateSchema, batchUpdateSchema, batchListSchema, immediateBatchSchema,
  batchMajorAmount, storedBatchItems } from "./payment-batch-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Item = { billId: string | null; contactId: string | null; amount: number; currencyCode: string };
type Batch = typeof paymentBatch.$inferSelect & { items: (typeof paymentBatchItem.$inferSelect)[] };
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
}
async function loadBatch(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  if (lock) await tx.select({ id: paymentBatch.id }).from(paymentBatch).where(and(eq(paymentBatch.id, id), eq(paymentBatch.organizationId, ctx.organizationId))).for("update");
  const found = await tx.query.paymentBatch.findFirst({ where: and(eq(paymentBatch.id, id),
    eq(paymentBatch.organizationId, ctx.organizationId), isNull(paymentBatch.deletedAt)), with: { items: true } });
  if (!found) throw new AuthError("Payment batch not found", 404);
  return found;
}
function batchTotals(items: Item[], currency: string) {
  currencyCodeSchema.parse(currency);
  if (items.length > 1000 || new Set(items.map(row => row.billId)).size !== items.length)
    unsupported("Batch requires at most 1000 distinct bills");
  let total = 0n;
  for (const item of items) {
    publicMoneyDto(item, ["amount"]);
    if (!item.billId || !item.contactId || item.amount <= 0 || item.currencyCode !== currency)
      unsupported("Batch item references, amounts and currencies must be consistent");
    total += BigInt(item.amount);
  }
  return safeInvoiceMinor(total);
}
async function itemRelations(tx: Tx, ctx: Pick<AuthContext, "organizationId">, item: Item, writable: boolean) {
  const [doc] = await tx.select().from(bill).where(and(eq(bill.id, item.billId!), eq(bill.organizationId, ctx.organizationId)));
  const [party] = await tx.select().from(contact).where(and(eq(contact.id, item.contactId!), eq(contact.organizationId, ctx.organizationId)));
  if (!doc || !party) unsupported("Batch references a missing or foreign bill/contact");
  if (doc.contactId !== party.id || doc.currencyCode !== item.currencyCode) unsupported("Batch bill/contact/currency disagree");
  if (doc.journalEntryId) {
    const [entry] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.id, doc.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!entry) unsupported("Batch bill references a missing or foreign journal");
  }
  const dto = billReadDto({ ...doc, contact: party }, ctx.organizationId);
  if (writable && (doc.deletedAt || party.deletedAt || party.type === "customer" ||
    !["received", "partial", "overdue"].includes(doc.status) || !doc.journalEntryId || item.amount > doc.amountDue))
    throw new AuthError("Batch requires available recognized outstanding supplier bills without overpayment", 400);
  return { bill: dto, contact: contactDto(party) };
}
/** Validate scalar references even when the legacy list/create envelope omits expansions. */
export async function paymentBatchDto(tx: Tx, ctx: Pick<AuthContext, "organizationId">, batch: Batch, expanded: boolean, writable = false) {
  const total = batchTotals(batch.items, batch.currencyCode);
  if (batch.organizationId !== ctx.organizationId || total !== batch.totalAmount || batch.paymentCount !== batch.items.length)
    unsupported("Saved batch totals/count/organization disagree with items");
  publicMoneyDto(batch, ["totalAmount"]);
  const items = [];
  for (const item of batch.items) {
    const relations = await itemRelations(tx, ctx, item, writable);
    items.push({ ...publicMoneyDto(item, ["amount"]), ...(expanded ? relations : {}) });
  }
  const dto = { ...publicMoneyDto(batch, ["totalAmount"]), items };
  stringifyWire(dto); return dto;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId,
    entityType: "payment_batch", entityId: id, action, changes: JSON.parse(stringifyWire(changes)) });
}

export async function recordPaymentBatch(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payments");
  const parsed = immediateBatchSchema.parse(input);
  if (new Set(parsed.allocations.map(row => row.documentId)).size !== parsed.allocations.length ||
    parsed.allocations.some(row => row.documentType !== (parsed.type === "received" ? "invoice" : "bill")))
    invoiceInputError("Batch documents must be distinct and match payment direction");
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    // Currency is derived from an owned document under the same lock as settlement.
    // No USD guess and no binary floating-point major/minor multiplication.
    const first = parsed.allocations[0];
    const table = first.documentType === "invoice" ? invoice : bill;
    const [doc] = await tx.select({ currency: table.currencyCode }).from(table).where(and(eq(table.id, first.documentId),
      eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt))).for("update");
    if (!doc) throw new AuthError(`${first.documentType} not found`, 404);
    const allocations = parsed.allocations.map(row => ({ documentType: row.documentType, documentId: row.documentId,
      amount: batchMajorAmount(row, doc.currency) }));
    const amount = safeInvoiceMinor(allocations.reduce((sum, row) => sum + BigInt(row.amount), 0n));
    return createSettlementPaymentInTransaction(ctx, { ...parsed, allocations, amount }, tx, request);
  });
}

export async function listPaymentBatches(ctx: AuthContext, input: unknown) {
  const parsed = batchListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(eq(paymentBatch.organizationId, ctx.organizationId), isNull(paymentBatch.deletedAt));
    const rows = await tx.query.paymentBatch.findMany({ where, orderBy: [desc(paymentBatch.createdAt), desc(paymentBatch.id)],
      limit: parsed.limit, offset: (parsed.page - 1) * parsed.limit, with: { items: true } });
    const data = [];
    for (const row of rows) data.push(await paymentBatchDto(tx, ctx, row, false));
    const [total] = await tx.select({ count: count() }).from(paymentBatch).where(where);
    if (!Number.isSafeInteger(total.count)) unsupported("Batch count exceeds the supported range");
    return paginatedResponse(data, total.count, parsed.page, parsed.limit);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPaymentBatch(ctx: AuthContext, id: string) {
  batchIdField.parse(id);
  return db.transaction(async tx => ({ batch: await paymentBatchDto(tx, ctx, await loadBatch(tx, ctx, id), true) }),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createPaymentBatch(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payments");
  const parsed = batchCreateSchema.parse(input), items = storedBatchItems(parsed.items);
  const totalAmount = batchTotals(items, parsed.currencyCode);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx);
    for (const item of items) await itemRelations(tx, ctx, item, true);
    const [created] = await tx.insert(paymentBatch).values({ organizationId: ctx.organizationId, name: parsed.name,
      currencyCode: parsed.currencyCode, totalAmount, paymentCount: items.length }).returning();
    await tx.insert(paymentBatchItem).values(items.map(({ amountMinor: _alias, ...item }) => { void _alias; return { ...item, batchId: created.id }; }));
    const result = { batch: await paymentBatchDto(tx, ctx, await loadBatch(tx, ctx, created.id), false) };
    await audit(tx, ctx, created.id, "create", result); return result;
  });
}
export async function updatePaymentBatch(ctx: AuthContext, id: string, input: unknown) {
  requireRole(ctx, "manage:payments"); batchIdField.parse(id);
  const parsed = batchUpdateSchema.parse(input), additions = storedBatchItems(parsed.addItems ?? []);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const existing = await loadBatch(tx, ctx, id, true);
    if (existing.status !== "draft") throw new AuthError("Only draft batches can be updated", 400);
    await paymentBatchDto(tx, ctx, existing, false);
    const removals = parsed.removeItemIds ?? [];
    if (new Set(removals).size !== removals.length || removals.some(itemId => !existing.items.some(item => item.id === itemId)))
      invoiceInputError("Removal IDs must be distinct existing items in this batch");
    const retained = existing.items.filter(item => !removals.includes(item.id));
    const items = [...retained, ...additions], totalAmount = batchTotals(items, existing.currencyCode);
    if (!items.length) invoiceInputError("A draft batch must retain at least one item");
    for (const item of items) await itemRelations(tx, ctx, item, true);
    for (const itemId of removals) await tx.delete(paymentBatchItem).where(and(eq(paymentBatchItem.id, itemId), eq(paymentBatchItem.batchId, id)));
    if (additions.length) await tx.insert(paymentBatchItem).values(additions.map(({ amountMinor: _alias, ...item }) => { void _alias; return { ...item, batchId: id }; }));
    await tx.update(paymentBatch).set({ name: parsed.name ?? existing.name, totalAmount, paymentCount: items.length }).where(eq(paymentBatch.id, id));
    const result = { batch: await paymentBatchDto(tx, ctx, await loadBatch(tx, ctx, id), true) };
    await audit(tx, ctx, id, "update", result); return result;
  });
}
export async function submitPaymentBatch(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payments"); batchIdField.parse(id);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const existing = await loadBatch(tx, ctx, id, true);
    if (existing.status !== "draft") throw new AuthError("Only draft batches can be submitted", 400);
    if (!existing.items.length || existing.items.some(item => item.status !== "pending"))
      unsupported("Draft batch must contain pending items only");
    await paymentBatchDto(tx, ctx, existing, true, true);
    const now = new Date(), date = now.toISOString().slice(0, 10), settlements = [];
    for (const item of [...existing.items].sort((a, b) => a.billId!.localeCompare(b.billId!))) {
      const result = await createSettlementPaymentInTransaction(ctx, { type: "made", contactId: item.contactId,
        currencyCode: existing.currencyCode, date, amount: item.amount,
        allocations: [{ documentId: item.billId, documentType: "bill", amount: item.amount }] }, tx);
      settlements.push({ itemId: item.id, paymentId: (result.payment as { id: string }).id });
      await tx.update(paymentBatchItem).set({ status: "completed" }).where(and(eq(paymentBatchItem.id, item.id), eq(paymentBatchItem.batchId, id)));
    }
    await tx.update(paymentBatch).set({ status: "completed", submittedAt: now, completedAt: now }).where(eq(paymentBatch.id, id));
    const result = { batch: await paymentBatchDto(tx, ctx, await loadBatch(tx, ctx, id), true), processed: existing.items.length, total: existing.items.length };
    await audit(tx, ctx, id, "submit", { settlements, totalAmountMinor: String(existing.totalAmount) });
    stringifyWire(result); return result;
  });
}
