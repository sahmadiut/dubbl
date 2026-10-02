import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { preProcessEntries } from "@/lib/import-export/pre-process";
import { journalTotalDebit } from "./journal-wire";

export const journalImportSource = z.enum(["quickbooks", "xero", "freshbooks", "wave", "custom"]).default("custom").describe("Source date normalization; legacy REST debit/credit always use fixed two-decimal units");
const minor = exactMinorSchema.refine(value => !value.startsWith("-"), "Import amounts must be nonnegative");
const headerFields = {
  entryNumber: z.union([z.string(), z.number().int().safe()]).optional().describe("Grouping key, not the allocated journal number; defaults to date|description"),
  date: z.iso.date().describe("Canonical Gregorian date after REST source date normalization"),
  description: z.string().min(1).describe("Entry memo; must agree across grouped lines"),
  reference: z.string().optional().describe("Optional external reference; must agree across grouped lines"),
  lineAccountCode: z.string().trim().min(1).describe("Existing active organization-owned GL code; matched literally ignoring case"),
  debitAmountMinor: minor.optional().describe("Canonical nonnegative int64 stored minor-unit string; dual debit aliases must agree; safe Number limit applies"),
  creditAmountMinor: minor.optional().describe("Canonical nonnegative int64 stored minor-unit string; dual credit aliases must agree; safe Number limit applies"),
};
export const mcpJournalImportRow = z.object({ ...headerFields,
  debit: legacyMinorSchema.min(0).optional().describe("Legacy nonnegative integer cents; 1250 = USD 12.50; omitted side is zero"),
  credit: legacyMinorSchema.min(0).optional().describe("Legacy nonnegative integer cents; omitted side is zero"),
});
const restRow = z.object({ ...headerFields,
  debit: z.union([z.string(), z.number().finite()]).optional().describe("Legacy fixed two-decimal money input; 12.50 = 1250 stored units; prefer strings"),
  credit: z.union([z.string(), z.number().finite()]).optional().describe("Legacy fixed two-decimal money input; omitted or blank side is zero"),
});

/** Exact replacement for the journal slice's permissive parseFloat/round path. */
export function journalImportDecimal(value: string | number) {
  // Below 2^45, adjacent hundredths remain distinguishable by binary64 input.
  // Larger decimals must arrive as text, before JSON decoding can lose a cent.
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 2 ** 45 - 1)) throw new WireCompatibilityError("Large decimal import amounts must use strings or exact minor-unit aliases");
  let text = String(value).trim();
  if (!text) return 0;
  // Keep valid existing currency symbols and US/European grouping; reject trailing junk,
  // exponents, negatives and extra fractional precision rather than round or guess.
  text = text.replace(/^[$€£¥]\s*/, "");
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) text = text.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) text = text.replaceAll(",", "");
  if (text.length > 40 || !/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Expected nonnegative decimal money with at most two fractional digits" }]);
  }
  const [whole, fraction = ""] = text.split(".");
  const raw = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (raw > BigInt(Number.MAX_SAFE_INTEGER)) throw new WireCompatibilityError();
  return legacyMinor(raw);
}

export function journalImportRow(input: unknown, rest = false) {
  const parsed = rest ? restRow.parse(input) : mcpJournalImportRow.parse(input);
  const amount = (value: string | number | undefined, alias: string | undefined) => {
    const numeric = value === undefined ? undefined : rest ? journalImportDecimal(value) : legacyMinorSchema.min(0).parse(value);
    if (numeric !== undefined && alias !== undefined && BigInt(numeric) !== BigInt(alias)) {
      throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Legacy and exact import amounts disagree" }]);
    }
    return alias === undefined ? numeric ?? 0 : legacyMinor(BigInt(alias));
  };
  return { ...parsed, entryNumber: parsed.entryNumber === undefined ? undefined : String(parsed.entryNumber),
    debitAmount: amount(parsed.debit, parsed.debitAmountMinor), creditAmount: amount(parsed.credit, parsed.creditAmountMinor) };
}
export type JournalImportRow = ReturnType<typeof journalImportRow>;
export function journalImportGroups(rows: JournalImportRow[]) {
  const groups = new Map<string, JournalImportRow[]>();
  for (const row of rows) {
    const key = row.entryNumber || `${row.date}|${row.description}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
export function journalImportTotals(rows: JournalImportRow[]) {
  const lines = rows.map(row => ({ ...row, currencyCode: "USD", exchangeRate: 1000000 }));
  const totalDebit = journalTotalDebit(lines);
  const totalCredit = journalTotalDebit(lines.map(line => ({ ...line, debitAmount: line.creditAmount })));
  return { totalDebit, totalCredit, imbalance: totalDebit - totalCredit,
    totalDebitMinor: String(totalDebit), totalCreditMinor: String(totalCredit), imbalanceMinor: (BigInt(totalDebit) - BigInt(totalCredit)).toString() };
}
export function parseJournalImportRows(input: unknown[], rest = false, source: z.infer<typeof journalImportSource> = "custom") {
  const raw = z.array(z.record(z.string(), z.unknown())).min(1).parse(input);
  const normalized = rest ? preProcessEntries(raw, source) : raw;
  const rows = normalized.map(row => journalImportRow(row, rest));
  // All range guards run before any job or journal writes, even in a partial import.
  for (const group of journalImportGroups(rows).values()) journalImportTotals(group);
  return rows;
}
export function previewJournalImport(input: unknown[], rest = false, source: z.infer<typeof journalImportSource> = "custom") {
  const raw = z.array(z.record(z.string(), z.unknown())).parse(input);
  const normalized = rest ? preProcessEntries(raw, source) : raw;
  const preview = normalized.map((row, i) => {
    try {
      const parsed = journalImportRow(row, rest);
      return { row: i + 1, data: row, valid: true, errors: [] as string[], parsed: { ...parsed,
        debitAmountMinor: String(parsed.debitAmount), creditAmountMinor: String(parsed.creditAmount) } };
    } catch (err) {
      if (err instanceof WireCompatibilityError) throw err;
      return { row: i + 1, data: row, valid: false, errors: [err instanceof Error ? err.message : "Invalid row"], parsed: null };
    }
  });
  const entries = [...journalImportGroups(preview.flatMap(row => row.parsed ? [row.parsed] : []))].map(([entryKey, rows]) => {
    const totals = journalImportTotals(rows);
    const invalidMember = preview.some(row => !row.valid && String(row.data.entryNumber || `${row.data.date}|${row.data.description}`) === entryKey);
    const consistent = rows.every(row => row.date === rows[0].date && row.description === rows[0].description && row.reference === rows[0].reference);
    return { entryKey, lineCount: rows.length, ...totals,
      balanced: !invalidMember && consistent && rows.length >= 2 && totals.imbalance === 0 && totals.totalDebit > 0 && rows.every(row => !(row.debitAmount && row.creditAmount)) };
  });
  return { preview, entries, validCount: preview.filter(row => row.valid).length, totalCount: raw.length,
    balancedEntryCount: entries.filter(entry => entry.balanced).length, unbalancedEntryCount: entries.filter(entry => !entry.balanced).length };
}
