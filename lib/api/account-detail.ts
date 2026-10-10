import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { chartAccount, journalEntry, journalLine } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { legacyMinor } from "@/lib/money/wire";

export const accountDetailSchema = z.strictObject({
  accountId: z.string().uuid().describe("Organization-owned account UUID"),
});
const amount = <N extends string>(name: N, value: bigint) =>
  ({ [name]: legacyMinor(value), [`${name}Minor`]: value.toString() }) as Record<N, number> & Record<`${N}Minor`, string>;

/** Source and aggregate money stay SQL text/bigint until the explicit safe-number projection. */
export async function accountDetail(ctx: AuthContext, id: string, includeLedger = false) {
  accountDetailSchema.parse({ accountId: id });
  return db.transaction(async tx => {
    const account = await tx.query.chartAccount.findFirst({
      where: and(eq(chartAccount.id, id), eq(chartAccount.organizationId, ctx.organizationId)),
    });
    if (!account) throw new AuthError("Account not found", 404);
    const rows = await tx.select({ entryId: journalEntry.id, entryNumber: journalEntry.entryNumber,
      date: journalEntry.date, description: journalEntry.description,
      debit: sql<string>`${journalLine.debitAmount}::text`, credit: sql<string>`${journalLine.creditAmount}::text`,
    }).from(journalLine).innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
      .where(and(eq(journalLine.accountId, id), eq(journalEntry.organizationId, ctx.organizationId),
        eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt)))
      .orderBy(asc(journalEntry.date), asc(journalEntry.entryNumber), asc(journalEntry.id), asc(journalLine.id));
    const debitNormal = ["asset", "expense"].includes(account.type);
    let totalDebits = 0n, totalCredits = 0n;
    const ledger = rows.flatMap(({ debit, credit, ...row }) => {
      const d = BigInt(debit), c = BigInt(credit);
      // Reject unsafe retained source values even when they cancel in totals.
      legacyMinor(d); legacyMinor(c);
      totalDebits += d; totalCredits += c;
      return includeLedger ? [{ ...row, ...amount("debitAmount", d), ...amount("creditAmount", c),
        ...amount("balance", debitNormal ? totalDebits - totalCredits : totalCredits - totalDebits) }] : [];
    });
    return { account: { ...account, ...amount("totalDebits", totalDebits), ...amount("totalCredits", totalCredits),
      ...amount("balance", debitNormal ? totalDebits - totalCredits : totalCredits - totalDebits) }, ledger, entryCount: rows.length };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
