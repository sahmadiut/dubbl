import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartAccount, journalEntry, journalLine } from "@/lib/db/schema";
import { journalLineDto } from "./journal-wire";

/** Flat reads preserve exact FX strings and minor integers through the driver.
 * Relational JSON coerces nested PostgreSQL numeric rate fields to Number.
 * Keep the opening-balance numeric-cent aliases and add agreeing Minor reads.
 */
export async function readOpeningBalance(organizationId: string, entryId?: string, executor: Pick<typeof db, "select"> = db) {
  const [entry] = await executor.select().from(journalEntry).where(and(
    eq(journalEntry.organizationId, organizationId), eq(journalEntry.sourceType, "opening_balance"),
    eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt),
    entryId ? eq(journalEntry.id, entryId) : undefined,
  )).limit(1);
  if (!entry) return null;
  const rows = await executor.select({ line: journalLine, account: chartAccount }).from(journalLine)
    .leftJoin(chartAccount, and(eq(chartAccount.id, journalLine.accountId), eq(chartAccount.organizationId, organizationId)))
    .where(eq(journalLine.journalEntryId, entry.id)).orderBy(journalLine.id);
  return { ...entry, lines: rows.map(({ line, account }) => ({ ...journalLineDto(line), account })) };
}
