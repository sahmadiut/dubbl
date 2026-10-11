import { currencyMetadata, money, parseMajor, roundRatio, toMajorDecimal } from "./exact";
import { invoiceUiMinor } from "./invoice-ui";
import { expenseMoneyDisplay } from "./expense-display";

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function supported(value: bigint) {
  if (value < 0n || value > SAFE) throw new RangeError("Expense amount exceeds the supported nonnegative range");
  return value;
}
function decimal(text: string) {
  if (text.length > 40 || !/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/.test(text))
    throw new RangeError("Enter a nonnegative decimal amount (up to 18 decimal places)");
  const [whole, fraction = ""] = text.split(".");
  return { numerator: BigInt(whole + fraction), denominator: 10n ** BigInt(fraction.length) };
}
export const expenseUiDecimal = (amount: bigint, currency: string) => toMajorDecimal(money(amount, currency));
export const expenseUiMoney = expenseMoneyDisplay;
export function expenseUiMinor(row: object, field: string) {
  return supported(invoiceUiMinor(row as Record<string, unknown>, field));
}

export interface ExpenseEditorItem {
  id?: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  accountId: string;
  receiptFileKey: string;
  receiptFileName: string;
  taxRateId?: string;
  isMileage?: boolean;
  distanceMiles?: string;
  mileageRate?: string;
}

/** Amount is tax inclusive. Mileage extends the entered decimal distance/rate before rounding;
 * independently rounded metadata never retrospectively recomputes the saved amount. */
export function expenseEditorAmount(item: ExpenseEditorItem, currency: string) {
  currencyMetadata(currency);
  if (!item.isMileage) {
    decimal(item.amount);
    const amount = supported(parseMajor(item.amount, currency, "half-away-from-zero").amountMinor);
    return { amountExact: item.amount, amountMinor: String(amount) };
  }
  const distance = decimal(item.distanceMiles ?? ""), rate = decimal(item.mileageRate ?? "");
  const distanceMinor = roundRatio(distance.numerator * 100n, distance.denominator, "half-away-from-zero");
  if (distanceMinor > 2147483647n) throw new RangeError("Distance exceeds the supported miles range");
  const scale = 10n ** BigInt(currencyMetadata(currency).minorUnits);
  const mileageRate = supported(roundRatio(rate.numerator * scale, rate.denominator, "half-away-from-zero"));
  const amount = supported(roundRatio(distance.numerator * rate.numerator * scale, distance.denominator * rate.denominator, "half-away-from-zero"));
  return { amountMinor: String(amount), distanceMiles: Number(distanceMinor), mileageRateMinor: String(mileageRate) };
}
export function expenseEditorItems(items: readonly ExpenseEditorItem[], currency: string, positive = false) {
  if (!items.length || items.length > 1000) throw new RangeError("Add between 1 and 1000 expense items");
  const lines = items.map(item => {
    if (!item.description.trim()) throw new RangeError("Add a description for every expense item");
    const amount = expenseEditorAmount(item, currency);
    if (positive && BigInt(amount.amountMinor) <= 0n) throw new RangeError("Each item needs an amount greater than zero");
    return { ...(item.id ? { id: item.id } : {}), date: item.date, description: item.description, ...amount,
      category: item.category || null, accountId: item.accountId || null,
      receiptFileKey: item.receiptFileKey || null, receiptFileName: item.receiptFileName || null,
      ...(item.taxRateId === undefined ? {} : { taxRateId: item.taxRateId || null }),
      ...(item.isMileage === undefined ? {} : { isMileage: item.isMileage,
        ...(!item.isMileage ? { distanceMiles: null, mileageRateMinor: null } : {}) }) };
  });
  const total = supported(lines.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n));
  return { items: lines, total };
}
export function expenseEditorPreview(items: readonly ExpenseEditorItem[], currency: string | null) {
  try {
    if (!currency) throw new RangeError("Load the organization currency before entering expenses");
    const amounts = items.map(item => BigInt(expenseEditorAmount(item, currency).amountMinor));
    const total = supported(amounts.reduce((sum, amount) => sum + amount, 0n));
    return { total, amounts, error: null };
  } catch (error) {
    return { total: 0n, amounts: [] as bigint[], error: error instanceof Error ? error.message : "Invalid expense amount" };
  }
}

/** Keep safe compatibility numbers in the saved object; every monetary consumer adopts validated bigint. */
export function expenseUiHeader<T extends { currencyCode: string; totalAmount: number }>(row: T) {
  currencyMetadata(row.currencyCode); expenseUiMinor(row, "totalAmount"); return row;
}
export function expenseUiDocument<T extends { currencyCode: string; totalAmount: number;
  items: { amount: number; mileageRate: number | null; distanceMiles: number | null; isMileage: boolean }[] }>(row: T) {
  expenseUiHeader(row);
  if (!row.items.length) throw new RangeError("Expense claim has no items");
  const sum = row.items.reduce((total, item) => {
    const rate = (item as Record<string, unknown>).mileageRateMinor;
    if (item.mileageRate === null) {
      if (rate != null) throw new RangeError("Invalid mileage rate aliases");
    } else expenseUiMinor(item, "mileageRate");
    if (item.distanceMiles !== null && (!Number.isInteger(item.distanceMiles) || item.distanceMiles < 0 || item.distanceMiles > 2147483647))
      throw new RangeError("Invalid saved mileage distance");
    if (item.isMileage && (item.distanceMiles === null || item.mileageRate === null)) throw new RangeError("Missing saved mileage metadata");
    return total + expenseUiMinor(item, "amount");
  }, 0n);
  if (sum !== expenseUiMinor(row, "totalAmount")) throw new RangeError("Expense items and total disagree");
  return row;
}
export function expenseUiMileageSetting<T extends { currencyCode: string; mileageRate: number }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { currencyCode: row.currencyCode, rate: expenseUiDecimal(expenseUiMinor(row, "mileageRate"), row.currencyCode) };
}
export function expenseUiCounts<T extends { counts: Record<string, { amount: number; currencyCode: string }> }>(row: T) {
  for (const bucket of Object.values(row.counts)) { currencyMetadata(bucket.currencyCode); expenseUiMinor(bucket, "amount"); }
  return row;
}
export function expenseDistanceText(distance: number) {
  if (!Number.isInteger(distance) || distance < 0 || distance > 2147483647) throw new RangeError("Invalid mileage distance");
  return `${BigInt(distance) / 100n}.${String(BigInt(distance) % 100n).padStart(2, "0")}`;
}
