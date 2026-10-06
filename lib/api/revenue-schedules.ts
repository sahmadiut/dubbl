import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { revenueSchedule, revenueEntry, chartAccount, journalEntry, journalLine, organization, auditLog, invoice, invoiceLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { revenueId, revenueInput, revenuePeriods, revenueDto, revenueEntryDto, revenueRecognizeSchema, revenueListSchema, revenuePreflight } from "./revenue-wire";
import { assetMoneyDto } from "./asset-master-wire";
import { currencyMetadata } from "@/lib/money/exact";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { getNextEntryNumber } from "./journal-automation";
import { assertNotLocked } from "./period-lock";

type Schedule = typeof revenueSchedule.$inferSelect;
const scope = (ctx: AuthContext, id?: string) => and(eq(revenueSchedule.organizationId, ctx.organizationId), id ? eq(revenueSchedule.id, id) : undefined);
const unsupported = (message: string): never => { throw new AuthError(message, 422); };
function retryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  return e.code === "40001" || e.code === "40P01" || (e.code === "23505" && e.constraint === "journal_entry_org_number_idx") ||
    (e.cause !== undefined && retryable(e.cause));
}
/** Failed attempts roll back; number collisions with legacy writers reload under lock. */
async function write<T>(handler: (tx: TaxTx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.transaction(handler); }
    catch (error) { if (attempt >= 2 || !retryable(error)) throw error; }
  }
}
async function base(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization)
    .where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)));
  if (!org) throw new AuthError("Organization not found", 404);
  try { currencyMetadata(org.currency); } catch { unsupported("Unsupported saved revenue base currency"); }
  return org.currency;
}
async function links(tx: TaxTx, ctx: AuthContext, row: Pick<Schedule, "invoiceId" | "invoiceLineId" | "deferredRevenueAccountId" | "revenueAccountId">, live = false, recognizing = false) {
  const currency = await base(tx, ctx);
  const q = tx.select().from(invoice).where(and(eq(invoice.id, row.invoiceId), eq(invoice.organizationId, ctx.organizationId)));
  const [source] = await (live ? q.for("share") : q);
  if (!source) throw new AuthError("Revenue invoice not found in organization", live ? 404 : 422);
  try { currencyMetadata(source.currencyCode); } catch { unsupported("Unsupported invoice currency"); }
  if (live && (source.deletedAt || source.status === "void")) unsupported("Revenue invoice must be live and not void");
  if (recognizing && !["sent", "partial", "paid", "overdue"].includes(source.status)) unsupported("Recognition requires an issued invoice");
  let lineAccount: string | null = null;
  if (row.invoiceLineId) {
    const lq = tx.select().from(invoiceLine).where(and(eq(invoiceLine.id, row.invoiceLineId), eq(invoiceLine.invoiceId, source.id)));
    const [line] = await (live ? lq.for("share") : lq);
    if (!line) throw new AuthError("Revenue line not found in invoice", live ? 404 : 422);
    lineAccount = line.accountId;
  }
  async function account(id: string | null, code: string, type: "liability" | "revenue") {
    const aq = tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, ctx.organizationId),
      id ? eq(chartAccount.id, id) : eq(chartAccount.code, code)));
    const [a] = await (live ? aq.for("share") : aq);
    if (!a) throw new AuthError("Revenue posting account not found in organization", live ? 404 : 422);
    if (live && (a.deletedAt || !a.isActive || a.type !== type || a.currencyCode !== source.currencyCode))
      unsupported("Revenue posting requires live active liability/revenue accounts in invoice currency");
    return revenuePreflight(a);
  }
  // Explicit stored account references are honored. A foreign line account never falls back to 4000.
  const deferred = await account(row.deferredRevenueAccountId, "2300", "liability");
  const revenue = await account(row.revenueAccountId ?? lineAccount, "4000", "revenue");
  if (deferred.id === revenue.id) unsupported("Revenue posting accounts must be distinct");
  return { deferred, revenue, currency, invoiceCurrency: source.currencyCode };
}
async function load(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  const q = tx.select().from(revenueSchedule).where(scope(ctx, id));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AuthError("Revenue schedule not found", 404);
  revenueDto(row);
  if (!["straight_line", "milestone", "on_completion"].includes(row.method) || !["active", "completed", "cancelled"].includes(row.status)) unsupported("Unsupported saved revenue method or status");
  return row;
}
async function history(tx: TaxTx, ctx: AuthContext, row: Schedule) {
  if (!["straight_line", "milestone", "on_completion"].includes(row.method) || !["active", "completed", "cancelled"].includes(row.status)) unsupported("Unsupported saved revenue method or status");
  let expected;
  try { expected = revenuePeriods(row.totalAmount, row.startDate, row.endDate); }
  catch { return unsupported("Unsupported saved revenue amount, dates or periods"); }
  const entries = await tx.select().from(revenueEntry).where(eq(revenueEntry.scheduleId, row.id)).orderBy(asc(revenueEntry.sortOrder), asc(revenueEntry.id));
  if (entries.length !== expected.length) unsupported("Saved revenue schedule is incomplete");
  let unposted = false;
  const journals = new Set<string>();
  const { deferred, revenue, invoiceCurrency: currency } = await links(tx, ctx, row);
  let recognized = 0n;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]; revenueEntryDto(e);
    if (e.amount !== expected[i].amount || e.periodDate !== expected[i].periodDate || e.sortOrder !== i) unsupported("Saved revenue allocation, order or dates disagree");
    if (!e.recognized) { unposted = true; if (e.journalEntryId) unsupported("Unposted revenue has journal history"); continue; }
    if (unposted || !e.journalEntryId || journals.has(e.journalEntryId)) unsupported("Revenue posting history is duplicate or out of order");
    journals.add(e.journalEntryId!); recognized += BigInt(e.amount);
    const [j] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, e.journalEntryId!), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!j || j.deletedAt || j.status !== "posted" || j.sourceType !== "revenue_recognition" || j.sourceId !== row.id || j.date !== e.periodDate)
      unsupported("Saved revenue journal does not match its period");
    const legs = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, j!.id));
    if (legs.length !== 2) unsupported("Revenue journal must contain two balanced legs");
    const used = new Set<string>();
    for (const l of legs) {
      assetMoneyDto(l, ["debitAmount", "creditAmount"]);
      const debit = l.accountId === deferred.id;
      if (used.has(l.accountId) || (!debit && l.accountId !== revenue.id) ||
        l.debitAmount !== (debit ? e.amount : 0) || l.creditAmount !== (debit ? 0 : e.amount) ||
        l.exchangeRate !== 1000000 || (l.rateExact !== null && l.rateExact !== "1") || l.currencyCode !== currency)
        unsupported("Revenue journal amounts, accounts, currency or FX disagree");
      used.add(l.accountId);
    }
  }
  const sourceJournals = await tx.select({ id: journalEntry.id }).from(journalEntry)
    .where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "revenue_recognition"), eq(journalEntry.sourceId, row.id)));
  if (sourceJournals.length !== journals.size || sourceJournals.some(j => !journals.has(j.id))) unsupported("Saved revenue has orphaned or duplicate journals");
  if ((row.status === "completed" && unposted) || (row.status === "active" && !unposted)) unsupported("Saved revenue status disagrees with posting history");
  if (BigInt(row.recognizedAmount) !== recognized) unsupported("Saved recognizedAmount disagrees with period history");
  return entries.map(revenueEntryDto);
}
async function detail(tx: TaxTx, ctx: AuthContext, row: Schedule) {
  return revenuePreflight({ ...revenueDto(row), entries: await history(tx, ctx, row) });
}
async function replay(tx: TaxTx, ctx: AuthContext, entityId: string | undefined, action: string, key: string | undefined, fingerprint: string) {
  if (!key) return;
  const [saved] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "revenue_schedule"),
    entityId ? eq(auditLog.entityId, entityId) : undefined, eq(auditLog.action, action), sql`${auditLog.changes}->>'retryKey' = ${key}`)).limit(1);
  if (!saved) return;
  const changes = saved.changes as { fingerprint: string; result: unknown };
  if (changes.fingerprint !== fingerprint) throw new AuthError("Retry key was used with different revenue input", 409);
  return revenuePreflight(changes.result);
}
async function record(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string, result: unknown, request?: Request) {
  revenuePreflight(result);
  await auditTax(tx, ctx.organizationId, "revenue_schedule", id, action, { retryKey: key ?? null, fingerprint, result }, ctx, request);
}
export async function listRevenueSchedules(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:revenue"); const p = revenueListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(scope(ctx), p.status ? eq(revenueSchedule.status, p.status) : undefined);
    const rows = await tx.select().from(revenueSchedule).where(where).orderBy(desc(revenueSchedule.createdAt), asc(revenueSchedule.id))
      .limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(revenueSchedule).where(where);
    const schedules = [];
    for (const row of rows) schedules.push(await detail(tx, ctx, row));
    return { schedules, total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getRevenueSchedule(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:revenue"); revenueId.parse(id);
  return db.transaction(async tx => detail(tx, ctx, await load(tx, ctx, id)), { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createRevenueSchedule(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:revenue"); const { values, idempotencyKey } = revenueInput(input, transport);
  const periods = revenuePeriods(values.totalAmount, values.startDate, values.endDate);
  const normalized = values;
  const fingerprint = stringifyWire(normalized);
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const saved = await replay(tx, ctx, undefined, "create", idempotencyKey, fingerprint); if (saved) return saved as Awaited<ReturnType<typeof detail>>;
    const accounts = await links(tx, ctx, { ...normalized, deferredRevenueAccountId: null, revenueAccountId: null }, true);
    const [row] = await tx.insert(revenueSchedule).values({ ...normalized, deferredRevenueAccountId: accounts.deferred.id, revenueAccountId: accounts.revenue.id, organizationId: ctx.organizationId, createdBy: ctx.userId }).returning();
    if (Object.entries(normalized).some(([key, value]) => row[key as keyof Schedule] !== value) || row.status !== "active" || row.recognizedAmount !== 0 || row.deferredRevenueAccountId !== accounts.deferred.id || row.revenueAccountId !== accounts.revenue.id || row.organizationId !== ctx.organizationId)
      unsupported("Saved revenue schedule differs from input");
    await tx.insert(revenueEntry).values(periods.map(e => ({ ...e, scheduleId: row.id })));
    const result = await detail(tx, ctx, row);
    await record(tx, ctx, row.id, "create", idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function cancelRevenueSchedule(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:revenue"); revenueId.parse(id);
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const row = await load(tx, ctx, id, true); const before = await detail(tx, ctx, row);
    if (row.status === "cancelled") return before;
    if (row.status === "completed") throw new AuthError("Cannot cancel a schedule where all entries are already posted", 400);
    const [updated] = await tx.update(revenueSchedule).set({ status: "cancelled", updatedAt: new Date() }).where(scope(ctx, id)).returning();
    if (updated.status !== "cancelled" || Object.keys(row).some(key => !["status", "updatedAt"].includes(key) &&
      stringifyWire(row[key as keyof Schedule]) !== stringifyWire(updated[key as keyof Schedule]))) unsupported("Saved cancellation differs from requested state");
    const result = await detail(tx, ctx, updated);
    await record(tx, ctx, id, "cancel", undefined, stringifyWire({ id }), result, request); return result;
  });
}
export async function recognizeRevenueEntry(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:revenue"); revenueId.parse(id); const p = revenueRecognizeSchema.parse(input);
  const fingerprint = stringifyWire({ entryId: p.entryId ?? null });
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const row = await load(tx, ctx, id, true); const entries = await history(tx, ctx, row);
    await links(tx, ctx, row);
    const saved = await replay(tx, ctx, id, "recognize", p.idempotencyKey, fingerprint); if (saved) return saved as typeof entries[number];
    const target = p.entryId ? entries.find(e => e.id === p.entryId) : undefined;
    if (p.entryId && !target) throw new AuthError("Revenue period not found in schedule", 404);
    if (target?.recognized) {
      if (p.idempotencyKey) await record(tx, ctx, id, "recognize", p.idempotencyKey, fingerprint, target, request);
      return target;
    }
    if (row.status !== "active") throw new AuthError("Schedule is not active", 400);
    const next = entries.find(e => !e.recognized)!;
    if (target && target.id !== next.id) throw new AuthError("Expected period is not the next unposted period", 409);
    const { deferred, revenue, currency, invoiceCurrency } = await links(tx, ctx, row, true, true);
    if (invoiceCurrency !== currency) unsupported("Revenue recognition requires invoice currency to match base; no transaction FX snapshot is available");
    if (currencyMetadata(currency).minorUnits !== 2) unsupported("Revenue fixed-cents posting requires a two-decimal base currency; historical currency qualification remains separate");
    // Legacy lock/year writers do not share the organization-lock protocol.
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    await assertNotLocked(ctx.organizationId, next.periodDate, ctx, tx);
    const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
    if (!Number.isInteger(entryNumber) || entryNumber > 2147483647) unsupported("Journal number exceeds int32 range");
    const [journal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber,
      date: next.periodDate, description: `Revenue Recognition - Period ${next.sortOrder + 1}`, status: "posted",
      sourceType: "revenue_recognition", sourceId: id, createdBy: ctx.userId, postedAt: new Date() }).returning();
    await tx.insert(journalLine).values([
      { journalEntryId: journal.id, accountId: deferred.id, description: `Revenue Recognition - Period ${next.sortOrder + 1}`, debitAmount: next.amount, creditAmount: 0, currencyCode: currency, exchangeRate: 1000000, rateExact: "1" },
      { journalEntryId: journal.id, accountId: revenue.id, description: `Revenue Recognition - Period ${next.sortOrder + 1}`, debitAmount: 0, creditAmount: next.amount, currencyCode: currency, exchangeRate: 1000000, rateExact: "1" },
    ]);
    await tx.update(revenueEntry).set({ recognized: true, journalEntryId: journal.id }).where(and(eq(revenueEntry.id, next.id), eq(revenueEntry.scheduleId, id)));
    const status = entries.filter(e => !e.recognized).length === 1 ? "completed" : "active";
    const [updated] = await tx.update(revenueSchedule).set({ status, recognizedAmount: legacyMinor(BigInt(row.recognizedAmount) + BigInt(next.amount)), updatedAt: new Date() }).where(scope(ctx, id)).returning();
    if (updated.status !== status || updated.recognizedAmount !== legacyMinor(BigInt(row.recognizedAmount) + BigInt(next.amount)) || Object.keys(row).some(key => !["status", "recognizedAmount", "updatedAt"].includes(key) &&
      stringifyWire(row[key as keyof Schedule]) !== stringifyWire(updated[key as keyof Schedule]))) unsupported("Saved posting differs from requested schedule state");
    // Reload saved legs/allocations and serialize inside the transaction before commit.
    const result = (await detail(tx, ctx, updated)).entries.find(e => e.id === next.id)!;
    await record(tx, ctx, id, "recognize", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
