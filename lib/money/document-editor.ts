import { currencyMetadata, money, toMajorDecimal } from "./exact";
import { invoiceWriteLineSchema, invoiceWriteTotals } from "../api/invoice-write-wire";

export type DocumentEditorLine = {
  description: string; quantity: string; unitPrice: string; accountId: string; taxRateId: string;
};

/** Keep decimal price text intact, including fractions smaller than a minor unit. */
export function documentPriceText(value: string) {
  const text = value === "" ? "0" : value;
  if (text.length > 40 || !/^-?\d{1,20}(?:\.\d{1,18})?$/.test(text)) throw new RangeError("Enter a decimal price with at most 18 fractional digits");
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  return `${negative ? "-" : ""}${BigInt(whole)}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** Quantity is the existing nonmoney numeric API control; prices never become Number. */
export function documentLineInputs(lines: readonly DocumentEditorLine[]) {
  if (lines.length < 1 || lines.length > 1000) throw new RangeError("Add between 1 and 1000 invoice lines");
  return lines.map(line => {
    const quantityText = line.quantity === "" ? "1" : line.quantity;
    if (quantityText.length > 40 || !/^-?\d+(?:\.\d+)?$/.test(quantityText)) throw new RangeError("Enter a valid decimal quantity");
    const quantity = Number(quantityText);
    const parsed = invoiceWriteLineSchema.parse({
      description: line.description || "Preview line", quantity,
      unitPriceExact: documentPriceText(line.unitPrice),
      accountId: line.accountId || null, taxRateId: line.taxRateId || null,
    });
    return { ...parsed, description: line.description };
  });
}

/** Use the actual wire calculator; create price-first and extended-price policies differ. */
export function documentEditorPreview(lines: readonly DocumentEditorLine[], currency: string | null,
  rates: readonly { id: string; rate: number }[], roundPriceFirst = false) {
  try {
    if (!currency) throw new RangeError("Select a customer or invoice currency to preview totals");
    const code = currencyMetadata(currency).code;
    const inputs = documentLineInputs(lines);
    const totals = invoiceWriteTotals(inputs, code, roundPriceFirst, new Map(rates.map(rate => [rate.id, rate.rate])));
    return { inputs, lines: totals.processedLines.map(line => ({ amountMinor: BigInt(line.amount), taxMinor: BigInt(line.taxAmount), priceMinor: BigInt(line.unitPrice) })),
      subtotal: BigInt(totals.subtotal), taxTotal: BigInt(totals.taxTotal), total: BigInt(totals.total), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enter valid line amounts";
    return { inputs: [], lines: [], subtotal: 0n, taxTotal: 0n, total: 0n,
      error: message.startsWith("[") ? "Check the line quantity, account and tax selection" : message };
  }
}

export function documentEditorDecimal(amount: bigint, currency: string) {
  return toMajorDecimal(money(amount, currency));
}

/** Same default chain as REST create; selected currency takes precedence. */
export function invoiceEditorCurrency(selected: string | null | undefined, customer: string | null | undefined, organization: string | null | undefined) {
  return currencyMetadata(selected || (customer ?? organization ?? "USD")).code;
}
