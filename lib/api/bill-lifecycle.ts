import { z } from "zod";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bill, billLine, organization, contact, chartAccount, taxRate, costCenter, project, inventoryItem, warehouse,
  goodsReceipt, goodsReceiptLine, purchaseOrder, purchaseOrderLine, billPurchaseOrder, journalEntry, journalLine,
  inventoryMovement, auditLog, approvalRequest, approvalAction, approvalWorkflow, approvalWorkflowStep, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { publicLineDto } from "./public-money-wire";
import { billWriteDto } from "./bill-write-wire";
import { safeInvoiceMinor, invoiceRound } from "./invoice-write-wire";
import { journalLineDto } from "./journal-wire";
import { ensureControlAccount } from "./journal-automation";
import { receivablePostingRate, postReceivable, receivableAccount } from "./invoice-lifecycle";
import { convertInvoiceLegs } from "./invoice-lifecycle-wire";
import { getProcurementSettings } from "./procurement";
import { billUnits, billInt32, billTaxSplit, billVarianceBp, billRejectSchema } from "./bill-lifecycle-wire";
import { billStockMovement } from "./bill-stock";
import { purchaseOrderReservations } from "./purchase-order-reservations";
import { derivePurchaseOrderStatusAfterBilling } from "./procurement";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Bill = typeof bill.$inferSelect;
type Line = typeof billLine.$inferSelect;
type Leg = { accountId: string; debitAmount: number; creditAmount: number; costCenterId?: string | null; projectId?: string | null };
function fail(message: string): never { throw new AuthError(message, 400); }
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
const scope = (ctx: AuthContext, id: string) => and(eq(bill.id, id), eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt));

async function ownedAccount(tx: Tx, ctx: AuthContext, id: string, historical = false) {
  const [account] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId))).for("share");
  if (!account || (!historical && (!account.isActive || account.deletedAt))) unsupported("Bill account must belong to this organization and be available");
  return account;
}
async function control(tx: Tx, ctx: AuthContext, key: Parameters<typeof ensureControlAccount>[1], base: string) {
  const account = await ensureControlAccount(ctx.organizationId, key, base, tx);
  if (!account) fail(`Bill ${key} account unavailable`);
  await ownedAccount(tx, ctx, account.id); return account.id;
}
async function load(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  const [found] = await tx.select().from(bill).where(scope(ctx, id)).for("update");
  if (!found) throw new AuthError("Bill not found", 404);
  stringifyWire(billWriteDto(found)); currencyCodeSchema.parse(found.currencyCode);
  rateDateSchema.parse(found.issueDate); rateDateSchema.parse(found.dueDate);
  const supplier = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, found.contactId), eq(contact.organizationId, ctx.organizationId))).for("share");
  if (!supplier.length) unsupported("Bill supplier belongs to another organization");
  const lines = await tx.select().from(billLine).where(eq(billLine.billId, id)).orderBy(billLine.sortOrder, billLine.id);
  for (const line of lines) { publicLineDto(line); billUnits(line.quantity); }
  for (const [key, table] of [["accountId", chartAccount], ["taxRateId", taxRate], ["costCenterId", costCenter],
    ["projectId", project], ["inventoryItemId", inventoryItem], ["warehouseId", warehouse]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!ids.length) continue;
    const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, ctx.organizationId), inArray(table.id, ids))).for("share");
    if (rows.length !== ids.length) unsupported(`Bill ${key} belongs to another organization`);
  }
  const links = await tx.select({ id: billPurchaseOrder.purchaseOrderId }).from(billPurchaseOrder).where(eq(billPurchaseOrder.billId, id));
  if (links.length) {
    const rows = await tx.select({ id: purchaseOrder.id }).from(purchaseOrder).where(and(eq(purchaseOrder.organizationId, ctx.organizationId), inArray(purchaseOrder.id, links.map(link => link.id)))).for("share");
    if (rows.length !== links.length) unsupported("Bill purchase order belongs to another organization");
  }
  const receipts = new Map<string, { line: typeof goodsReceiptLine.$inferSelect; receipt: typeof goodsReceipt.$inferSelect; po?: typeof purchaseOrderLine.$inferSelect }>();
  for (const id of [...new Set(lines.flatMap(line => line.goodsReceiptLineId ? [line.goodsReceiptLineId] : []))].sort()) {
    const [row] = await tx.select({ line: goodsReceiptLine, receipt: goodsReceipt }).from(goodsReceiptLine)
      .innerJoin(goodsReceipt, eq(goodsReceiptLine.goodsReceiptId, goodsReceipt.id))
      .where(and(eq(goodsReceiptLine.id, id), eq(goodsReceipt.organizationId, ctx.organizationId))).for("update");
    if (!row || row.receipt.contactId !== found.contactId) unsupported("Bill receipt belongs to another organization or supplier");
    if (!Number.isSafeInteger(row.line.unitCost) || row.line.unitCost < 0) unsupported("Unsupported saved goods receipt cost");
    billUnits(row.line.quantityReceived);
    let po: typeof purchaseOrderLine.$inferSelect | undefined;
    if (row.line.purchaseOrderLineId) {
      const [saved] = await tx.select({ line: purchaseOrderLine, header: purchaseOrder }).from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrderLine.purchaseOrderId, purchaseOrder.id))
        .where(and(eq(purchaseOrderLine.id, row.line.purchaseOrderLineId), eq(purchaseOrder.organizationId, ctx.organizationId))).for("update");
      if (!saved || saved.header.contactId !== found.contactId || saved.header.currencyCode !== found.currencyCode ||
        (row.receipt.purchaseOrderId && row.receipt.purchaseOrderId !== saved.header.id)) unsupported("Bill receipt purchase order is inconsistent or foreign");
      po = saved.line; publicLineDto(po);
      for (const qty of [po.quantity, po.quantityReceived, po.quantityBilled]) billUnits(qty);
    }
    receipts.set(id, { ...row, po });
  }
  const reservations = found.status === "void" ? [] : await purchaseOrderReservations(tx, ctx.organizationId, id);
  return { found, org, lines, receipts, reservations };
}
async function audit(tx: Tx, ctx: AuthContext, found: Bill, action: string, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "bill", entityId: found.id,
    action, changes: { previousStatus: found.status }, ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function update(tx: Tx, ctx: AuthContext, id: string, patch: Partial<typeof bill.$inferInsert>) {
  const [row] = await tx.update(bill).set({ ...patch, updatedAt: new Date() }).where(scope(ctx, id)).returning();
  const dto = billWriteDto(row); stringifyWire(dto); return dto;
}
/** Optional existing workflow: final approval and posting share this transaction. */
async function approval(tx: Tx, ctx: AuthContext, found: Bill, action: "approve" | "reject" | "comment", comment?: string, requestId?: string) {
  const pending = await tx.select().from(approvalRequest).where(and(eq(approvalRequest.organizationId, ctx.organizationId),
    eq(approvalRequest.entityType, "bill"), eq(approvalRequest.entityId, found.id), eq(approvalRequest.status, "pending"))).for("update");
  if (!pending.length && !requestId) return { final: true, request: undefined };
  if (pending.length !== 1 || (requestId && pending[0].id !== requestId)) fail("Exactly one matching pending bill approval request is required");
  const current = pending[0];
  const [workflow] = await tx.select().from(approvalWorkflow).where(and(eq(approvalWorkflow.id, current.workflowId), eq(approvalWorkflow.organizationId, ctx.organizationId))).for("share");
  if (!workflow) unsupported("Bill approval workflow belongs to another organization");
  const steps = await tx.select().from(approvalWorkflowStep).where(eq(approvalWorkflowStep.workflowId, workflow.id)).orderBy(approvalWorkflowStep.stepOrder).for("share");
  const step = steps.find(row => row.stepOrder === current.currentStepOrder);
  const [actor] = await tx.select().from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId))).for("share");
  if (!step || !actor) fail("Bill approval member/current step unavailable");
  const [assignee] = await tx.select().from(member).where(and(eq(member.id, step.approverId), eq(member.organizationId, ctx.organizationId)));
  if (!assignee) unsupported("Bill approval step belongs to another organization");
  if (action !== "comment" && actor.id !== step.approverId) throw new AuthError("You are not the approver for the current step", 403);
  await tx.insert(approvalAction).values({ requestId: current.id, stepId: step.id, userId: actor.id, action, comment: comment ?? null });
  if (action === "comment") return { final: false, request: current };
  const next = steps.find(row => row.stepOrder > step.stepOrder);
  const status = action === "reject" ? "rejected" : next ? "pending" : "approved";
  const [changed] = await tx.update(approvalRequest).set({ status, currentStepOrder: action === "approve" && next ? next.stepOrder : current.currentStepOrder,
    updatedAt: new Date() }).where(eq(approvalRequest.id, current.id)).returning();
  return { final: status !== "pending", request: changed };
}

async function recognize(tx: Tx, ctx: AuthContext, loaded: Awaited<ReturnType<typeof load>>) {
  const { found, lines, org, receipts } = loaded;
  if (found.journalEntryId || found.amountPaid !== 0 || !lines.length) fail("Bill must be unposted, unsettled and contain lines");
  const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD");
  const fx = await receivablePostingRate(ctx, found.currencyCode, base, found.issueDate);
  const ap = await receivableAccount(tx, ctx.organizationId, "2100");
  const settings = await getProcurementSettings(ctx.organizationId, tx);
  for (const value of [settings.priceTolerancePercent, settings.qtyTolerancePercent])
    if (!Number.isInteger(value) || value < 0 || value > 10000) unsupported("Unsupported procurement tolerance basis points");
  const warnings: { billLineId: string; kind: string; message: string }[] = [];
  const issue = (line: Line, kind: string, message: string, block: boolean) => {
    if (block) throw new AuthError(message, 422);
    warnings.push({ billLineId: line.id, kind, message });
  };
  const main: Leg[] = [], grni: Leg[] = [];
  const stocks: { itemId: string; warehouseId: string | null; quantity: number; value: number; matched: boolean; mainIndex?: number }[] = [];
  let subtotal = 0n, taxTotal = 0n, supplierTotal = 0n, mainAp = 0n, matchedAp = 0n;
  const proposedGrn = new Map<string, number>(), proposedPo = new Map<string, number>();
  const taxRows = await tx.select().from(taxRate).where(and(eq(taxRate.organizationId, ctx.organizationId), isNull(taxRate.deletedAt))).for("share");
  const defaultTax = taxRows.find(row => row.isDefault && row.kind !== "reverse_charge");
  for (const line of lines) {
    if (line.amount < 0 || line.taxAmount < 0 || line.unitPrice < 0) fail("Bill posting requires nonnegative line amounts");
    subtotal += BigInt(line.amount); taxTotal += BigInt(line.taxAmount);
    const tax = line.taxRateId ? taxRows.find(row => row.id === line.taxRateId) : defaultTax;
    if (line.taxRateId && !tax) fail("Bill tax rate is unavailable");
    const split = billTaxSplit(line.amount, line.taxAmount, tax); supplierTotal += BigInt(split.supplier);
    const matched = line.goodsReceiptLineId ? receipts.get(line.goodsReceiptLineId)! : undefined;
    let item: typeof inventoryItem.$inferSelect | undefined;
    const itemId = line.inventoryItemId ?? matched?.line.inventoryItemId;
    const warehouseId = line.warehouseId ?? matched?.line.warehouseId ?? null;
    if (matched && ((line.inventoryItemId && line.inventoryItemId !== matched.line.inventoryItemId) ||
      (line.warehouseId && line.warehouseId !== matched.line.warehouseId))) unsupported("Bill and receipt stock dimensions disagree");
    if (itemId) {
      [item] = await tx.select().from(inventoryItem).where(and(eq(inventoryItem.id, itemId), eq(inventoryItem.organizationId, ctx.organizationId))).for("update");
      if (!item || !item.isActive || item.deletedAt) fail("Bill inventory item is unavailable");
      for (const amount of [item.totalValue, item.averageCost]) if (!Number.isSafeInteger(amount) || amount < 0) unsupported("Unsupported inventory value");
      billInt32(BigInt(item.quantityOnHand));
    }
    if (warehouseId) {
      const [store] = await tx.select().from(warehouse).where(and(eq(warehouse.id, warehouseId), eq(warehouse.organizationId, ctx.organizationId), isNull(warehouse.deletedAt))).for("share");
      if (!store || !store.isActive) fail("Bill warehouse is unavailable");
    }
    const costId = item ? item.inventoryAccountId ?? await control(tx, ctx, "inventory", base) : line.accountId;
    if (!costId && (line.amount || split.blocked)) fail("Bill line requires an expense or inventory account");
    if (costId) await ownedAccount(tx, ctx, costId);
    const dims = { costCenterId: line.costCenterId, projectId: line.projectId };
    // All line taxes, including matched inventory taxes, use the same recoverability policy.
    if (split.input) main.push({ accountId: await control(tx, ctx, "inputVat", base), debitAmount: split.input, creditAmount: 0, ...dims });
    if (split.output) main.push({ accountId: await control(tx, ctx, "outputVat", base), debitAmount: 0, creditAmount: split.output, ...dims });
    if (!matched) {
      if (item && settings.requireGrnBeforeBill) issue(line, "grn_required", "Stock line requires a goods receipt before billing", true);
      const cost = safeInvoiceMinor(BigInt(line.amount) + BigInt(split.blocked));
      const mainIndex = cost ? main.length : -1;
      if (cost) main.push({ accountId: costId!, debitAmount: cost, creditAmount: 0, ...dims });
      mainAp += BigInt(split.supplier);
      if (item) {
        const units = billUnits(line.quantity);
        if (!units && cost) unsupported("Nonzero inventory receipt requires rounded whole units");
        if (units) stocks.push({ itemId: item.id, warehouseId, quantity: units, value: cost, matched: false, mainIndex });
      }
      continue;
    }
    if (!["received", "billed"].includes(matched.receipt.status) || matched.receipt.deletedAt) fail("Goods receipt must be received and available");
    // Current GRN storage has no saved FX/base snapshot. Preserve its costs verbatim only in base currency.
    if (found.currencyCode !== base) unsupported("Foreign-currency GRNI requires qualified saved receipt FX (MON-052)");
    const accruals = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
      eq(journalEntry.sourceType, "goods_receipt"), eq(journalEntry.reference, matched.receipt.receiptNumber),
      eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt), isNull(journalEntry.reversedByEntryId))).for("share");
    if (accruals.length !== 1) unsupported("GRNI requires an unambiguous posted goods receipt accrual");
    const accrualLines = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, accruals[0].id));
    if (!accrualLines.length) unsupported("Goods receipt accrual has no saved legs");
    for (const saved of accrualLines) {
      journalLineDto(saved); await ownedAccount(tx, ctx, saved.accountId, true);
      if (saved.currencyCode !== base || saved.exchangeRate !== 1000000 || saved.rateMigrationStatus !== "exact" || saved.rateFormatVersion !== 1)
        unsupported("GRNI requires qualified identity FX in the current base currency; no historical receipt repair");
    }
    const accrualDebit = safeInvoiceMinor(accrualLines.reduce((sum, leg) => sum + BigInt(leg.debitAmount), 0n));
    const accrualCredit = safeInvoiceMinor(accrualLines.reduce((sum, leg) => sum + BigInt(leg.creditAmount), 0n));
    if (accrualDebit !== accrualCredit || accrualLines.some(leg => leg.debitAmount < 0 || leg.creditAmount < 0)) unsupported("Goods receipt accrual legs must balance");
    const [used] = await tx.select({ value: sql<string>`coalesce(sum(${billLine.quantity}),0)::text` }).from(billLine)
      .innerJoin(bill, eq(billLine.billId, bill.id)).where(and(eq(bill.organizationId, ctx.organizationId), eq(billLine.goodsReceiptLineId, matched.line.id),
        ne(bill.status, "void"), isNull(bill.deletedAt), sql`${bill.journalEntryId} is not null`));
    const cumulative = billInt32(BigInt(used.value) + BigInt(proposedGrn.get(matched.line.id) ?? 0) + BigInt(line.quantity));
    proposedGrn.set(matched.line.id, billInt32(BigInt(proposedGrn.get(matched.line.id) ?? 0) + BigInt(line.quantity)));
    if (cumulative > matched.line.quantityReceived) issue(line, "over_bill_qty", "Bill quantity exceeds goods receipt quantity", settings.blockOverBill || settings.requireGrnBeforeBill);
    const units = billUnits(line.quantity), billedCost = units ? safeInvoiceMinor(invoiceRound(BigInt(line.amount), BigInt(units))) : 0;
    const expectedCost = matched.po?.unitPrice ?? matched.line.unitCost;
    const variance = billVarianceBp(billedCost, expectedCost);
    if ((variance < 0n ? -variance : variance) > BigInt(settings.priceTolerancePercent))
      issue(line, "price_out_of_tolerance", "Bill unit cost exceeds procurement price tolerance", !matched.po && settings.blockOverBill);
    if (matched.po) {
      const po = matched.po;
      const reserved = loaded.reservations.some(reservation => reservation.line.id === po.id);
      const qty = reserved ? po.quantityBilled : billInt32(BigInt(po.quantityBilled) + BigInt(proposedPo.get(po.id) ?? 0) + BigInt(line.quantity));
      if (!reserved) proposedPo.set(po.id, billInt32(BigInt(proposedPo.get(po.id) ?? 0) + BigInt(line.quantity)));
      if (qty > po.quantityReceived) issue(line, "over_bill_qty", "Bill quantity exceeds PO received quantity", settings.blockOverBill || settings.requireGrnBeforeBill);
      const tolerance = invoiceRound(BigInt(po.quantity) * BigInt(settings.qtyTolerancePercent), 10000n);
      if (BigInt(qty) > BigInt(po.quantity) + tolerance) issue(line, "over_bill_qty", "Bill quantity exceeds PO ordered tolerance", settings.blockOverBill);
    }
    const previouslyBilled = billInt32(BigInt(used.value) + BigInt(proposedGrn.get(matched.line.id)! - line.quantity));
    const clearedUnits = Math.min(units, Math.max(0, billUnits(matched.line.quantityReceived) - billUnits(previouslyBilled)));
    const cleared = safeInvoiceMinor(BigInt(matched.line.unitCost) * BigInt(clearedUnits));
    if (cleared) grni.push({ accountId: await control(tx, ctx, "grni", base), debitAmount: cleared, creditAmount: 0, ...dims });
    let absorbed = 0;
    if (item && clearedUnits) {
      const absorbable = Math.min(clearedUnits, item.quantityOnHand);
      absorbed = safeInvoiceMinor((BigInt(billedCost) - BigInt(matched.line.unitCost)) * BigInt(absorbable) + BigInt(split.blocked));
      if (absorbed) {
        grni.push({ accountId: costId!, debitAmount: absorbed > 0 ? absorbed : 0, creditAmount: absorbed < 0 ? -absorbed : 0, ...dims });
        stocks.push({ itemId: item.id, warehouseId, quantity: 0, value: absorbed, matched: true });
      }
    }
    const ppv = safeInvoiceMinor(BigInt(line.amount) + BigInt(split.blocked) - BigInt(cleared) - BigInt(absorbed));
    if (ppv) grni.push({ accountId: await control(tx, ctx, "purchasePriceVariance", base), debitAmount: ppv > 0 ? ppv : 0, creditAmount: ppv < 0 ? -ppv : 0, ...dims });
    matchedAp += BigInt(line.amount) + BigInt(split.blocked);
    mainAp += BigInt(split.input) - BigInt(split.output);
  }
  if (safeInvoiceMinor(subtotal) !== found.subtotal || safeInvoiceMinor(taxTotal) !== found.taxTotal ||
    safeInvoiceMinor(subtotal + taxTotal) !== found.total || safeInvoiceMinor(supplierTotal) !== found.amountDue || found.total <= 0)
    fail("Bill header and line balances must agree before posting");
  const metadata = { date: found.issueDate, reference: found.billNumber, sourceId: found.id };
  if (mainAp) main.push({ accountId: ap.id, debitAmount: mainAp < 0n ? safeInvoiceMinor(-mainAp) : 0, creditAmount: mainAp > 0n ? safeInvoiceMinor(mainAp) : 0 });
  if (matchedAp) grni.push({ accountId: ap.id, debitAmount: 0, creditAmount: safeInvoiceMinor(matchedAp) });
  // Apply the same residual allocation as the posted GL, including sub-minor FX ties.
  const convertedMain = convertInvoiceLegs(main, found.currencyCode, base, fx.rateExact);
  for (const stock of stocks) if (!stock.matched) stock.value = stock.mainIndex === -1 ? 0 : convertedMain[stock.mainIndex!].debitAmount;
  const entry = main.some(l => l.debitAmount || l.creditAmount) ? await postReceivable(tx, ctx, { ...metadata, description: `Bill ${found.billNumber}`, sourceType: "bill" }, main, found.currencyCode, base, fx) : null;
  const clearing = grni.some(l => l.debitAmount || l.creditAmount) ? await postReceivable(tx, ctx, { ...metadata, description: `Bill ${found.billNumber} GRNI clearing`, sourceType: "bill_grni" }, grni, found.currencyCode, base, fx) : null;
  if (!entry && !clearing) fail("Bill posting requires nonzero journal legs");
  for (const stock of stocks) await billStockMovement(tx, ctx, { billId: found.id, ...stock, journalEntryId: (stock.matched ? clearing : entry)!.id });
  for (const [id, qty] of proposedPo) {
    const [po] = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.id, id));
    await tx.update(purchaseOrderLine).set({ quantityBilled: billInt32(BigInt(po.quantityBilled) + BigInt(qty)) }).where(eq(purchaseOrderLine.id, id));
  }
  for (const id of proposedGrn.keys()) {
    const receipt = receipts.get(id)!;
    await tx.update(goodsReceiptLine).set({ journalEntryId: clearing!.id }).where(eq(goodsReceiptLine.id, id));
    await tx.update(goodsReceipt).set({ status: "billed", updatedAt: new Date() }).where(eq(goodsReceipt.id, receipt.receipt.id));
  }
  return { entryId: (entry ?? clearing)!.id, grniEntryId: clearing?.id ?? null, warnings };
}

export async function receiveBill(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:bills");
  return db.transaction(async tx => {
    const loaded = await load(tx, ctx, id);
    if (loaded.found.status !== "draft") fail("Only draft bills can be received");
    const pending = await tx.select({ id: approvalRequest.id }).from(approvalRequest).where(and(eq(approvalRequest.organizationId, ctx.organizationId),
      eq(approvalRequest.entityType, "bill"), eq(approvalRequest.entityId, id), eq(approvalRequest.status, "pending")));
    if (pending.length) fail("Bill has a pending approval workflow");
    await assertNotLocked(ctx.organizationId, loaded.found.issueDate);
    const posted = await recognize(tx, ctx, loaded);
    const result = { bill: await update(tx, ctx, id, { status: "received", receivedAt: new Date(), journalEntryId: posted.entryId }), grniEntryId: posted.grniEntryId, warnings: posted.warnings };
    stringifyWire(result); await audit(tx, ctx, loaded.found, "receive", request); return result;
  });
}
export async function actBillApproval(ctx: AuthContext, id: string, action: "approve" | "reject" | "comment", input: unknown = {}, request?: Request, requestId?: string) {
  requireRole(ctx, "manage:bills");
  const comment = billRejectSchema.parse(input).reason;
  return db.transaction(async tx => {
    const loaded = await load(tx, ctx, id), { found } = loaded;
    if (found.status !== "pending_approval" || found.journalEntryId || found.amountPaid !== 0) fail("Only unposted bills pending approval can be acted on");
    await assertNotLocked(ctx.organizationId, found.issueDate);
    const decision = await approval(tx, ctx, found, action, comment, requestId);
    let result;
    if (!decision.final || action === "comment") result = { bill: billWriteDto(found), request: decision.request };
    else if (action === "reject") result = { bill: await update(tx, ctx, id, { status: "draft", rejectedAt: new Date(), rejectionReason: comment || null }), request: decision.request };
    else {
      const posted = await recognize(tx, ctx, loaded);
      result = { bill: await update(tx, ctx, id, { status: "received", receivedAt: new Date(), approvedBy: ctx.userId, approvedAt: new Date(), journalEntryId: posted.entryId }),
        request: decision.request, grniEntryId: posted.grniEntryId, warnings: posted.warnings };
    }
    stringifyWire(result); await audit(tx, ctx, found, action, request); return result;
  });
}

async function reverse(tx: Tx, ctx: AuthContext, found: Bill, entry: typeof journalEntry.$inferSelect) {
  if (entry.status !== "posted" || entry.reversedByEntryId || entry.deletedAt || !["bill", "bill_grni"].includes(entry.sourceType ?? "") ||
    (entry.sourceId !== null ? entry.sourceId !== found.id : entry.reference !== found.billNumber)) unsupported("Bill journal is reversed, unavailable or belongs to another document");
  await assertNotLocked(ctx.organizationId, entry.date);
  const lines = await tx.select({ id: journalLine.id, accountId: journalLine.accountId, debitAmount: journalLine.debitAmount, creditAmount: journalLine.creditAmount,
    currencyCode: journalLine.currencyCode, exchangeRate: journalLine.exchangeRate, rateExact: sql<string | null>`${journalLine.rateExact}::text`,
    rateDirection: journalLine.rateDirection, rateFormatVersion: journalLine.rateFormatVersion, rateMigrationStatus: journalLine.rateMigrationStatus,
    rateProvenance: journalLine.rateProvenance, costCenterId: journalLine.costCenterId, projectId: journalLine.projectId }).from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
  if (!lines.length) unsupported("Bill journal has no saved lines");
  let debit = 0n, credit = 0n;
  for (const line of lines) {
    journalLineDto(line); await ownedAccount(tx, ctx, line.accountId, true);
    if (!line.rateExact || line.rateMigrationStatus !== "exact" || line.rateFormatVersion !== 1 || line.rateDirection !== "quote_per_base" || line.debitAmount < 0 || line.creditAmount < 0)
      unsupported("Bill reversal requires qualified saved amounts and transaction FX");
    for (const [key, table] of [["costCenterId", costCenter], ["projectId", project]] as const) {
      if (!line[key]) continue;
      const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, line[key]!), eq(table.organizationId, ctx.organizationId)));
      if (!rows.length) unsupported(`Bill journal ${key} belongs to another organization`);
    }
    debit += BigInt(line.debitAmount); credit += BigInt(line.creditAmount);
  }
  safeInvoiceMinor(debit); safeInvoiceMinor(credit);
  if (debit !== credit) unsupported("Bill saved journal must balance");
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, ctx.organizationId));
  const next = billInt32(BigInt(max.value) + 1n);
  const description = `Void bill ${found.billNumber}`;
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: next, date: found.issueDate,
    description, reference: found.billNumber, sourceType: "bill_void", sourceId: found.id, status: "posted", postedAt: new Date(), createdBy: ctx.userId, reversesEntryId: entry.id }).returning();
  await tx.insert(journalLine).values(lines.map(line => ({ accountId: line.accountId, currencyCode: line.currencyCode, exchangeRate: line.exchangeRate, rateExact: line.rateExact,
    rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion, rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance,
    costCenterId: line.costCenterId, projectId: line.projectId, journalEntryId: reversal.id, description, debitAmount: line.creditAmount, creditAmount: line.debitAmount })));
  await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() }).where(eq(journalEntry.id, entry.id));
  return reversal;
}
export async function voidBill(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:bills");
  return db.transaction(async tx => {
    const { found, lines, receipts, reservations } = await load(tx, ctx, id);
    if (found.status === "void") fail("Already voided");
    if (found.amountPaid !== 0) fail("Cannot void a bill with recorded payments or applied credits. Unapply or refund settlement first.");
    await assertNotLocked(ctx.organizationId, found.issueDate);
    if (["received", "partial", "paid", "overdue"].includes(found.status) && !found.journalEntryId) unsupported("Posted bill has no recognition journal");
    if (["draft", "pending_approval"].includes(found.status) && found.journalEntryId) unsupported("Bill state and journal disagree");
    if (found.journalEntryId) {
      const entries = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
        sql`(${journalEntry.id} = ${found.journalEntryId} or (${journalEntry.sourceId} = ${id} and ${journalEntry.sourceType} in ('bill','bill_grni')))`)).for("update");
      if (!entries.some(entry => entry.id === found.journalEntryId)) unsupported("Bill recognition journal belongs to another organization");
      if (receipts.size && !entries.some(entry => entry.sourceType === "bill_grni" && entry.sourceId === id)) unsupported("Legacy GRNI bill has no qualified linked clearing history");
      const saved = await tx.select().from(inventoryMovement).where(and(eq(inventoryMovement.organizationId, ctx.organizationId), eq(inventoryMovement.referenceId, id), eq(inventoryMovement.referenceType, "bill"))).orderBy(inventoryMovement.quantity, inventoryMovement.createdAt).for("update");
      const expected = lines.filter(line => line.inventoryItemId && !line.goodsReceiptLineId && billUnits(line.quantity)).map(line => `${line.inventoryItemId}/${line.warehouseId ?? ""}/${billUnits(line.quantity)}`).sort();
      const actual = saved.filter(m => m.quantity > 0).map(m => `${m.inventoryItemId}/${m.warehouseId ?? ""}/${m.quantity}`).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) unsupported("Bill stock receipt history is unqualified; no current-cost reversal");
      const reversals = new Map<string, string>();
      for (const entry of entries) reversals.set(entry.id, (await reverse(tx, ctx, found, entry)).id);
      for (const movement of saved) {
        if (!movement.journalEntryId || !reversals.has(movement.journalEntryId) || movement.quantity < 0) unsupported("Bill movement lacks qualified recognition history");
        const [store] = movement.warehouseId ? await tx.select({ id: warehouse.id }).from(warehouse).where(and(eq(warehouse.id, movement.warehouseId), eq(warehouse.organizationId, ctx.organizationId))) : [];
        if (movement.warehouseId && !store) unsupported("Bill saved stock warehouse belongs to another organization");
        await billStockMovement(tx, ctx, { billId: id, itemId: movement.inventoryItemId, warehouseId: movement.warehouseId,
          quantity: -movement.quantity, value: safeInvoiceMinor(-BigInt(movement.value)), journalEntryId: reversals.get(movement.journalEntryId)!, reverseMovementId: movement.id });
      }
      for (const line of lines) {
        if (!line.goodsReceiptLineId) continue;
        const receipt = receipts.get(line.goodsReceiptLineId)!;
        if (receipt.po && !reservations.some(reservation => reservation.line.id === receipt.po!.id)) {
          const [po] = await tx.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.id, receipt.po.id));
          await tx.update(purchaseOrderLine).set({ quantityBilled: billInt32(BigInt(po.quantityBilled) - BigInt(line.quantity)) }).where(eq(purchaseOrderLine.id, po.id));
        }
        const [other] = await tx.select({ billId: bill.id }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
          .where(and(eq(bill.organizationId, ctx.organizationId), ne(bill.id, id), eq(billLine.goodsReceiptLineId, line.goodsReceiptLineId),
            ne(bill.status, "void"), isNull(bill.deletedAt), sql`${bill.journalEntryId} is not null`));
        const [remainingEntry] = other ? await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
          eq(journalEntry.sourceId, other.billId), eq(journalEntry.sourceType, "bill_grni"), isNull(journalEntry.reversedByEntryId))) :
          await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "goods_receipt"),
            eq(journalEntry.reference, receipt.receipt.receiptNumber), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt), isNull(journalEntry.reversedByEntryId)));
        await tx.update(goodsReceiptLine).set({ journalEntryId: remainingEntry?.id ?? null }).where(eq(goodsReceiptLine.id, line.goodsReceiptLineId));
        const remaining = await tx.select({ id: billLine.id }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
          .innerJoin(goodsReceiptLine, eq(billLine.goodsReceiptLineId, goodsReceiptLine.id)).where(and(eq(goodsReceiptLine.goodsReceiptId, receipt.receipt.id),
            eq(bill.organizationId, ctx.organizationId), ne(bill.id, id), ne(bill.status, "void"), isNull(bill.deletedAt), sql`${bill.journalEntryId} is not null`));
        await tx.update(goodsReceipt).set({ status: remaining.length ? "billed" : "received", updatedAt: new Date() }).where(eq(goodsReceipt.id, receipt.receipt.id));
      }
    }
    for (const reserved of reservations) await tx.update(purchaseOrderLine)
      .set({ quantityBilled: billInt32(BigInt(reserved.line.quantityBilled) - BigInt(reserved.quantity)) }).where(eq(purchaseOrderLine.id, reserved.line.id));
    for (const poId of [...new Set(reservations.map(reservation => reservation.purchaseOrderId))]) {
      const remaining = await tx.select({ quantity: purchaseOrderLine.quantity, quantityBilled: purchaseOrderLine.quantityBilled })
        .from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, poId));
      await tx.update(purchaseOrder).set({ status: derivePurchaseOrderStatusAfterBilling(remaining), updatedAt: new Date() })
        .where(and(eq(purchaseOrder.id, poId), eq(purchaseOrder.organizationId, ctx.organizationId)));
    }
    await tx.update(approvalRequest).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(approvalRequest.organizationId, ctx.organizationId),
      eq(approvalRequest.entityType, "bill"), eq(approvalRequest.entityId, id), eq(approvalRequest.status, "pending")));
    const result = { bill: await update(tx, ctx, id, { status: "void", voidedAt: new Date(), amountDue: 0 }) };
    stringifyWire(result); await audit(tx, ctx, found, "void", request); return result;
  });
}

export async function billApprovalRequestAction(ctx: AuthContext, requestId: string, action: "approve" | "reject" | "comment", comment?: string, request?: Request) {
  z.string().uuid().parse(requestId);
  const pending = await db.query.approvalRequest.findFirst({ where: and(eq(approvalRequest.id, requestId), eq(approvalRequest.organizationId, ctx.organizationId)) });
  if (!pending) throw new AuthError("Approval request not found", 404);
  if (pending.entityType !== "bill") return null;
  return actBillApproval(ctx, pending.entityId, action, { reason: comment }, request, requestId);
}
