import type { NumberPresentation } from "../../i18n/numbers";
import { currencyMetadata, roundRatio } from "./exact";
import { invoiceUiMinor, invoiceUiRow, invoiceUiMoney, invoiceUiDecimal } from "./invoice-ui";
import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { purchaseOrderLineSchema, purchaseOrderTotals } from "../api/purchase-order-wire";
import { requisitionLineSchema, requisitionTotals } from "../api/purchase-requisition-wire";

export { invoiceUiMoney as procurementMoney, invoiceUiDecimal as procurementDecimal } from "./invoice-ui";
export type ProcurementKind = "purchaseOrder" | "purchaseOrderUpdate" | "requisition";
export type ProcurementWire<T> = T extends bigint ? number : T extends (infer L)[] ? ProcurementWire<L>[]
  : T extends object ? { [K in keyof T]: ProcurementWire<T[K]> } : T;

/** The transports default to USD independently of supplier/organization currency. */
export function procurementEditorLines(lines: readonly DocumentEditorLine[], kind: ProcurementKind) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    const schema = kind === "requisition" ? requisitionLineSchema : kind === "purchaseOrderUpdate"
      ? purchaseOrderLineSchema.omit({ discountPercent: true }) : purchaseOrderLineSchema;
    return schema.parse({ description, quantity, unitPriceExact, accountId, taxRateId });
  });
}

/** PO creation calculates tax; PATCH and requisitions retain their no-tax policy. */
export function procurementPreview(lines: readonly DocumentEditorLine[], currency: string | null,
  rates: readonly { id: string; rate: number }[], kind: ProcurementKind = "purchaseOrder") {
  try {
    if (!currency) throw new RangeError("Select a procurement currency");
    currencyMetadata(currency);
    const inputs = procurementEditorLines(lines.map(line => ({ ...line, description: line.description || "Preview line" })), kind);
    const totals = kind === "requisition" ? requisitionTotals(inputs, currency)
      : purchaseOrderTotals(inputs.map(line => ({ ...line, discountPercent: 0 })), currency, new Map(rates.map(rate => [rate.id, rate.rate])), kind === "purchaseOrderUpdate");
    return { inputs, lines: totals.processedLines.map(line => ({ amountMinor: BigInt(line.amount),
      taxMinor: BigInt(line.taxAmount), priceMinor: BigInt(line.unitPrice) })),
      subtotal: BigInt(totals.subtotal), taxTotal: BigInt(totals.taxTotal), total: BigInt(totals.total), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check the procurement lines";
    return { inputs: [], lines: [], subtotal: 0n, taxTotal: 0n, total: 0n,
      error: message.startsWith("[") ? "Check line quantities, accounts and tax selection" : message };
  }
}

export function procurementQuantity(value: number, nonnegative = false) {
  if (!Number.isInteger(value) || value < (nonnegative ? 0 : -2147483648) || value > 2147483647)
    throw new RangeError("Invalid saved procurement quantity");
  return value;
}
export function procurementQuantityText(value: number) {
  procurementQuantity(value);
  const amount = BigInt(value), absolute = amount < 0n ? -amount : amount;
  const fraction = String(absolute % 100n).padStart(2, "0").replace(/0+$/, "");
  return `${amount < 0n ? "-" : ""}${absolute / 100n}${fraction ? `.${fraction}` : ""}`;
}

export function procurementList<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, ["total"]);
}
type SavedLine = Record<string, unknown> & { quantity: number };
export function procurementDocument<T extends Record<string, unknown> & { currencyCode: string; lines: SavedLine[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const header = invoiceUiRow(row, ["subtotal", "taxTotal", "total"]);
  const lines = row.lines.map(line => {
    procurementQuantity(line.quantity);
    for (const field of ["quantityReceived", "quantityBilled"] as const)
      if (line[field] !== undefined) procurementQuantity(line[field] as number, true);
    if (typeof line.quantityBilled === "number" && line.quantityBilled > Math.max(0, line.quantity))
      throw new RangeError("Invalid billed quantity");
    return invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"]);
  });
  if (lines.reduce((sum, line) => sum + line.amount, 0n) !== header.subtotal
    || lines.reduce((sum, line) => sum + line.taxAmount, 0n) !== header.taxTotal
    || header.subtotal + header.taxTotal !== header.total) throw new RangeError("Procurement header and lines disagree");
  return { ...header, lines } as Omit<typeof header, "lines"> & {
    lines: { [K in keyof T["lines"][number]]: K extends "unitPrice" | "amount" | "taxAmount" ? bigint : T["lines"][number][K] }[];
  };
}

type ReceiptLine = Record<string, unknown> & { quantityReceived: number };
/** Round each received line as posting/create-bill do, then add exact minor amounts. */
export function procurementReceipt<T extends Record<string, unknown> & { currencyCode: string; lines: ReceiptLine[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const lines = row.lines.map(line => {
    procurementQuantity(line.quantityReceived, true);
    if (line.quantityReceived === 0) throw new RangeError("Receipt quantity must be positive");
    const unitCost = invoiceUiMinor(line, "unitCost");
    if (unitCost < 0n) throw new RangeError("Receipt cost must be nonnegative");
    const exact = line.quantityReceivedExact;
    if (exact !== undefined && exact !== `${BigInt(line.quantityReceived) / 100n}.${String(line.quantityReceived % 100).padStart(2, "0")}`)
      throw new RangeError("Conflicting receipt quantity aliases");
    const amount = roundRatio(BigInt(line.quantityReceived) * unitCost, 100n, "half-away-from-zero");
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Receipt value exceeds supported range");
    return { ...line, unitCost, amount };
  });
  return { ...row, lines, total: lines.reduce((sum, line) => sum + line.amount, 0n) } as Omit<T, "lines"> & {
    lines: (Omit<T["lines"][number], "unitCost" | "amount"> & { unitCost: bigint; amount: bigint })[]; total: bigint;
  };
}

/** Loaded matching sample; currencies are never summed together or converted. */
export function procurementOverview(rows: readonly { currencyCode: string; status: string; total: bigint }[], statuses?: readonly string[]) {
  const groups = new Map<string, bigint>();
  for (const row of rows) {
    if (row.status === "void" || (statuses && !statuses.includes(row.status))) continue;
    currencyMetadata(row.currencyCode);
    groups.set(row.currencyCode, (groups.get(row.currencyCode) ?? 0n) + row.total);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, amount]) => ({ currencyCode, amount }));
}

export function procurementOverviewText(rows: readonly { currencyCode: string; status: string; total: bigint }[], statuses?: readonly string[], presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  return procurementOverview(rows, statuses).map(group => invoiceUiMoney(group.amount, group.currencyCode, presentation)).join(" · ") || "—";
}

/** The list services accept status/page only; other controls inspect the loaded sample. */
export function procurementFilter<T extends { total: bigint; currencyCode: string; contact: { name: string } | null; createdAt?: string }>(rows: readonly T[],
  number: (row: T) => string, date: (row: T) => string,
  filters: { search: string; from: string; to: string; sortBy: string; sortOrder: "asc" | "desc" }) {
  const query = filters.search.toLowerCase();
  const result = rows.filter(row => (!query || number(row).toLowerCase().includes(query) || row.contact?.name.toLowerCase().includes(query))
    && (!filters.from || date(row) >= filters.from) && (!filters.to || date(row) <= filters.to));
  result.sort((a, b) => {
    const compare = filters.sortBy === "total" ? a.currencyCode.localeCompare(b.currencyCode) || (a.total < b.total ? -1 : a.total > b.total ? 1 : 0)
      : filters.sortBy === "number" ? number(a).localeCompare(number(b)) : filters.sortBy === "created"
        ? (a.createdAt ?? date(a)).localeCompare(b.createdAt ?? date(b)) : date(a).localeCompare(date(b));
    return filters.sortOrder === "asc" ? compare : -compare;
  });
  return result;
}

/** Remaining physical hundredths become the receipt's exact quantity alias. */
export function procurementReceiveLines(lines: readonly { id: string; quantity: number; quantityReceived: number }[]) {
  return lines.flatMap(line => {
    procurementQuantity(line.quantity); procurementQuantity(line.quantityReceived, true);
    const remaining = line.quantity - line.quantityReceived;
    return remaining > 0 ? [{ purchaseOrderLineId: line.id, quantityExact: procurementQuantityText(remaining) }] : [];
  });
}

/** Saved rounded unit prices seed edits; original subminor price text is not stored. */
export function procurementEditPrice(amount: bigint, currency: string) { return invoiceUiDecimal(amount, currency); }
