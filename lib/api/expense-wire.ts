import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { currencyMetadata } from "@/lib/money/exact";
import { invoiceDecimalRatio, invoiceRound, invoiceWriteLineFields } from "./invoice-write-wire";
import { paymentListFields } from "./payment-read-wire";
import { publicMoneyDto } from "./public-money-wire";

export type ExpenseTransport = "rest" | "mcp";
const dimension = (name: string) => z.string().uuid().nullable().optional().describe(`Optional organization-owned ${name} UUID; null clears`);
export const expenseIdField = z.string().uuid().describe("Live expense claim UUID in the authenticated organization");
export const expenseItemFields = {
  date: rateDateSchema.describe("Gregorian expense date YYYY-MM-DD; old and new dates must be open"),
  description: z.string().min(1).max(10000).describe("Nonempty expense line description"),
  amount: z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional().describe("Legacy REST decimal major-unit amount, USD 12.50; tax-inclusive stored total"),
  amountExact: invoiceWriteLineFields.unitPriceExact.describe("Optional exact nonnegative decimal major-unit amount string, e.g. USD '12.50'; must agree with numeric amount"),
  amountMinor: exactMinorSchema.optional().describe("Optional nonnegative canonical integer minor-unit amount string; safe-number coexistence limit 9007199254740991"),
  category: z.string().max(10000).nullable().optional().describe("Optional category label; null clears"),
  accountId: dimension("expense account"), taxRateId: dimension("purchase tax rate"), costCenterId: dimension("cost center"),
  receiptFileKey: z.string().max(10000).nullable().optional().describe("Optional organization-owned uploaded attachment key under the organization UUID prefix; no upload or signing occurs here"),
  receiptFileName: z.string().max(10000).nullable().optional().describe("Optional receipt file name; null clears"),
  isMileage: z.boolean().optional().describe("Mileage metadata flag; amount remains explicitly supplied, never recomputed from distance"),
  distanceMiles: z.number().int().min(0).max(2147483647).nullable().optional().describe("Optional distance in miles times 100, nonnegative int32; required when isMileage is true"),
  mileageRate: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional().describe("Optional reimbursement rate in integer claim-currency minor units per mile; required for mileage"),
  mileageRateMinor: exactMinorSchema.nullable().optional().describe("Optional exact mileage rate integer minor-unit string per mile; agrees with mileageRate; null clears"),
};
const mcpItemFields = { ...expenseItemFields,
  amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().describe("Legacy MCP integer currency minor units, USD 1250 cents = $12.50; must agree with amountMinor/amountExact") };
const restItem = z.object(expenseItemFields).strict();
const mcpItem = z.object(mcpItemFields).strict();
const lineId = z.string().uuid().optional().describe("Optional existing line UUID of this claim; retains omitted metadata on replacement");
const items = <T extends z.ZodType>(schema: T) => z.array(schema).min(1).max(1000)
  .describe("1 through 1000 tax-inclusive expense lines; update replaces all lines, existing IDs retain omitted metadata");
export const expenseCreateFields = {
  title: z.string().min(1).max(10000).describe("Nonempty expense claim title"),
  description: z.string().max(10000).nullable().optional().describe("Optional claim description; null clears"),
  currencyCode: currencyCodeSchema.optional().describe("Claim currency; defaults to organization default, never converts existing units"),
  items: items(restItem),
};
export const expenseMcpCreateFields = { ...expenseCreateFields, items: items(mcpItem) };
export const expenseUpdateFields = { title: expenseCreateFields.title.optional().describe("Optional replacement title"),
  description: expenseCreateFields.description, items: items(restItem.extend({ id: lineId })).optional().describe("Optional complete replacement lines; amounts in decimal major units; existing IDs retain omitted metadata") };
export const expenseMcpUpdateFields = { ...expenseUpdateFields, items: items(mcpItem.extend({ id: lineId })).optional().describe("Optional complete replacement lines; numeric amounts in integer minor units; existing IDs retain omitted metadata") };
export const expenseListFields = { page: paymentListFields.page, limit: paymentListFields.limit,
  status: z.enum(["draft", "submitted", "approved", "rejected", "paid"]).optional().describe("Optional saved claim status") };
export const expenseListSchema = z.object(expenseListFields).strict();
export const expenseCreateSchema = z.object(expenseCreateFields).strict();
export const expenseMcpCreateSchema = z.object(expenseMcpCreateFields).strict();
export const expenseUpdateSchema = z.object(expenseUpdateFields).strict();
export const expenseMcpUpdateSchema = z.object(expenseMcpUpdateFields).strict();
type AmountInput = { amount?: number; amountExact?: string; amountMinor?: string };
function invalid(message: string): never { throw new z.ZodError([{ code: "custom", path: ["items"], message }]); }
export async function readExpenseJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { invalid("Invalid JSON expense body"); }
}
export function expenseAmount(line: AmountInput, currency: string, transport: ExpenseTransport) {
  if (line.amount === undefined && line.amountExact === undefined && line.amountMinor === undefined) invalid("Provide amount, amountExact or amountMinor");
  if ((line.amountExact !== undefined && line.amountExact.startsWith("-")) || (line.amountMinor !== undefined && line.amountMinor.startsWith("-"))) invalid("Expense amounts must be nonnegative");
  const numeric = transport === "rest" && line.amount !== undefined ? invoiceDecimalRatio(line.amount) : undefined;
  const exact = line.amountExact === undefined ? undefined : invoiceDecimalRatio(line.amountExact);
  if (numeric && exact && numeric.numerator * exact.denominator !== exact.numerator * numeric.denominator) invalid("amount and amountExact disagree");
  const major = exact ?? numeric;
  const minor = major ? invoiceRound(major.numerator * 10n ** BigInt(currencyMetadata(currency).minorUnits), major.denominator)
    : BigInt(line.amountMinor ?? line.amount!);
  if (line.amountMinor !== undefined && minor !== BigInt(line.amountMinor)) invalid("amountMinor and rounded major amount disagree");
  const amount = legacyMinor(minor);
  if (transport === "mcp" && line.amount !== undefined && line.amount !== amount) invalid("amount and exact aliases disagree");
  return amount;
}
export function expenseMileageRate(line: { mileageRate?: number | null; mileageRateMinor?: string | null }) {
  if (line.mileageRateMinor !== undefined && line.mileageRate !== undefined &&
    line.mileageRateMinor !== (line.mileageRate === null ? null : String(line.mileageRate))) invalid("Mileage rate aliases disagree");
  if (line.mileageRateMinor == null) return line.mileageRateMinor === null ? null : line.mileageRate;
  const amount = BigInt(line.mileageRateMinor);
  if (amount < 0n) invalid("Mileage rate must be nonnegative");
  return legacyMinor(amount);
}
export function expenseHeaderDto<T extends { totalAmount: number }>(row: T) {
  if (row.totalAmount < 0) throw new WireCompatibilityError("Negative expense total is unsupported");
  return publicMoneyDto(row, ["totalAmount"]);
}
export function expenseItemDto<T extends { amount: number; mileageRate: number | null; distanceMiles: number | null }>(row: T) {
  if (row.amount < 0 || (row.mileageRate !== null && row.mileageRate < 0) ||
    (row.distanceMiles !== null && (!Number.isInteger(row.distanceMiles) || row.distanceMiles < 0 || row.distanceMiles > 2147483647)))
    throw new WireCompatibilityError("Invalid saved expense or mileage metadata");
  return { ...publicMoneyDto(row, ["amount"]), mileageRateMinor: row.mileageRate === null ? null : publicMoneyDto({ amount: row.mileageRate }, ["amount"]).amountMinor };
}
