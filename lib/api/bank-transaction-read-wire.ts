import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { publicMoneyDto } from "./public-money-wire";

export const bankReadId = z.string().uuid().describe("Live organization-owned bank account or transaction UUID");
export const bankReadListFields = {
  bankAccountId: bankReadId,
  status: z.enum(["unreconciled", "reconciled", "excluded"]).optional().describe("Optional transaction status filter"),
  page: z.number().int().min(1).max(2147483647).default(1).describe("Positive page number; computed offset must fit PostgreSQL int32"),
  limit: z.number().int().min(1).max(200).default(50).describe("Rows per page, 1..200 for MCP; REST maximum 100"),
};
export const bankReadListSchema = z.object(bankReadListFields).strict();
export function bankReadPagination(input: unknown) {
  const parsed = bankReadListSchema.parse(input);
  const offset = (parsed.page - 1) * parsed.limit;
  if (offset > 2147483647) throw new z.ZodError([{ code: "custom", path: ["page"], message: "Pagination offset exceeds supported range" }]);
  return { ...parsed, offset };
}
export function bankReadQuery(url: URL, bankAccountId: string) {
  const numeric = (key: string, fallback: number) => {
    const value = url.searchParams.get(key);
    if (value === null) return fallback;
    if (!/^[1-9][0-9]*$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Expected canonical positive pagination integer" }]);
    return Number(value);
  };
  const limit = numeric("limit", 50);
  if (limit > 100) throw new z.ZodError([{ code: "custom", path: ["limit"], message: "REST limit must be 1..100" }]);
  const parsed = bankReadPagination({ bankAccountId, page: numeric("page", 1), limit, status: url.searchParams.get("status") ?? undefined });
  return { bankAccountId: parsed.bankAccountId, page: parsed.page, limit: parsed.limit, status: parsed.status };
}
export function bankReadCurrency(code: string) {
  const parsed = currencyCodeSchema.safeParse(code);
  if (!parsed.success || parsed.data !== code) throw new WireCompatibilityError("Invalid saved bank read currency");
  return code;
}
export function sameBankReadCurrency(code: string | null, expected: string) {
  bankReadCurrency(expected);
  if (code !== null && bankReadCurrency(code) !== expected) throw new WireCompatibilityError("Bank read contains incompatible currency units");
  return expected;
}
export function bankReadNullableMoney<T extends object>(row: T, fields: readonly (keyof T & string)[]) {
  const aliases: Record<string, string | null> = {};
  for (const field of fields) aliases[`${field}Minor`] = row[field] === null ? null : publicMoneyDto({ amount: row[field] }, ["amount"]).amountMinor;
  return { ...row, ...aliases };
}
/** Actual bank audit money keys and allocation items; opaque history retains its own units. */
export function bankReadAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(bankReadAudit);
  if (value === null || typeof value !== "object") return value;
  const row: Record<string, unknown> = { ...value };
  if (Array.isArray(row.allocations)) row.allocations = row.allocations.map(bankReadAudit);
  for (const key of ["amount", "balance", "taxAmount", "totalAmount"]) {
    if (!(key in row)) continue;
    const amount = row[key];
    // No conversion of immutable legacy history from string/major units.
    if (amount !== null && (typeof amount !== "number" || !Number.isSafeInteger(amount))) throw new WireCompatibilityError("Unsupported bank audit money value");
    const exact = amount === null ? null : BigInt(amount as number).toString();
    if (`${key}Minor` in row && row[`${key}Minor`] !== exact) throw new WireCompatibilityError("Conflicting saved bank audit aliases");
    row[`${key}Minor`] = exact;
  }
  stringifyWire(row);
  return row;
}
export function bankReadCount(value: string) { return legacyMinor(BigInt(value)); }

/** Compare integer money ratios exactly; no Number division at the 1%/5% boundaries. */
export function bankAmountProximity(a: number, b: number) {
  const left = BigInt(publicMoneyDto({ amount: a }, ["amount"]).amountMinor);
  const right = BigInt(publicMoneyDto({ amount: b }, ["amount"]).amountMinor);
  const abs = (n: bigint) => n < 0n ? -n : n;
  const x = abs(left), y = abs(right), max = x > y ? x : y, diff = abs(x - y);
  return x === y ? "exact" : diff * 100n < max ? "one" : diff * 20n < max ? "five" : "none";
}
