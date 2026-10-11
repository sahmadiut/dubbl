import { recurringPayableCreateSchema, recurringPayableDates, recurringPayableStoredLines, recurringPayableTotals } from "../api/recurring-payable-wire";
import { currencyMetadata } from "./exact";

export type RecurringExpenseLine = { description: string; amount: string; accountId: string | null };
/** Recurring payable ownership stays with MON-099: fixed-two input, gross-only expense generation. */
export function recurringExpenseLines(lines: readonly RecurringExpenseLine[]) {
  if (lines.some(line => !line.description.trim() || !line.amount)) throw new RangeError("Add a description and amount for every recurring expense line");
  if (lines.some(line => line.amount.startsWith("-"))) throw new RangeError("Recurring expense amounts must be nonnegative");
  return lines.map(line => ({ description: line.description, quantity: 1, unitPriceExact: line.amount, accountId: line.accountId || null }));
}
export function recurringExpensePreview(lines: readonly RecurringExpenseLine[], currency: string) {
  try {
    currencyMetadata(currency);
    const saved = recurringPayableStoredLines(recurringExpenseLines(lines));
    if (saved.some(line => line.unitPrice < 0)) throw new RangeError("Recurring expense amounts must be nonnegative");
    const total = BigInt(recurringPayableTotals(saved, new Map(), "expense").total);
    if (total < 0n) throw new RangeError("Recurring expense total must be nonnegative");
    return { total, error: null };
  } catch (error) { return { total: 0n, error: error instanceof Error && !error.message.startsWith("[") ? error.message : "Check recurring expense amounts and accounts" }; }
}
export function recurringExpensePayload(header: { name: string; contactId: string; frequency: string; startDate: string; endDate: string;
  maxOccurrences: string; currencyCode: string }, lines: readonly RecurringExpenseLine[]) {
  if (header.maxOccurrences && !/^[1-9]\d*$/.test(header.maxOccurrences)) throw new RangeError("Enter a positive whole occurrence limit");
  const parsed = recurringPayableCreateSchema.parse({ ...header, type: "expense", name: header.name.trim(),
    endDate: header.endDate || null, maxOccurrences: header.maxOccurrences ? Number(header.maxOccurrences) : null, lines: recurringExpenseLines(lines) });
  recurringPayableDates(parsed.startDate, parsed.endDate);
  const preview = recurringExpensePreview(lines, header.currencyCode);
  if (preview.error) throw new RangeError(preview.error);
  return parsed;
}
