import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accrualSchedule, accrualEntry, chartAccount, journalEntry, journalLine, organization, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { accrualId, accrualInput, accrualPeriods, accrualDto, accrualEntryDto, accrualPostSchema, accrualListSchema, accrualPreflight } from "./accrual-wire";
import { assetMoneyDto } from "./asset-master-wire";
import { currencyMetadata } from "@/lib/money/exact";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";
import { getNextEntryNumber } from "./journal-automation";
import { assertNotLocked } from "./period-lock";

type Schedule = typeof accrualSchedule.$inferSelect;
const scope = (ctx: AuthContext, id?: string) => and(eq(accrualSchedule.organizationId, ctx.organizationId), id ? eq(accrualSchedule.id, id) : undefined);
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
  try { currencyMetadata(org.currency); } catch { unsupported("Unsupported saved accrual base currency"); }
  return org.currency;
}
async function links(tx: TaxTx, ctx: AuthContext, row: Pick<Schedule, "accountId" | "reverseAccountId" | "sourceEntryId">, live = false) {
  const currency = await base(tx, ctx);
  if (row.accountId === row.reverseAccountId) unsupported("Accrual posting accounts must be distinct");
  async function account(id: string) {
    const q = tx.select().from(chartAccount).where(and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)));
    const [a] = await (live ? q.for("share") : q);
    if (!a) throw new AuthError("Accrual account not found in organization", live ? 404 : 422);
    if (live && (a.deletedAt || !a.isActive || a.currencyCode !== currency)) unsupported("Accrual posting requires live active base-currency accounts");
    return accrualPreflight(a);
  }
  const accountRow = await account(row.accountId), reverseAccount = await account(row.reverseAccountId);
  if (row.sourceEntryId) {
    const q = tx.select().from(journalEntry).where(and(eq(journalEntry.id, row.sourceEntryId), eq(journalEntry.organizationId, ctx.organizationId)));
    const [source] = await (live ? q.for("share") : q);
    if (!source) throw new AuthError("Source journal not found in organization", live ? 404 : 422);
    if (live && (source.deletedAt || source.status !== "posted")) unsupported("Source journal must be live and posted");
  }
  return { account: accountRow, reverseAccount, currency };
}
async function load(tx: TaxTx, ctx: AuthContext, id: string, lock = false) {
  const q = tx.select().from(accrualSchedule).where(scope(ctx, id));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AuthError("Accrual schedule not found", 404);
  accrualDto(row);
  if (row.frequency !== "monthly" || !["active", "completed", "cancelled"].includes(row.status)) unsupported("Unsupported saved accrual frequency or status");
  return row;
}
async function history(tx: TaxTx, ctx: AuthContext, row: Schedule) {
  if (row.frequency !== "monthly" || !["active", "completed", "cancelled"].includes(row.status)) unsupported("Unsupported saved accrual frequency or status");
  let expected;
  try { expected = accrualPeriods(row.totalAmount, row.startDate, row.endDate, row.periods); }
  catch { return unsupported("Unsupported saved accrual amount, dates or periods"); }
  const entries = await tx.select().from(accrualEntry).where(eq(accrualEntry.scheduleId, row.id)).orderBy(asc(accrualEntry.sortOrder), asc(accrualEntry.id));
  if (entries.length !== row.periods) unsupported("Saved accrual schedule is incomplete");
  let unposted = false;
  const journals = new Set<string>();
  const currency = await base(tx, ctx);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]; accrualEntryDto(e);
    if (e.amount !== expected[i].amount || e.periodDate !== expected[i].periodDate || e.sortOrder !== i) unsupported("Saved accrual allocation, order or dates disagree");
    if (!e.posted) { unposted = true; if (e.journalEntryId) unsupported("Unposted accrual has journal history"); continue; }
    if (unposted || !e.journalEntryId || journals.has(e.journalEntryId)) unsupported("Accrual posting history is duplicate or out of order");
    journals.add(e.journalEntryId!);
    const [j] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, e.journalEntryId!), eq(journalEntry.organizationId, ctx.organizationId)));
    if (!j || j.deletedAt || j.status !== "posted" || j.sourceType !== "accrual" || j.sourceId !== row.id || j.date !== e.periodDate)
      unsupported("Saved accrual journal does not match its period");
    const legs = await tx.select().from(journalLine).where(eq(journalLine.journalEntryId, j!.id));
    if (legs.length !== 2) unsupported("Accrual journal must contain two balanced legs");
    const used = new Set<string>();
    for (const l of legs) {
      assetMoneyDto(l, ["debitAmount", "creditAmount"]);
      const debit = l.accountId === row.reverseAccountId;
      if (used.has(l.accountId) || (!debit && l.accountId !== row.accountId) ||
        l.debitAmount !== (debit ? e.amount : 0) || l.creditAmount !== (debit ? 0 : e.amount) ||
        l.exchangeRate !== 1000000 || (l.rateExact !== null && l.rateExact !== "1") || l.currencyCode !== currency)
        unsupported("Accrual journal amounts, accounts, currency or FX disagree");
      used.add(l.accountId);
    }
  }
  const sourceJournals = await tx.select({ id: journalEntry.id }).from(journalEntry)
    .where(and(eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.sourceType, "accrual"), eq(journalEntry.sourceId, row.id)));
  if (sourceJournals.length !== journals.size || sourceJournals.some(j => !journals.has(j.id))) unsupported("Saved accrual has orphaned or duplicate journals");
  if ((row.status === "completed" && unposted) || (row.status === "active" && !unposted)) unsupported("Saved accrual status disagrees with posting history");
  return entries.map(accrualEntryDto);
}
async function detail(tx: TaxTx, ctx: AuthContext, row: Schedule) {
  const { account, reverseAccount } = await links(tx, ctx, row);
  return accrualPreflight({ ...accrualDto(row), entries: await history(tx, ctx, row), account, reverseAccount });
}
async function replay(tx: TaxTx, ctx: AuthContext, entityId: string | undefined, action: string, key: string | undefined, fingerprint: string) {
  if (!key) return;
  const [saved] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "accrual_schedule"),
    entityId ? eq(auditLog.entityId, entityId) : undefined, eq(auditLog.action, action), sql`${auditLog.changes}->>'retryKey' = ${key}`)).limit(1);
  if (!saved) return;
  const changes = saved.changes as { fingerprint: string; result: unknown };
  if (changes.fingerprint !== fingerprint) throw new AuthError("Retry key was used with different accrual input", 409);
  return accrualPreflight(changes.result);
}
async function record(tx: TaxTx, ctx: AuthContext, id: string, action: string, key: string | undefined, fingerprint: string, result: unknown, request?: Request) {
  accrualPreflight(result);
  await auditTax(tx, ctx.organizationId, "accrual_schedule", id, action, { retryKey: key ?? null, fingerprint, result }, ctx, request);
}
export async function listAccrualSchedules(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:accruals"); const p = accrualListSchema.parse(input);
  return db.transaction(async tx => {
    const where = and(scope(ctx), p.status ? eq(accrualSchedule.status, p.status) : undefined);
    const rows = await tx.select().from(accrualSchedule).where(where).orderBy(desc(accrualSchedule.createdAt), asc(accrualSchedule.id))
      .limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(accrualSchedule).where(where);
    const schedules = [];
    for (const row of rows) schedules.push(await detail(tx, ctx, row));
    return { schedules, total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getAccrualSchedule(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:accruals"); accrualId.parse(id);
  return db.transaction(async tx => detail(tx, ctx, await load(tx, ctx, id)), { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createAccrualSchedule(ctx: AuthContext, input: unknown, transport: "rest" | "mcp", request?: Request) {
  requireRole(ctx, "manage:accruals"); const { values, idempotencyKey } = accrualInput(input, transport);
  const periods = accrualPeriods(values.totalAmount, values.startDate, values.endDate, values.periods);
  const normalized = { sourceEntryId: values.sourceEntryId ?? null, totalAmount: values.totalAmount, startDate: values.startDate,
    endDate: values.endDate, periods: values.periods, accountId: values.accountId, reverseAccountId: values.reverseAccountId, description: values.description };
  const fingerprint = stringifyWire(normalized);
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const saved = await replay(tx, ctx, undefined, "create", idempotencyKey, fingerprint); if (saved) return saved as Awaited<ReturnType<typeof detail>>;
    await links(tx, ctx, normalized, true);
    const [row] = await tx.insert(accrualSchedule).values({ ...normalized, organizationId: ctx.organizationId, createdBy: ctx.userId }).returning();
    if (Object.entries(normalized).some(([key, value]) => row[key as keyof Schedule] !== value) || row.status !== "active" || row.organizationId !== ctx.organizationId)
      unsupported("Saved accrual schedule differs from input");
    await tx.insert(accrualEntry).values(periods.map(e => ({ ...e, scheduleId: row.id })));
    const result = await detail(tx, ctx, row);
    await record(tx, ctx, row.id, "create", idempotencyKey, fingerprint, result, request); return result;
  });
}
export async function cancelAccrualSchedule(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:accruals"); accrualId.parse(id);
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const row = await load(tx, ctx, id, true); const before = await detail(tx, ctx, row);
    if (row.status === "cancelled") return before;
    if (row.status === "completed") throw new AuthError("Cannot cancel a schedule where all entries are already posted", 400);
    const [updated] = await tx.update(accrualSchedule).set({ status: "cancelled", updatedAt: new Date() }).where(scope(ctx, id)).returning();
    if (updated.status !== "cancelled" || Object.keys(row).some(key => !["status", "updatedAt"].includes(key) &&
      stringifyWire(row[key as keyof Schedule]) !== stringifyWire(updated[key as keyof Schedule]))) unsupported("Saved cancellation differs from requested state");
    const result = await detail(tx, ctx, updated);
    await record(tx, ctx, id, "cancel", undefined, stringifyWire({ id }), result, request); return result;
  });
}
export async function postAccrualEntry(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:accruals"); accrualId.parse(id); const p = accrualPostSchema.parse(input);
  const fingerprint = stringifyWire({ entryId: p.entryId ?? null });
  return write(async tx => {
    await lockTaxOrganization(tx, ctx.organizationId);
    const row = await load(tx, ctx, id, true); const entries = await history(tx, ctx, row);
    await links(tx, ctx, row);
    const saved = await replay(tx, ctx, id, "post", p.idempotencyKey, fingerprint); if (saved) return saved as typeof entries[number];
    const target = p.entryId ? entries.find(e => e.id === p.entryId) : undefined;
    if (p.entryId && !target) throw new AuthError("Accrual period not found in schedule", 404);
    if (target?.posted) {
      if (p.idempotencyKey) await record(tx, ctx, id, "post", p.idempotencyKey, fingerprint, target, request);
      return target;
    }
    if (row.status !== "active") throw new AuthError("Schedule is not active", 400);
    const next = entries.find(e => !e.posted)!;
    if (target && target.id !== next.id) throw new AuthError("Expected period is not the next unposted period", 409);
    const { currency } = await links(tx, ctx, row, true);
    if (currencyMetadata(currency).minorUnits !== 2) unsupported("Accrual fixed-cents posting requires a two-decimal base currency; historical currency qualification remains separate");
    // Legacy lock/year writers do not share the organization-lock protocol.
    await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    await assertNotLocked(ctx.organizationId, next.periodDate, ctx, tx);
    const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
    if (!Number.isInteger(entryNumber) || entryNumber > 2147483647) unsupported("Journal number exceeds int32 range");
    const [journal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId, entryNumber,
      date: next.periodDate, description: `Accrual: ${row.description} - Period ${next.sortOrder + 1}`, status: "posted",
      sourceType: "accrual", sourceId: id, createdBy: ctx.userId, postedAt: new Date() }).returning();
    await tx.insert(journalLine).values([
      { journalEntryId: journal.id, accountId: row.reverseAccountId, description: row.description, debitAmount: next.amount, creditAmount: 0, currencyCode: currency, exchangeRate: 1000000, rateExact: "1" },
      { journalEntryId: journal.id, accountId: row.accountId, description: row.description, debitAmount: 0, creditAmount: next.amount, currencyCode: currency, exchangeRate: 1000000, rateExact: "1" },
    ]);
    await tx.update(accrualEntry).set({ posted: true, journalEntryId: journal.id }).where(and(eq(accrualEntry.id, next.id), eq(accrualEntry.scheduleId, id)));
    const status = entries.filter(e => !e.posted).length === 1 ? "completed" : "active";
    const [updated] = await tx.update(accrualSchedule).set({ status, updatedAt: new Date() }).where(scope(ctx, id)).returning();
    if (updated.status !== status || Object.keys(row).some(key => !["status", "updatedAt"].includes(key) &&
      stringifyWire(row[key as keyof Schedule]) !== stringifyWire(updated[key as keyof Schedule]))) unsupported("Saved posting differs from requested schedule state");
    // Reload saved legs/allocations and serialize inside the transaction before commit.
    const result = (await detail(tx, ctx, updated)).entries.find(e => e.id === next.id)!;
    await record(tx, ctx, id, "post", p.idempotencyKey, fingerprint, result, request); return result;
  });
}
