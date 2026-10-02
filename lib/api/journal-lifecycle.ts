import { z } from "zod";
import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntry, journalLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { assertNotLocked } from "./period-lock";
import { assertJournalReferences, assertJournalAccountScope } from "./journal-references";
import { journalLineDto, journalTotalDebit } from "./journal-wire";
import { getNextEntryNumber } from "./journal-automation";
import { logAudit } from "./audit";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
function assertSavedRate(line: { exchangeRate: number; rateExact: string | null; rateDirection: string; rateFormatVersion: number; rateMigrationStatus: string; rateProvenance: string | null }) {
  journalLineDto({ ...line, debitAmount: 0, creditAmount: 0, currencyCode: "USD" });
  if (line.rateExact === null || line.rateMigrationStatus !== "exact" || line.rateFormatVersion !== 1 || line.rateProvenance !== "legacy_scaled_1e6:transaction") {
    throw new WireCompatibilityError("Journal mutation requires qualified saved FX metadata; history must not be guessed or repaired");
  }
}
async function loadEntry(tx: Tx, ctx: AuthContext, id: string) {
  const where = and(eq(journalEntry.id, z.string().uuid().parse(id)), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt));
  const [locked] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(where).for("update");
  if (!locked) throw new AuthError("Entry not found", 404);
  const entry = (await tx.query.journalEntry.findFirst({ where, with: { lines: {
    columns: { rateExact: false }, extras: { rateExact: sql<string | null>`${journalLine.rateExact}::text`.as("rate_exact_text") }, with: { account: true },
  } } }))!;
  assertJournalAccountScope(ctx.organizationId, entry.lines);
  entry.lines.forEach(line => journalLineDto(line));
  journalTotalDebit(entry.lines);
  journalTotalDebit(entry.lines.map(line => ({ ...line, debitAmount: line.creditAmount })));
  return entry;
}

function restEntry(entry: Awaited<ReturnType<typeof loadEntry>>) {
  return { ...entry, lines: entry.lines.map(line => ({ ...journalLineDto(line, true), account: undefined,
    accountCode: line.account?.code ?? "", accountName: line.account?.name ?? "" })) };
}

export async function postJournal(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "post:entries");
  const result = await db.transaction(async tx => {
    const entry = await loadEntry(tx, ctx, id);
    if (entry.status !== "draft") throw new AuthError("Only draft entries can be posted", 400);
    await assertNotLocked(ctx.organizationId, entry.date, ctx);
    await assertJournalReferences(ctx.organizationId, entry.lines, entry.fiscalYearId);
    const [updated] = await tx.update(journalEntry).set({ status: "posted", postedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "draft"))).returning();
    if (!updated) throw new AuthError("Entry changed before posting", 409);
    const result = { entry: updated, rest: restEntry({ ...entry, ...updated }) };
    stringifyWire(result); // A failed compatibility response must roll back the status change.
    return result;
  });
  await logAudit({ ctx, action: "post", entityType: "journal_entry", entityId: id, changes: { previousStatus: "draft" }, request });
  return result;
}

export async function voidJournal(ctx: AuthContext, id: string, reason: string, rest = false, request?: Request) {
  requireRole(ctx, "void:entries");
  z.string().min(1).parse(reason);
  const result = await db.transaction(async tx => {
    const entry = await loadEntry(tx, ctx, id);
    if (entry.status !== "posted") throw new AuthError("Only posted entries can be voided", 400);
    if (entry.reversedByEntryId) throw new AuthError("This entry has already been reversed", 400);
    await assertNotLocked(ctx.organizationId, entry.date, ctx);
    await assertJournalReferences(ctx.organizationId, entry.lines, entry.fiscalYearId, true);
    if (!entry.lines.length) {
      throw new WireCompatibilityError("Reversal requires qualified saved FX metadata and existing lines");
    }
    entry.lines.forEach(assertSavedRate);
    // Mirror stored amounts, including already-base automated legs. Never reapply FX.
    const description = rest ? `Reversal of entry #${entry.entryNumber} — ${reason}` : `Reversal of entry #${entry.entryNumber}: ${reason}`;
    const [reversal] = await tx.insert(journalEntry).values({ organizationId: ctx.organizationId,
      entryNumber: await getNextEntryNumber(ctx.organizationId, tx), date: entry.date, description,
      reference: rest ? entry.reference : `VOID-${entry.entryNumber}`, status: "posted", sourceType: "manual_reversal",
      sourceId: id, reversesEntryId: id, postedAt: new Date(), createdBy: ctx.userId }).returning();
    await tx.insert(journalLine).values(entry.lines.map(line => ({ journalEntryId: reversal.id, accountId: line.accountId,
      description, debitAmount: line.creditAmount, creditAmount: line.debitAmount, currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate, rateExact: line.rateExact, rateDirection: line.rateDirection,
      rateFormatVersion: line.rateFormatVersion, rateProvenance: line.rateProvenance, rateMigrationStatus: line.rateMigrationStatus,
      costCenterId: line.costCenterId, projectId: line.projectId })));
    const [updated] = await tx.update(journalEntry).set({ reversedByEntryId: reversal.id, voidedAt: new Date(), voidReason: reason, updatedAt: new Date() })
      .where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), isNull(journalEntry.reversedByEntryId))).returning();
    if (!updated) throw new AuthError("Entry changed before reversal", 409);
    const result = { reversedEntry: id, reversalEntry: reversal, rest: restEntry({ ...entry, ...updated }) };
    stringifyWire(result);
    return result;
  });
  await logAudit({ ctx, action: "void", entityType: "journal_entry", entityId: id, changes: { previousStatus: "posted", reversalEntryId: result.reversalEntry.id }, request });
  return result;
}

export async function setJournalAutoReverseDate(ctx: AuthContext, id: string, date: string | null) {
  requireRole(ctx, "edit:entries");
  z.iso.date().nullable().parse(date);
  const result = await db.transaction(async tx => {
    const entry = await loadEntry(tx, ctx, id);
    if (entry.reversedByEntryId) throw new AuthError("Entry has already been reversed", 400);
    if (date && date < entry.date) throw new AuthError("Auto-reverse date must be on or after the entry date", 400);
    await assertNotLocked(ctx.organizationId, entry.date, ctx);
    if (date) await assertNotLocked(ctx.organizationId, date, ctx);
    const [updated] = await tx.update(journalEntry).set({ autoReverseDate: date, updatedAt: new Date() })
      .where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.reversedByEntryId))).returning();
    if (!updated) throw new AuthError("Entry changed before scheduling", 409);
    stringifyWire(updated);
    return { entry: updated, previousDate: entry.autoReverseDate };
  });
  await logAudit({ ctx, action: "update", entityType: "journal_entry", entityId: id,
    changes: { diff: { autoReverseDate: { from: result.previousDate, to: date } } } });
  return { entry: result.entry };
}

export const recodeFields = {
  filter: z.object({
    startDate: z.iso.date().optional().describe("First canonical Gregorian entry date"),
    endDate: z.iso.date().optional().describe("Last canonical Gregorian entry date"),
    accountId: z.string().uuid().optional().describe("Current GL account UUID"),
    sourceType: z.string().min(1).optional().describe("Current journal source type"),
    costCenterId: z.string().uuid().optional().describe("Current cost center UUID"),
    projectId: z.string().uuid().optional().describe("Current project UUID"),
  }).describe("At least one filter must scope the recode"),
  target: z.object({
    accountId: z.string().uuid().optional().describe("Active organization-owned target account UUID"),
    costCenterId: z.string().uuid().nullable().optional().describe("Active organization-owned target cost center UUID; null clears"),
    projectId: z.string().uuid().nullable().optional().describe("Organization-owned target project UUID; null clears"),
  }).describe("At least one target dimension; stored money and FX are retained"),
  draftOnly: z.boolean().default(true).describe("Drafts only by default; false explicitly includes posted entries"),
};

export async function recodeJournals(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "edit:entries");
  const { filter, target, draftOnly } = z.object(recodeFields).parse(input);
  if (!Object.values(filter).some(Boolean) || !Object.values(target).some(value => value !== undefined) ||
    (filter.startDate && filter.endDate && filter.startDate > filter.endDate)) {
    throw new z.ZodError([{ code: "custom", path: ["filter"], message: "A scoped filter, target dimension and ordered dates are required" }]);
  }
  // Validate target ownership even when the filter matches no rows.
  await assertJournalReferences(ctx.organizationId, [target]);
  const changed = await db.transaction(async tx => {
    const conditions = [eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt)];
    if (draftOnly) conditions.push(eq(journalEntry.status, "draft"));
    if (filter.startDate) conditions.push(gte(journalEntry.date, filter.startDate));
    if (filter.endDate) conditions.push(lte(journalEntry.date, filter.endDate));
    if (filter.sourceType) conditions.push(eq(journalEntry.sourceType, filter.sourceType));
    if (filter.accountId) conditions.push(eq(journalLine.accountId, filter.accountId));
    if (filter.costCenterId) conditions.push(eq(journalLine.costCenterId, filter.costCenterId));
    if (filter.projectId) conditions.push(eq(journalLine.projectId, filter.projectId));
    const rows = await tx.select({ lineId: journalLine.id, entryId: journalEntry.id, entryNumber: journalEntry.entryNumber,
      date: journalEntry.date, accountId: journalLine.accountId, costCenterId: journalLine.costCenterId, projectId: journalLine.projectId,
      exchangeRate: journalLine.exchangeRate, rateExact: sql<string | null>`${journalLine.rateExact}::text`, rateDirection: journalLine.rateDirection,
      rateFormatVersion: journalLine.rateFormatVersion, rateMigrationStatus: journalLine.rateMigrationStatus, rateProvenance: journalLine.rateProvenance })
      .from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id)).where(and(...conditions)).for("update");
    // Resolve both retained and target dimensions; no money arithmetic occurs in recode.
    await assertJournalReferences(ctx.organizationId, rows, undefined, true);
    for (const date of new Set(rows.map(row => row.date))) await assertNotLocked(ctx.organizationId, date, ctx);
    const toChange = rows.filter(row => Object.entries(target).some(([key, value]) => value !== undefined && value !== row[key as keyof typeof target]));
    toChange.forEach(assertSavedRate); // The coexistence trigger must not repair unqualified history during a dimension update.
    for (const row of toChange) await tx.update(journalLine).set(target).where(and(eq(journalLine.id, row.lineId), eq(journalLine.journalEntryId, row.entryId)));
    for (const id of new Set(toChange.map(row => row.entryId))) await tx.update(journalEntry).set({ updatedAt: new Date() }).where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId)));
    return toChange;
  });
  for (const row of changed) {
    const diff = Object.fromEntries(Object.entries(target).filter(([key, value]) => value !== undefined && value !== row[key as keyof typeof target]).map(([key, value]) => [key, { from: row[key as keyof typeof target], to: value }]));
    await logAudit({ ctx, action: "recode", entityType: "journal_line", entityId: row.lineId, changes: { entryId: row.entryId, entryNumber: row.entryNumber, diff }, request });
  }
  return { recoded: changed.length, entriesAffected: new Set(changed.map(row => row.entryId)).size, lines: changed.map(row => row.lineId) };
}
