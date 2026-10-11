import { billWriteLineSchema, billWriteTotals } from "../api/bill-write-wire";
import { currencyMetadata } from "./exact";
import { documentLineInputs, type DocumentEditorLine } from "./document-editor";

export type BillEditorTax = { id: string; rate: number; kind?: string };

/** Bill prices use the existing extended-price policy in both REST and MCP. */
export function billLineInputs(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(line => billWriteLineSchema.parse({
    ...line, description: line.description || "Preview line",
  })).map((line, i) => ({ ...line, description: lines[i].description }));
}

export function billEditorPreview(lines: readonly DocumentEditorLine[], currency: string | null,
  rates: readonly BillEditorTax[]) {
  try {
    if (!currency) throw new RangeError("Select a supplier or bill currency to preview totals");
    const code = currencyMetadata(currency).code;
    const inputs = billLineInputs(lines);
    // A selected rate must have its kind: treating an unresolved reverse charge
    // as ordinary VAT would overstate the payable amount.
    for (const line of inputs) {
      if (line.taxRateId && !rates.find(rate => rate.id === line.taxRateId)?.kind)
        throw new RangeError("Reload tax rates before previewing this bill");
    }
    const totals = billWriteTotals(inputs, code, new Map(rates.map(rate => [rate.id, rate.rate])),
      new Map(rates.map(rate => [rate.id, rate.kind!])));
    return { inputs, lines: totals.processedLines.map(line => ({ amountMinor: BigInt(line.amount),
      taxMinor: BigInt(line.taxAmount), priceMinor: BigInt(line.unitPrice) })),
      subtotal: BigInt(totals.subtotal), taxTotal: BigInt(totals.taxTotal), total: BigInt(totals.total),
      amountDue: BigInt(totals.amountDue), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enter valid bill amounts";
    return { inputs: [], lines: [], subtotal: 0n, taxTotal: 0n, total: 0n, amountDue: 0n,
      error: message.startsWith("[") ? "Check the line quantity, account and tax selection" : message };
  }
}

/** Same fallback as REST create; a currency is always included in UI writes. */
export function billEditorCurrency(selected: string | null | undefined, supplier: string | null | undefined,
  organization: string | null | undefined) {
  return currencyMetadata(selected || (supplier ?? organization ?? "USD")).code;
}
