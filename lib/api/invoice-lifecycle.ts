import { z } from "zod";
import { and, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoice, invoiceLine, organization, contact, chartAccount, taxRate, costCenter, project, inventoryItem, warehouse,
  journalEntry, journalLine, inventoryMovement, numberSequence, member, approvalRequest, approvalAction, approvalWorkflow, approvalWorkflowStep } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { logAudit } from "./audit";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { createHistoricalRateResolver } from "@/lib/currency/historical-rate";
import { toLegacyRate } from "@/lib/currency/exact-rate";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { safeInvoiceMinor } from "./invoice-write-wire";
import { publicLineDto, publicMoneyDto } from "./public-money-wire";
import { journalLineDto } from "./journal-wire";
import { findAccountByCode, ensureAccountByCode } from "./journal-automation";
import { checkApprovalRequired } from "@/lib/approvals/engine";
import { buildRecipientSnapshot } from "@/lib/documents/snapshots";
import { invoiceStock } from "./invoice-stock";
import { lifecycleDto, writeOffSchema, interestSchema, interestOverride, recoveredAmount, exactInterest, convertInvoiceLegs, approveFields, rejectFields } from "./invoice-lifecycle-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Shared bounded exact posting primitives for the receivable credit workflows.
export { rate as receivablePostingRate, post as postReceivable, account as receivableAccount };
type Invoice = typeof invoice.$inferSelect;
type Leg = { accountId: string; debitAmount: number; creditAmount: number; costCenterId?: string | null; projectId?: string | null };
function fail(message: string): never { throw new AuthError(message, 400); }
function scope(ctx: AuthContext, id: string) { return and(eq(invoice.id, id), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt)); }
async function load(tx: Tx, ctx: AuthContext, id: string) {
  z.string().uuid().parse(id);
  const [org] = await tx.select().from(organization).where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  const [found] = await tx.select().from(invoice).where(scope(ctx, id)).for("update");
  if (!found) throw new AuthError("Invoice not found", 404);
  lifecycleDto(found); currencyCodeSchema.parse(found.currencyCode); rateDateSchema.parse(found.issueDate); rateDateSchema.parse(found.dueDate);
  const [customer] = await tx.select().from(contact).where(and(eq(contact.id, found.contactId), eq(contact.organizationId, ctx.organizationId))).for("share");
  if (!customer) throw new AuthError("Invoice contact belongs to another organization", 422);
  const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, id)).orderBy(invoiceLine.sortOrder, invoiceLine.id);
  lines.forEach(publicLineDto);
  // Corrupt retained references cannot be posted into another tenant's books.
  for (const [key, table] of [["accountId", chartAccount], ["taxRateId", taxRate], ["costCenterId", costCenter],
    ["projectId", project], ["inventoryItemId", inventoryItem], ["warehouseId", warehouse]] as const) {
    const ids = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (ids.length) {
      const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, ctx.organizationId), inArray(table.id, ids))).for("share");
      if (rows.length !== ids.length) throw new AuthError(`Invoice ${key} belongs to another organization`, 422);
    }
  }
  return { found, org, customer, lines };
}
async function number(tx: Tx, orgId: string) {
  const [max] = await tx.select({ value: sql<string>`coalesce(max(${journalEntry.entryNumber}),0)::text` }).from(journalEntry).where(eq(journalEntry.organizationId, orgId));
  const value = BigInt(max.value) + 1n;
  if (value > 2147483647n) fail("Journal numbering exceeds int32 capacity");
  return Number(value);
}
async function nextInvoiceNumber(tx: Tx, orgId: string) {
  const [sequence] = await tx.select().from(numberSequence).where(and(eq(numberSequence.organizationId, orgId), eq(numberSequence.entityType, "invoice"))).for("update");
  const [max] = sequence ? [] : await tx.select({ value: sql<string>`coalesce(max(nullif(regexp_replace(${invoice.invoiceNumber}, '^[A-Z]+-', ''), '')::numeric),0)::text` }).from(invoice).where(eq(invoice.organizationId, orgId));
  const value = BigInt(sequence?.lastNumber ?? max.value) + 1n;
  if (value > 2147483647n || value < 1n) fail("Invoice numbering exceeds int32 capacity");
  if (sequence) await tx.update(numberSequence).set({ lastNumber: Number(value) }).where(eq(numberSequence.id, sequence.id));
  else await tx.insert(numberSequence).values({ organizationId: orgId, entityType: "invoice", prefix: "INV", lastNumber: Number(value) });
  return `INV-${String(value).padStart(5, "0")}`;
}
async function account(tx: Tx, orgId: string, code: string, definition?: { name: string; type: "asset" | "liability" | "revenue" | "expense"; subType: string }, base = "USD") {
  const found = definition ? await ensureAccountByCode(orgId, { code, ...definition }, base, tx) : await findAccountByCode(orgId, code, tx);
  if (!found || !found.isActive || found.deletedAt) fail(`Active account (${code}) not found`);
  return found;
}
async function rate(ctx: AuthContext, currency: string, base: string, date: string) {
  const value = await createHistoricalRateResolver(ctx.organizationId)(currency, base, date);
  if (!value) throw new MissingExchangeRateError(currency, base, date);
  try { toLegacyRate(value.rateExact); } catch { throw new WireCompatibilityError("Posting FX cannot coexist exactly with legacy millionths"); }
  return value;
}
async function documentRate(tx: Tx, ctx: AuthContext, found: Invoice, base: string) {
  if (!found.journalEntryId) return rate(ctx, found.currencyCode, base, found.issueDate);
  const snapshot = found.senderSnapshot as { baseCurrencyCode?: string } | null;
  if (snapshot?.baseCurrencyCode && snapshot.baseCurrencyCode !== base)
    throw new WireCompatibilityError("Organization base currency changed after invoice recognition");
  const [entry] = await tx.select({ id: journalEntry.id, sourceType: journalEntry.sourceType, sourceId: journalEntry.sourceId }).from(journalEntry).where(and(eq(journalEntry.id, found.journalEntryId),
    eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt)));
  if (!entry) throw new WireCompatibilityError("Invoice recognition journal is unavailable in this organization");
  if (entry.sourceType !== "invoice" || (entry.sourceId !== null && entry.sourceId !== found.id))
    throw new WireCompatibilityError("Invoice recognition journal belongs to another document");
  const saved = await tx.select({ rateExact: sql<string | null>`${journalLine.rateExact}::text`, rate: journalLine.exchangeRate,
    direction: journalLine.rateDirection, version: journalLine.rateFormatVersion, status: journalLine.rateMigrationStatus,
    currency: journalLine.currencyCode, provenance: journalLine.rateProvenance }).from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
  const first = saved[0];
  if (!first?.rateExact || saved.some(row => row.currency !== found.currencyCode || row.rateExact !== first.rateExact ||
    row.direction !== "quote_per_base" || row.version !== 1 || row.status !== "exact" ||
    !savedRateMatches(row.rateExact, row.rate)))
    throw new WireCompatibilityError("Invoice bad debt requires consistent saved recognition FX and base currency");
  return { rateExact: first.rateExact, source: "saved_recognition", effectiveDate: found.issueDate };
}
function savedRateMatches(value: string | null, legacy: number) {
  try { return value !== null && toLegacyRate(value) === legacy; } catch { return false; }
}
async function post(tx: Tx, ctx: AuthContext, data: { date: string; description: string; reference: string; sourceType: string; sourceId: string },
  legs: Leg[], currency: string, base: string, fx: { rateExact: string; source: string; effectiveDate: string }) {
  const values = convertInvoiceLegs(legs, currency, base, fx.rateExact);
  if (!values.length || !values.some(line => line.debitAmount || line.creditAmount)) fail("Invoice posting requires nonzero journal legs");
  const [entry] = await tx.insert(journalEntry).values({ ...data, organizationId: ctx.organizationId, entryNumber: await number(tx, ctx.organizationId),
    status: "posted", postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(values.map(line => ({ ...line, journalEntryId: entry.id, description: data.description,
    currencyCode: currency, exchangeRate: toLegacyRate(fx.rateExact), rateExact: fx.rateExact, rateDirection: "quote_per_base",
    // Coexistence triggers assign canonical legacy transaction provenance.
    rateFormatVersion: 1, rateMigrationStatus: "exact", rateProvenance: "legacy_scaled_1e6:transaction" })));
  stringifyWire(entry); return entry;
}
async function update(tx: Tx, ctx: AuthContext, id: string, values: Partial<typeof invoice.$inferInsert>) {
  const [row] = await tx.update(invoice).set({ ...values, updatedAt: new Date() }).where(scope(ctx, id)).returning();
  if (!row) throw new AuthError("Invoice changed before update", 409);
  return lifecycleDto(row);
}
async function audit(ctx: AuthContext, id: string, action: string, request?: Request, changes?: Record<string, unknown>) {
  await logAudit({ ctx, entityType: "invoice", entityId: id, action, request, changes });
}

/** Recognize revenue and COGS atomically before any optional external email delivery. */
export async function sendInvoice(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:invoices");
  const result = await db.transaction(tx => sendInvoiceInTransaction(tx, ctx, id));
  await audit(ctx, id, "send", request, { previousStatus: "draft" }); return result;
}

/** Internal scheduler reuse; caller supplies authorization and an organization transaction. */
export async function sendInvoiceInTransaction(tx: Tx, ctx: AuthContext, id: string) {
  const { found, lines, org, customer } = await load(tx, ctx, id);
  if (found.status !== "draft" || found.journalEntryId) fail("Only unposted draft invoices can be sent");
  await assertNotLocked(ctx.organizationId, found.issueDate, ctx);
  const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD"), fx = await rate(ctx, found.currencyCode, base, found.issueDate);
  const ar = await account(tx, ctx.organizationId, "1200");
  const revenue = lines.map(line => {
    if (!line.accountId || line.amount < 0 || line.taxAmount < 0) fail("Sending requires nonnegative lines with revenue accounts");
    return { accountId: line.accountId, debitAmount: 0, creditAmount: line.amount, costCenterId: line.costCenterId, projectId: line.projectId };
  });
  const subtotal = safeInvoiceMinor(lines.reduce((s, line) => s + BigInt(line.amount), 0n));
  const tax = safeInvoiceMinor(lines.reduce((s, line) => s + BigInt(line.taxAmount), 0n));
  if (subtotal !== found.subtotal || tax !== found.taxTotal || safeInvoiceMinor(BigInt(subtotal) + BigInt(tax)) !== found.total || found.total <= 0 ||
    found.amountPaid !== 0 || found.amountDue !== found.total) fail("Invoice header and line balances must agree before sending");
  const accountIds = [...new Set(revenue.map(line => line.accountId))];
  const active = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId),
    inArray(chartAccount.id, accountIds), eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt))).for("share");
  if (active.length !== accountIds.length) fail("Invoice revenue accounts must be active");
  if (tax > 0) revenue.push({ accountId: (await account(tx, ctx.organizationId, "2200")).id, debitAmount: 0, creditAmount: tax, costCenterId: null, projectId: null });
  const entry = await post(tx, ctx, { date: found.issueDate, description: `Invoice ${found.invoiceNumber}`, reference: found.invoiceNumber,
    sourceType: "invoice", sourceId: id }, [{ accountId: ar.id, debitAmount: found.total, creditAmount: 0 }, ...revenue], found.currencyCode, base, fx);
  const stock = await invoiceStock(tx, ctx, base, id, lines);
  if (stock.legs.length) {
    const cogs = await post(tx, ctx, { date: found.issueDate, description: `Cost of sales ${found.invoiceNumber}`, reference: found.invoiceNumber,
      sourceType: "inventory_cogs", sourceId: id }, stock.legs, base, base, { rateExact: "1", source: "same", effectiveDate: found.issueDate });
    await tx.update(inventoryMovement).set({ journalEntryId: cogs.id }).where(inArray(inventoryMovement.id, stock.movements));
  }
  const senderSnapshot = { name: org.name || "Company", baseCurrencyCode: base, address: [org.addressStreet, org.addressCity, org.addressState, org.addressPostalCode, org.addressCountry].filter(Boolean).join(", ") || null,
    taxId: org.taxId, registrationNumber: org.businessRegistrationNumber, phone: org.contactPhone, email: org.contactEmail, countryCode: org.countryCode };
  return { invoice: await update(tx, ctx, id, { status: "sent", sentAt: new Date(), journalEntryId: entry.id, senderSnapshot, recipientSnapshot: buildRecipientSnapshot(customer) }) };
}

async function reverseEntry(tx: Tx, ctx: AuthContext, id: string, found: Invoice) {
  const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt))).for("update");
  if (!entry || entry.status !== "posted" || entry.reversedByEntryId) fail("Invoice journal must be a posted unreversed organization entry");
  if (entry.sourceType !== (id === found.journalEntryId ? "invoice" : "inventory_cogs") || (entry.sourceId !== null && entry.sourceId !== found.id))
    throw new WireCompatibilityError("Invoice journal belongs to another document");
  const lines = await tx.select({ id: journalLine.id, accountId: journalLine.accountId, debitAmount: journalLine.debitAmount, creditAmount: journalLine.creditAmount,
    currencyCode: journalLine.currencyCode, exchangeRate: journalLine.exchangeRate, rateExact: sql<string | null>`${journalLine.rateExact}::text`,
    rateDirection: journalLine.rateDirection, rateFormatVersion: journalLine.rateFormatVersion, rateMigrationStatus: journalLine.rateMigrationStatus,
    rateProvenance: journalLine.rateProvenance, costCenterId: journalLine.costCenterId, projectId: journalLine.projectId }).from(journalLine).where(eq(journalLine.journalEntryId, id));
  if (!lines.length) fail("Invoice journal has no saved lines");
  const ids = [...new Set(lines.map(line => line.accountId))];
  const owned = await tx.select({ id: chartAccount.id }).from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId), inArray(chartAccount.id, ids)));
  if (owned.length !== ids.length) throw new AuthError("Invoice journal account belongs to another organization", 422);
  for (const [key, table] of [["costCenterId", costCenter], ["projectId", project]] as const) {
    const dimensions = [...new Set(lines.flatMap(line => line[key] ? [line[key]!] : []))];
    if (!dimensions.length) continue;
    const rows = await tx.select({ id: table.id }).from(table).where(and(eq(table.organizationId, ctx.organizationId), inArray(table.id, dimensions)));
    if (rows.length !== dimensions.length) throw new AuthError(`Invoice journal ${key} belongs to another organization`, 422);
  }
  for (const line of lines) {
    journalLineDto(line);
    if (!line.rateExact || line.rateMigrationStatus !== "exact" || line.rateFormatVersion !== 1 || line.rateDirection !== "quote_per_base")
      throw new WireCompatibilityError("Invoice reversal requires qualified saved FX; no historical rate repair");
  }
  const debit = safeInvoiceMinor(lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n));
  const credit = safeInvoiceMinor(lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n));
  if (debit !== credit) fail("Invoice journal saved legs must balance");
  const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber: await number(tx, ctx.organizationId), date: found.issueDate,
    description: `Void invoice ${found.invoiceNumber}`, reference: found.invoiceNumber, status: "posted", sourceType: "invoice_void", sourceId: found.id,
    reversesEntryId: entry.id, postedAt: new Date(), createdBy: ctx.userId }).returning();
  await tx.insert(journalLine).values(lines.map(line => ({ accountId: line.accountId, currencyCode: line.currencyCode, exchangeRate: line.exchangeRate,
    rateExact: line.rateExact, rateDirection: line.rateDirection, rateFormatVersion: line.rateFormatVersion,
    rateMigrationStatus: line.rateMigrationStatus, rateProvenance: line.rateProvenance, costCenterId: line.costCenterId, projectId: line.projectId, journalEntryId: reversal.id,
    debitAmount: line.creditAmount, creditAmount: line.debitAmount, description: `Void invoice ${found.invoiceNumber}` })));
  await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, updatedAt: new Date() }).where(eq(journalEntry.id, entry.id));
}
export async function voidInvoice(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "approve:invoices");
  let previousStatus: string | undefined;
  const result = await db.transaction(async tx => {
    const { found, org, lines } = await load(tx, ctx, id);
    previousStatus = found.status;
    if (found.status === "void") fail("Already voided");
    if (found.amountPaid !== 0) fail("Cannot void an invoice with recorded payments or applied credit notes. Unapply or refund the settlement first, then void.");
    await assertNotLocked(ctx.organizationId, found.issueDate, ctx);
    const posted = ["sent", "partial", "paid", "overdue"].includes(found.status) || !!found.journalEntryId;
    if (posted) {
      if (!found.journalEntryId) fail("Posted invoice has no recognition journal");
      await reverseEntry(tx, ctx, found.journalEntryId, found);
      const base = org.defaultCurrency ?? "USD";
      const stock = await invoiceStock(tx, ctx, base, id, lines, true);
      if (stock.legs.length) {
        const originals = await tx.select().from(journalEntry).where(and(eq(journalEntry.organizationId, ctx.organizationId),
          eq(journalEntry.sourceType, "inventory_cogs"), eq(journalEntry.sourceId, id)));
        if (originals.length) {
          for (const original of originals) await reverseEntry(tx, ctx, original.id, found);
          const [reversal] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(eq(journalEntry.reversesEntryId, originals[0].id));
          await tx.update(inventoryMovement).set({ journalEntryId: reversal.id }).where(inArray(inventoryMovement.id, stock.movements));
        } else {
          // Legacy issues have no invoice source ID; preserve their previous restock policy.
          const cogs = await post(tx, ctx, { date: found.issueDate, description: `Restock ${found.invoiceNumber}`, reference: found.invoiceNumber,
            sourceType: "inventory_cogs_reversal", sourceId: id }, stock.legs, base, base, { rateExact: "1", source: "same", effectiveDate: found.issueDate });
          await tx.update(inventoryMovement).set({ journalEntryId: cogs.id }).where(inArray(inventoryMovement.id, stock.movements));
        }
      }
    }
    await tx.update(approvalRequest).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(approvalRequest.organizationId, ctx.organizationId),
      eq(approvalRequest.entityType, "invoice"), eq(approvalRequest.entityId, id), eq(approvalRequest.status, "pending")));
    return { invoice: await update(tx, ctx, id, { status: "void", voidedAt: new Date(), amountDue: 0 }) };
  });
  await audit(ctx, id, "void", request, { previousStatus }); return result;
}

export async function invoiceBadDebt(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "approve:invoices"); const parsed = writeOffSchema.parse(input);
  let previousStatus: string | undefined;
  const result = await db.transaction(async tx => {
    const { found, org } = await load(tx, ctx, id);
    previousStatus = found.status;
    await assertNotLocked(ctx.organizationId, found.issueDate, ctx);
    const base = org.defaultCurrency ?? "USD", fx = await documentRate(tx, ctx, found, base);
    if (parsed.action === "recover") {
      if (!found.writtenOffAt) fail("Invoice has not been written off; nothing to recover");
      const amount = recoveredAmount(parsed, found.total);
      convertInvoiceLegs([{ debitAmount: amount, creditAmount: 0 }, { debitAmount: 0, creditAmount: amount }], found.currencyCode, base, fx.rateExact);
      const bank = await account(tx, ctx.organizationId, parsed.bankAccountCode ?? "1100", parsed.bankAccountCode ? undefined :
        { name: "Checking Account", type: "asset", subType: "bank" }, base);
      const income = await account(tx, ctx.organizationId, "4400", { name: "Bad Debt Recovered", type: "revenue", subType: "non_operating" }, base);
      await post(tx, ctx, { date: found.issueDate, description: `Bad debt recovery ${found.invoiceNumber}`, reference: found.invoiceNumber,
        sourceType: "bad_debt_recovery", sourceId: id }, [{ accountId: bank.id, debitAmount: amount, creditAmount: 0 }, { accountId: income.id, debitAmount: 0, creditAmount: amount }], found.currencyCode, base, fx);
      return { invoice: lifecycleDto(found), ...publicMoneyDto({ recovered: amount }, ["recovered"]) };
    }
    if (parsed.amount !== undefined || parsed.amountMinor !== undefined || parsed.bankAccountCode !== undefined) fail("Recovery fields require action recover");
    if (found.writtenOffAt || !["sent", "partial", "overdue"].includes(found.status)) fail("Only outstanding sent invoices can be written off");
    const due = found.amountDue > 0 ? found.amountDue : safeInvoiceMinor(BigInt(found.total) - BigInt(found.amountPaid));
    if (due <= 0) fail("Nothing outstanding to write off");
    convertInvoiceLegs([{ debitAmount: due, creditAmount: 0 }, { debitAmount: 0, creditAmount: due }], found.currencyCode, base, fx.rateExact);
    const ar = await account(tx, ctx.organizationId, "1200");
    const loss = parsed.method === "allowance" ? await account(tx, ctx.organizationId, "1290", { name: "Allowance for Doubtful Accounts", type: "asset", subType: "current" }, base) :
      await account(tx, ctx.organizationId, "6500", { name: "Bad Debt Expense", type: "expense", subType: "operating" }, base);
    await post(tx, ctx, { date: found.issueDate, description: `Bad debt write-off ${found.invoiceNumber}`, reference: found.invoiceNumber,
      sourceType: "bad_debt_write_off", sourceId: id }, [{ accountId: loss.id, debitAmount: due, creditAmount: 0 }, { accountId: ar.id, debitAmount: 0, creditAmount: due }], found.currencyCode, base, fx);
    return { invoice: await update(tx, ctx, id, { status: "void", writtenOffAt: new Date(), amountDue: 0 }),
      ...publicMoneyDto({ amountWrittenOff: due }, ["amountWrittenOff"]), method: parsed.method };
  });
  await audit(ctx, id, parsed.action === "recover" ? "bad-debt-recover" : "bad-debt-write-off", request,
    "recovered" in result ? { amount: result.recovered } : { previousStatus, method: parsed.method, amountWrittenOff: result.amountWrittenOff });
  return result;
}

function interestSettings(org: typeof organization.$inferSelect) {
  if (!org.interestRate) fail("No interest rate configured for this organization");
  if (!Number.isInteger(org.interestRate) || org.interestRate < 1 || org.interestRate > 2147483647 ||
    !Number.isInteger(org.interestGraceDays ?? 0) || (org.interestGraceDays ?? 0) < 0 || (org.interestGraceDays ?? 0) > 36500 ||
    !["simple", "compound"].includes(org.interestMethod || "simple"))
    throw new WireCompatibilityError("Unsupported invoice interest configuration");
}
function overdue(found: Invoice, org: typeof organization.$inferSelect, today: string) {
  interestSettings(org);
  const days = Math.floor((Date.parse(today) - Date.parse(found.dueDate)) / 86400000) - (org.interestGraceDays ?? 0);
  if (days <= 0) fail("Invoice is not overdue or is within grace period");
  if (days > 36500) throw new WireCompatibilityError("Invoice interest supports at most 36500 overdue days");
  return days;
}
export async function calculateInvoiceInterest(ctx: AuthContext) {
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.organizationId));
  if (!org?.interestRate) fail("No interest rate configured for this organization");
  interestSettings(org);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(invoice).where(and(eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt),
    notInArray(invoice.status, ["draft", "void", "paid", "pending_approval", "rejected"]), lt(invoice.dueDate, today)));
  const data = rows.flatMap(row => {
    lifecycleDto(row); const days = Math.floor((Date.parse(today) - Date.parse(row.dueDate)) / 86400000) - (org.interestGraceDays ?? 0);
    if (days <= 0) return [];
    const amount = exactInterest(row.amountDue, org.interestRate!, days, org.interestMethod || "simple");
    return amount > 0 ? [publicMoneyDto({ invoiceId: row.id, invoiceNumber: row.invoiceNumber, currencyCode: row.currencyCode,
      amountDue: row.amountDue, daysOverdue: days, interestAmount: amount }, ["amountDue", "interestAmount"])] : [];
  });
  stringifyWire(data); return { data };
}
export async function chargeInvoiceInterest(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:invoices"); const parsed = interestSchema.parse(input);
  let previousStatus: string | undefined;
  const result = await db.transaction(async tx => {
    const { found, org } = await load(tx, ctx, id);
    previousStatus = found.status;
    if (!["sent", "partial", "overdue"].includes(found.status)) fail("Cannot charge interest on this invoice status");
    const today = new Date().toISOString().slice(0, 10), daysOverdue = overdue(found, org, today);
    await assertNotLocked(ctx.organizationId, found.issueDate, ctx); await assertNotLocked(ctx.organizationId, today, ctx);
    const amount = interestOverride(parsed, found.currencyCode) ?? exactInterest(found.amountDue, org.interestRate!, daysOverdue, org.interestMethod || "simple");
    if (amount <= 0) fail("Interest amount must be positive");
    const base = org.defaultCurrency ?? "USD", fx = await rate(ctx, found.currencyCode, base, today);
    const ar = await account(tx, ctx.organizationId, "1200"), income = await account(tx, ctx.organizationId, "4100");
    // Preflight converted output before numbering or document mutations.
    const legs = [{ accountId: ar.id, debitAmount: amount, creditAmount: 0 }, { accountId: income.id, debitAmount: 0, creditAmount: amount }];
    convertInvoiceLegs(legs, found.currencyCode, base, fx.rateExact);
    const invoiceNumber = await nextInvoiceNumber(tx, ctx.organizationId);
    const [created] = await tx.insert(invoice).values({ organizationId: ctx.organizationId, contactId: found.contactId, invoiceNumber,
      issueDate: today, dueDate: today, status: "sent", sentAt: new Date(), reference: `Interest on ${found.invoiceNumber}`,
      notes: `Late payment interest charge for invoice ${found.invoiceNumber} (${daysOverdue} days overdue)`, subtotal: amount, total: amount,
      taxTotal: 0, amountPaid: 0, amountDue: amount, currencyCode: found.currencyCode, senderSnapshot: { name: org.name, baseCurrencyCode: base }, createdBy: ctx.userId }).returning();
    await tx.insert(invoiceLine).values({ invoiceId: created.id, description: `Late payment interest on invoice ${found.invoiceNumber} (${daysOverdue} days overdue)`,
      accountId: income.id, quantity: 100, unitPrice: amount, amount, taxAmount: 0, sortOrder: 0 });
    const entry = await post(tx, ctx, { date: today, description: `Interest charge for overdue invoice ${found.invoiceNumber}`, reference: invoiceNumber,
      sourceType: "invoice", sourceId: created.id }, legs, found.currencyCode, base, fx);
    return { invoice: await update(tx, ctx, created.id, { journalEntryId: entry.id }), journalEntry: entry, originalInvoiceId: id, daysOverdue,
      ...publicMoneyDto({ interestAmount: amount }, ["interestAmount"]) };
  });
  await audit(ctx, id, "charge_interest", request, { previousStatus, interestInvoiceId: result.invoice.id, interestAmount: result.interestAmount }); return result;
}

export async function submitInvoiceApproval(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:invoices");
  const result = await db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== "draft") fail("Only draft invoices can be submitted for approval");
    await assertNotLocked(ctx.organizationId, found.issueDate, ctx);
    const requester = await tx.query.member.findFirst({ where: and(eq(member.userId, ctx.userId), eq(member.organizationId, ctx.organizationId)) });
    if (!requester) throw new AuthError("Member not found", 404);
    const workflow = await checkApprovalRequired(ctx.organizationId, "invoice", found, tx);
    if (!workflow || !workflow.steps.length) fail("No active approval workflow configured for invoices");
    const approvers = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), inArray(member.id, workflow.steps.map(step => step.approverId))));
    if (workflow.steps.some(step => !approvers.some(row => row.id === step.approverId))) fail("Workflow approver belongs to another organization");
    await tx.insert(approvalRequest).values({ organizationId: ctx.organizationId, workflowId: workflow.id, entityType: "invoice", entityId: id,
      requestedById: requester.id, currentStepOrder: workflow.steps[0].stepOrder });
    return { invoice: await update(tx, ctx, id, { status: "pending_approval" }) };
  });
  await audit(ctx, id, "submit_for_approval", request, { previousStatus: "draft" }); return result;
}
export async function actInvoiceApproval(ctx: AuthContext, id: string, action: "approve" | "reject" | "comment", input: unknown,
  request?: Request, requestId?: string) {
  if (action !== "comment") requireRole(ctx, "approve:invoices");
  const comment = action === "reject" ? z.object(rejectFields).parse(input).reason : z.object(approveFields).parse(input).comment;
  const result = await db.transaction(async tx => {
    const { found } = await load(tx, ctx, id);
    if (found.status !== "pending_approval") fail("Only invoices pending approval can be acted on");
    await assertNotLocked(ctx.organizationId, found.issueDate, ctx);
    const approver = await tx.query.member.findFirst({ where: and(eq(member.userId, ctx.userId), eq(member.organizationId, ctx.organizationId)) });
    if (!approver) throw new AuthError("Member not found", 404);
    const requests = await tx.select().from(approvalRequest).where(and(eq(approvalRequest.organizationId, ctx.organizationId), eq(approvalRequest.entityType, "invoice"),
      eq(approvalRequest.entityId, id), eq(approvalRequest.status, "pending"), requestId ? eq(approvalRequest.id, requestId) : undefined)).for("update");
    if (requests.length !== 1) fail("Exactly one pending approval request is required for this invoice");
    const pending = requests[0];
    const workflow = await tx.query.approvalWorkflow.findFirst({ where: and(eq(approvalWorkflow.id, pending.workflowId), eq(approvalWorkflow.organizationId, ctx.organizationId)) });
    if (!workflow) fail("Invoice approval workflow belongs to another organization");
    const steps = await tx.select().from(approvalWorkflowStep).where(eq(approvalWorkflowStep.workflowId, workflow.id)).orderBy(approvalWorkflowStep.stepOrder);
    const step = steps.find(value => value.stepOrder === pending.currentStepOrder);
    if (!step) fail("Current workflow step not found");
    if (action !== "comment" && step.approverId !== approver.id) throw new AuthError("You are not the approver for the current step", 403);
    await tx.insert(approvalAction).values({ requestId: pending.id, stepId: step.id, userId: approver.id, action, comment: comment ?? null });
    if (action === "comment") return { invoice: lifecycleDto(found), request: pending };
    const next = steps.find(value => value.stepOrder > step.stepOrder);
    const status = action === "reject" ? "rejected" : next ? "pending" : "approved";
    const [updatedRequest] = await tx.update(approvalRequest).set({ status, currentStepOrder: next && action === "approve" ? next.stepOrder : pending.currentStepOrder, updatedAt: new Date() })
      .where(eq(approvalRequest.id, pending.id)).returning();
    stringifyWire(updatedRequest);
    const updated = status === "pending" ? lifecycleDto(found) : await update(tx, ctx, id, { status: status === "approved" ? "draft" : "rejected" });
    return { invoice: updated, request: updatedRequest };
  });
  await audit(ctx, id, action, request, { previousStatus: "pending_approval" }); return result;
}

/** Shared request boundary for generic approval UI/MCP, preventing bypass of invoice preflight. */
export async function invoiceApprovalRequestAction(ctx: AuthContext, requestId: string, action: "approve" | "reject" | "comment", comment?: string, request?: Request) {
  z.string().uuid().parse(requestId);
  const pending = await db.query.approvalRequest.findFirst({ where: and(eq(approvalRequest.id, requestId), eq(approvalRequest.organizationId, ctx.organizationId)) });
  if (!pending) throw new AuthError("Approval request not found", 404);
  if (pending.entityType !== "invoice") return null;
  return actInvoiceApproval(ctx, pending.entityId, action, action === "reject" ? { reason: comment } : { comment }, request, requestId);
}
