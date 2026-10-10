import { z } from "zod";
import { currencyMetadata } from "@/lib/money/exact";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { publicMoneyDto } from "@/lib/api/public-money-wire";
import { statementMoneyText } from "@/lib/reports/statement-money";

export const renderId = z.string().uuid().describe("Organization-owned live document or template UUID");
export const renderFormat = z.enum(["html", "pdf"]).default("html").describe("HTML text or binary PDF (MCP returns base64)");
export function renderQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== "format") || query.getAll("format").length > 1)
    throw new z.ZodError([{ code: "custom", path: ["format"], message: "Unsupported or duplicate rendering parameter" }]);
  return renderFormat.parse(query.get("format") ?? undefined);
}

export { statementMoneyText as documentMoneyText };
export function documentSum(...values: number[]) {
  if (values.some(value => !Number.isSafeInteger(value))) throw new WireCompatibilityError();
  return legacyMinor(values.reduce((sum, value) => sum + BigInt(value), 0n));
}

type RenderMoney = { currencyCode: string; subtotal: number; taxTotal: number; total: number;
  amountPaid?: number; amountDue?: number; lines: { quantity: number; unitPrice: number; taxAmount: number; amount: number; discountPercent?: number }[] };
/** Guard even hidden amounts, quantities and discounts before either renderer starts. */
export function documentRenderDto<T extends RenderMoney>(value: T) {
  try { currencyMetadata(value.currencyCode); }
  catch { throw new WireCompatibilityError("Unsupported document currency"); }
  const header = publicMoneyDto(value, ["subtotal", "taxTotal", "total"]);
  const amountPaid = value.amountPaid ?? 0, amountDue = value.amountDue ?? value.total;
  return { ...header, ...publicMoneyDto({ amountPaid, amountDue }, ["amountPaid", "amountDue"]),
    lines: value.lines.map(line => {
      if (!Number.isSafeInteger(line.quantity) || (line.discountPercent !== undefined && !Number.isSafeInteger(line.discountPercent)))
        throw new WireCompatibilityError("Unsupported document quantity or basis-point discount");
      return publicMoneyDto(line, ["unitPrice", "taxAmount", "amount"]);
    }) };
}

// Quantity hundredths and discount basis points are independent of currency scale.
export function documentHundredths(value: number) {
  if (!Number.isSafeInteger(value)) throw new WireCompatibilityError("Unsupported document hundredths");
  const amount = BigInt(value), absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}
