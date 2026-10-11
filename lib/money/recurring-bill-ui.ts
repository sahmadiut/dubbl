import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { recurringPayableCreateSchema, recurringPayableDates, recurringPayableStoredLines, recurringPayableTotals } from "../api/recurring-payable-wire";
import { recurringInvoiceUiDocument, recurringInvoiceUiUpcoming } from "./recurring-invoice-ui";

/** Payable inputs retain major x 100 in EVERY currency; saved units never rescale. */
export function recurringBillEditorPreview(lines: readonly DocumentEditorLine[], currency: string | null,
  rates: readonly { id: string; rate: number }[]) {
  try {
    if (!currency) throw new RangeError("Select a template currency to preview totals");
    currencyMetadata(currency);
    const inputs = documentLineInputs(lines);
    const stored = recurringPayableStoredLines(inputs.map(line => ({ ...line, description: line.description || "Preview line" })));
    const totals = recurringPayableTotals(stored, new Map(rates.map(rate => [rate.id, rate.rate])), "bill");
    return { inputs, lines: totals.processedLines.map(line => ({ amountMinor: BigInt(line.amount), taxMinor: BigInt(line.taxAmount), priceMinor: BigInt(line.unitPrice) })),
      subtotal: BigInt(totals.subtotal), taxTotal: BigInt(totals.taxTotal), total: BigInt(totals.total), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enter valid recurring bill amounts";
    return { inputs: [], lines: [], subtotal: 0n, taxTotal: 0n, total: 0n,
      error: message.startsWith("[") ? "Check the line quantity, account and tax selection" : message };
  }
}

export function recurringBillEditorPayload(header: { name: string; contactId: string; frequency: string; startDate: string;
  endDate: string; maxOccurrences: string; reference: string; currencyCode: string }, lines: readonly DocumentEditorLine[]) {
  if (header.maxOccurrences && !/^[1-9]\d*$/.test(header.maxOccurrences)) throw new RangeError("Enter a positive whole occurrence limit");
  const inputs = documentLineInputs(lines);
  if (inputs.some(line => !line.description.trim())) throw new RangeError("Add a description for every line");
  const parsed = recurringPayableCreateSchema.parse({ ...header, name: header.name.trim(), type: "bill",
    endDate: header.endDate || null, maxOccurrences: header.maxOccurrences ? Number(header.maxOccurrences) : null,
    reference: header.reference || null, lines: inputs.map(({ description, quantity, unitPriceExact, accountId, taxRateId }) =>
      ({ description, quantity, unitPriceExact, accountId, taxRateId })) });
  recurringPayableDates(parsed.startDate, parsed.endDate);
  return parsed;
}

// Both saved contracts expose safe numeric raw units plus agreeing canonical Minor aliases.
export const recurringBillUiDocument = recurringInvoiceUiDocument;
export const recurringBillUiUpcoming = recurringInvoiceUiUpcoming;
