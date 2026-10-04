import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, expenseClaim, expenseItem, chartAccount, taxRate, costCenter, member, users, journalEntry, auditLog, attachment } from "@/lib/db/schema";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { softDelete } from "@/lib/db/soft-delete";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { paginatedResponse } from "./pagination";
import { expenseIdField, expenseListSchema, expenseCreateSchema, expenseMcpCreateSchema, expenseUpdateSchema,
  expenseMcpUpdateSchema, expenseAmount, expenseMileageRate, expenseHeaderDto, expenseItemDto, type ExpenseTransport } from "./expense-wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Claim = typeof expenseClaim.$inferSelect;
type Item = typeof expenseItem.$inferSelect;
const personColumns = { id: true, name: true, email: true, image: true } as const;
function unsupported(message: string): never { throw new WireCompatibilityError(message); }
async function lockOrganization(tx: Tx, ctx: AuthContext) {
  const [org] = await tx.select({ id: organization.id, defaultCurrency: organization.defaultCurrency }).from(organization)
    .where(eq(organization.id, ctx.organizationId)).for("update");
  if (!org) throw new AuthError("Organization not found", 404);
  return org;
}
async function load(tx: Tx, ctx: AuthContext, id: string, lock = false) {
  const query = tx.select().from(expenseClaim).where(and(eq(expenseClaim.id, id), eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt)));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new AuthError("Expense claim not found", 404);
  return row;
}
async function person(tx: Tx, ctx: AuthContext, id: string) {
  const [membership] = await tx.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, id)));
  if (!membership) unsupported("Expense user is not a member of this organization");
  const row = await tx.query.users.findFirst({ where: eq(users.id, id), columns: personColumns });
  if (!row) unsupported("Expense references a missing user");
  return row;
}
async function header(tx: Tx, ctx: AuthContext, row: Claim) {
  currencyCodeSchema.parse(row.currencyCode);
  if (row.organizationId !== ctx.organizationId) unsupported("Foreign expense claim");
  if (row.journalEntryId) {
    const [entry] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(and(eq(journalEntry.id, row.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!entry) unsupported("Expense references a missing or foreign journal");
  }
  // No user authentication secrets are part of an expense response.
  return { ...expenseHeaderDto(row), submittedByUser: await person(tx, ctx, row.submittedBy),
    approvedByUser: row.approvedBy ? await person(tx, ctx, row.approvedBy) : null };
}
async function itemRelations(tx: Tx, ctx: AuthContext, item: Pick<Item, "accountId" | "taxRateId" | "costCenterId" | "receiptFileKey">, writable = false) {
  let account: typeof chartAccount.$inferSelect | null = null;
  if (item.accountId) {
    const [row] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, item.accountId), eq(chartAccount.organizationId, ctx.organizationId)));
    if (!row) unsupported("Expense references a missing or foreign account");
    if (writable && (row.deletedAt || !row.isActive || row.type !== "expense")) throw new AuthError("Expense account must be live, active and of expense type", 400);
    account = row;
  }
  if (item.taxRateId) {
    const [row] = await tx.select().from(taxRate).where(and(eq(taxRate.id, item.taxRateId), eq(taxRate.organizationId, ctx.organizationId)));
    if (!row) unsupported("Expense references a missing or foreign tax rate");
    if (!Number.isSafeInteger(row.rate) || row.rate < 0 || row.rate > 2147483647 ||
      !Number.isInteger(row.recoverablePercent) || row.recoverablePercent < 0 || row.recoverablePercent > 10000) unsupported("Invalid saved expense tax metadata");
    if (writable && (row.deletedAt || !row.isActive || row.type === "sales")) throw new AuthError("Expense tax rate must be live, active and applicable to purchases", 400);
  }
  if (item.costCenterId) {
    const [row] = await tx.select().from(costCenter).where(and(eq(costCenter.id, item.costCenterId), eq(costCenter.organizationId, ctx.organizationId)));
    if (!row) unsupported("Expense references a missing or foreign cost center");
    if (writable && (row.deletedAt || !row.isActive)) throw new AuthError("Expense cost center must be live and active", 400);
  }
  if (item.receiptFileKey) {
    const [row] = await tx.select({ id: attachment.id }).from(attachment).where(and(
      eq(attachment.fileKey, item.receiptFileKey), eq(attachment.organizationId, ctx.organizationId)));
    if (!row || !item.receiptFileKey.startsWith(`${ctx.organizationId}/`)) unsupported("Expense receipt must reference an organization-owned uploaded attachment");
  }
  return { account };
}
async function lines(tx: Tx, ctx: AuthContext, row: Claim, writable = false) {
  const items = await tx.select().from(expenseItem).where(eq(expenseItem.expenseClaimId, row.id)).orderBy(expenseItem.sortOrder, expenseItem.id);
  let sum = 0n;
  const result = [];
  for (const item of items) {
    rateDateSchema.parse(item.date);
    const value = expenseItemDto(item); sum += BigInt(value.amountMinor); legacyMinor(sum);
    if (item.isMileage && (item.distanceMiles === null || item.mileageRate === null)) unsupported("Saved mileage line lacks distance or rate");
    result.push({ ...value, ...await itemRelations(tx, ctx, item, writable) });
  }
  if (!items.length || sum !== BigInt(row.totalAmount)) unsupported("Expense total does not match its saved lines");
  return result;
}
async function audit(tx: Tx, ctx: AuthContext, id: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType: "expense", entityId: id, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function openDates(ctx: AuthContext, items: { date: string }[]) {
  for (const date of new Set(items.map(item => item.date))) await assertNotLocked(ctx.organizationId, date, ctx);
}
function editable(row: Claim) {
  if (!["draft", "rejected"].includes(row.status) || row.journalEntryId) throw new AuthError("Only unposted draft or rejected expense claims can be edited or deleted", 400);
}
type InputItem = NonNullable<typeof expenseUpdateSchema._output.items>[number];
async function prepare(tx: Tx, ctx: AuthContext, input: InputItem[], currency: string, transport: ExpenseTransport, saved: Item[] = []) {
  let total = 0n;
  const seen = new Set<string>();
  const processed = [];
  for (const [sortOrder, item] of input.entries()) {
    const old = item.id ? saved.find(row => row.id === item.id) : undefined;
    if (item.id && (!old || seen.has(item.id))) throw new AuthError("Replacement line IDs must be unique existing lines of this claim", 400);
    if (item.id) seen.add(item.id);
    const amount = expenseAmount(item, currency, transport);
    total += BigInt(amount); legacyMinor(total);
    const metadata = { ...old, ...item };
    const rate = expenseMileageRate(item);
    const mileageRate = rate === undefined ? old?.mileageRate ?? null : rate;
    if (metadata.isMileage && (metadata.distanceMiles == null || mileageRate == null)) throw new AuthError("Mileage items require both distanceMiles and mileageRate", 400);
    const row = { date: item.date, description: item.description, amount, category: metadata.category ?? null,
      accountId: metadata.accountId ?? null, taxRateId: metadata.taxRateId ?? null, costCenterId: metadata.costCenterId ?? null,
      receiptFileKey: metadata.receiptFileKey ?? null, receiptFileName: metadata.receiptFileName ?? null,
      isMileage: metadata.isMileage ?? false, distanceMiles: metadata.isMileage ? metadata.distanceMiles ?? null : null,
      mileageRate: metadata.isMileage ? mileageRate : null, sortOrder };
    expenseItemDto(row); await itemRelations(tx, ctx, row, true); processed.push(row);
  }
  await openDates(ctx, processed);
  return { processed, totalAmount: legacyMinor(total) };
}
export async function listExpenseClaims(ctx: AuthContext, input: unknown) {
  const parsed = expenseListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt), parsed.status ? eq(expenseClaim.status, parsed.status) : undefined);
    const rows = await tx.select().from(expenseClaim).where(where).orderBy(desc(expenseClaim.createdAt), desc(expenseClaim.id)).limit(parsed.limit).offset((parsed.page - 1) * parsed.limit);
    const data = [];
    for (const row of rows) { const value = await header(tx, ctx, row); await lines(tx, ctx, row); data.push(value); }
    const [total] = await tx.select({ count: count() }).from(expenseClaim).where(where);
    if (!Number.isSafeInteger(total.count)) unsupported("Expense count exceeds safe numeric range");
    return paginatedResponse(data, total.count, parsed.page, parsed.limit);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getExpenseClaim(ctx: AuthContext, id: string) {
  expenseIdField.parse(id);
  return db.transaction(async tx => { const row = await load(tx, ctx, id);
    const result = { expenseClaim: { ...await header(tx, ctx, row), items: await lines(tx, ctx, row) } };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getExpenseClaimCounts(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.select({ status: expenseClaim.status, count: count(),
      amount: sql<string>`coalesce(sum(${expenseClaim.totalAmount}),0)::text`, min: sql<string>`min(${expenseClaim.totalAmount})::text`,
      max: sql<string>`max(${expenseClaim.totalAmount})::text`, currencies: sql<number>`count(distinct ${expenseClaim.currencyCode})`.mapWith(Number),
      currencyCode: sql<string>`min(${expenseClaim.currencyCode})` }).from(expenseClaim)
      .where(and(eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt))).groupBy(expenseClaim.status);
    const counts: Record<string, { count: number; amount: number; amountMinor: string; currencyCode: string }> = {};
    let total = 0;
    for (const row of rows) {
      if (row.currencies !== 1) unsupported("Expense status totals cannot combine different currencies");
      currencyCodeSchema.parse(row.currencyCode);
      legacyMinor(BigInt(row.max)); if (BigInt(row.min) < 0n) unsupported("Negative saved expense total");
      const amount = legacyMinor(BigInt(row.amount));
      if (!Number.isSafeInteger(row.count) || !Number.isSafeInteger(total + row.count)) unsupported("Expense counts exceed safe numeric range");
      counts[row.status] = { count: row.count, amount, amountMinor: row.amount, currencyCode: row.currencyCode }; total += row.count;
    }
    return { counts, total };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createExpenseClaim(ctx: AuthContext, input: unknown, transport: ExpenseTransport = "rest", request?: Request) {
  requireRole(ctx, "manage:expenses");
  const parsed = (transport === "rest" ? expenseCreateSchema : expenseMcpCreateSchema).parse(input);
  return db.transaction(async tx => {
    const org = await lockOrganization(tx, ctx); await person(tx, ctx, ctx.userId);
    const currencyCode = currencyCodeSchema.parse(parsed.currencyCode ?? org.defaultCurrency);
    const { processed, totalAmount } = await prepare(tx, ctx, parsed.items, currencyCode, transport);
    const [row] = await tx.insert(expenseClaim).values({ organizationId: ctx.organizationId, submittedBy: ctx.userId,
      title: parsed.title, description: parsed.description ?? null, totalAmount, currencyCode }).returning();
    await tx.insert(expenseItem).values(processed.map(item => ({ ...item, expenseClaimId: row.id })));
    const result = { expenseClaim: expenseHeaderDto(row) }; stringifyWire(result);
    await audit(tx, ctx, row.id, "create", { expenseClaim: { ...result.expenseClaim, items: await lines(tx, ctx, row) } }, request); return result;
  });
}
export async function updateExpenseClaim(ctx: AuthContext, id: string, input: unknown, transport: ExpenseTransport = "rest", request?: Request) {
  requireRole(ctx, "manage:expenses"); expenseIdField.parse(id);
  const parsed = (transport === "rest" ? expenseUpdateSchema : expenseMcpUpdateSchema).parse(input);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const old = await load(tx, ctx, id, true); editable(old);
    const before = await header(tx, ctx, old); const saved = await lines(tx, ctx, old, true); await openDates(ctx, saved);
    const prepared = parsed.items ? await prepare(tx, ctx, parsed.items, old.currencyCode, transport, saved) : undefined;
    if (prepared) {
      await tx.delete(expenseItem).where(eq(expenseItem.expenseClaimId, id));
      await tx.insert(expenseItem).values(prepared.processed.map(item => ({ ...item, expenseClaimId: id })));
    }
    const [row] = await tx.update(expenseClaim).set({ title: parsed.title ?? old.title,
      description: parsed.description === undefined ? old.description : parsed.description,
      totalAmount: prepared?.totalAmount ?? old.totalAmount, updatedAt: new Date() })
      .where(and(eq(expenseClaim.id, id), eq(expenseClaim.organizationId, ctx.organizationId))).returning();
    const result = { expenseClaim: expenseHeaderDto(row) }; stringifyWire(result);
    await audit(tx, ctx, id, "update", { before: { ...before, items: saved }, after: { ...result.expenseClaim, items: await lines(tx, ctx, row) } }, request); return result;
  });
}
export async function deleteExpenseClaim(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:expenses"); expenseIdField.parse(id);
  return db.transaction(async tx => {
    await lockOrganization(tx, ctx); const old = await load(tx, ctx, id, true); editable(old);
    const before = await header(tx, ctx, old); const saved = await lines(tx, ctx, old); await openDates(ctx, saved);
    await tx.delete(expenseItem).where(eq(expenseItem.expenseClaimId, id));
    await tx.update(expenseClaim).set({ ...softDelete(), updatedAt: new Date() }).where(and(eq(expenseClaim.id, id), eq(expenseClaim.organizationId, ctx.organizationId)));
    await audit(tx, ctx, id, "delete", { ...before, items: saved }, request); return { success: true };
  });
}

// Lifecycle operations reuse the same tenant, saved-money and reference validation.
export { lockOrganization as lockExpenseOrganization, load as loadExpenseClaim,
  header as expenseClaimHeader, lines as expenseClaimLines, audit as auditExpenseClaim,
  openDates as assertExpenseDatesOpen, person as expenseClaimPerson };
