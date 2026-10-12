import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntry, organization } from "@/lib/db/schema";
import { currencyMetadata } from "@/lib/money/exact";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import type { AuthContext } from "./auth-context";

type Reader = Pick<typeof db, "query">;
type Header = { id: string; sourceType: string | null; sourceId?: string | null; reversesEntryId?: string | null };

export async function journalPresentation(ctx: AuthContext, reader: Reader = db) {
  const org = await reader.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
  if (!org) throw new WireCompatibilityError("Organization currency is unavailable");
  const baseCurrencyCode = currencyMetadata(org.defaultCurrency).code;
  const cache = new Map<string, string | null>();
  async function source(entry: Header, seen = new Set<string>()): Promise<string | null> {
    if (cache.has(entry.id)) return cache.get(entry.id)!;
    if (seen.has(entry.id) || seen.size >= 32) throw new WireCompatibilityError("Journal reversal chain is invalid");
    seen.add(entry.id);
    let result = entry.sourceType;
    if (entry.reversesEntryId || result === "manual_reversal" || result === "auto_reversal") {
      const id = entry.reversesEntryId ?? entry.sourceId;
      if (!id) throw new WireCompatibilityError("Journal reversal origin is unavailable");
      const original = await reader.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId)),
        columns: { id: true, sourceType: true, sourceId: true, reversesEntryId: true } });
      if (!original) throw new WireCompatibilityError("Journal reversal origin is unavailable");
      result = await source(original, seen);
    }
    cache.set(entry.id, result);
    return result;
  }
  return { baseCurrencyCode, async currency(entry: Header) {
    const kind = await source(entry);
    // Manual/template amounts use saved tags. Opening balance writes retain USD cents.
    return kind === null || kind === "manual" || kind === "recurring_journal" ? null : kind === "opening_balance" ? "USD" : baseCurrencyCode;
  } };
}

export function journalDebitGroups(lines: readonly { debitAmount: number; currencyCode: string }[], amountCurrency: string | null) {
  const groups = new Map<string, bigint>();
  for (const line of lines) {
    const code = currencyMetadata(amountCurrency ?? line.currencyCode).code;
    if (!Number.isSafeInteger(line.debitAmount) || line.debitAmount < 0) throw new WireCompatibilityError("Invalid journal debit");
    groups.set(code, (groups.get(code) ?? 0n) + BigInt(line.debitAmount));
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, total]) => ({ currencyCode, totalDebit: legacyMinor(total), totalDebitMinor: String(total) }));
}
