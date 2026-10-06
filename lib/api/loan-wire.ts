import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, WireCompatibilityError, stringifyWire } from "@/lib/money/wire";
import { parseMajor } from "@/lib/money/exact";
import { assetDate, assetMoneyDto } from "./asset-master-wire";

export const loanId = z.string().uuid().describe("Loan, account or schedule UUID in the authenticated organization");
export const loanStatus = z.enum(["active", "paid_off", "defaulted"]);
export const loanRetry = z.string().min(1).max(200).optional().describe("Optional organization-scoped retry key; identical normalized input replays, changed input conflicts");
const common = {
  name: z.string().min(1).max(10000).describe("Nonempty loan name"),
  bankAccountId: loanId.optional().describe("Optional active base-currency bank UUID used for repayment"),
  interestRate: z.number().int().min(0).max(100000).describe("Annual basis points, 0..100000; 500 = 5%; not money"),
  termMonths: z.number().int().min(1).max(1200).describe("Whole monthly periods, 1..1200"),
  startDate: assetDate.refine(v => v >= "0001-01-01", "Use a Gregorian year from 0001 to 9999").describe("Gregorian YYYY-MM-DD; first due date uses legacy UTC month overflow one month later"),
  principalAccountId: loanId.describe("Active organization-owned base-currency liability GL UUID"),
  interestAccountId: loanId.describe("Active organization-owned base-currency expense GL UUID"),
  principalAmountMinor: exactMinorSchema.optional().describe("Positive canonical cents string, max 9007199254740991; agrees with other principal aliases"),
  idempotencyKey: loanRetry,
};
export const loanCreateRestSchema = z.object({ ...common,
  principalAmount: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER).optional().describe("Legacy decimal major amount, rounded to cents half away from zero"),
  principalAmountExact: z.string().max(256).regex(/^\d+(?:\.\d+)?$/).optional().describe("Exact unsigned decimal major text; rounded to fixed cents half away from zero"),
}).strict();
export const loanCreateMcpSchema = z.object({ ...common,
  principalAmount: legacyMinorSchema.positive().optional().describe("Positive integer CENTS, max 9007199254740991; stored without multiplication"),
}).strict();
export const loanUpdateSchema = z.object({ name: common.name.optional(),
  status: loanStatus.optional().describe("Loan status; paid_off requires all payments posted; active requires remaining payments"),
}).strict();
export const loanPaymentSchema = z.object({
  scheduleEntryId: loanId.optional().describe("Optional expected next schedule UUID; repeated successful target replays without paying another period"),
  idempotencyKey: loanRetry,
}).strict();
export const loanListSchema = z.object({
  status: loanStatus.optional().describe("Optional loan status filter"),
  page: z.number().int().min(1).max(1000000).default(1).describe("One-based page, max 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Page size, 1..100"),
}).strict();
function majorCents(text: string) {
  try { return parseMajor(text, "USD", "half-away-from-zero").amountMinor; }
  catch { throw new WireCompatibilityError("Unsupported decimal principal range; use positive safe integer cents"); }
}
export function loanPrincipal(input: unknown, transport: "rest" | "mcp") {
  const p = transport === "rest" ? loanCreateRestSchema.parse(input) : loanCreateMcpSchema.parse(input);
  const values: bigint[] = [];
  if (p.principalAmount !== undefined) {
    if (Object.is(p.principalAmount, -0)) throw new WireCompatibilityError("Negative zero is not money");
    if (transport === "mcp") values.push(BigInt(p.principalAmount));
    else {
      const text = String(p.principalAmount);
      if (!/^\d+(?:\.\d+)?$/.test(text)) throw new WireCompatibilityError("Legacy principal requires ordinary decimal notation; use exact aliases");
      values.push(majorCents(text));
    }
  }
  if ("principalAmountExact" in p && typeof p.principalAmountExact === "string") values.push(majorCents(p.principalAmountExact));
  if (p.principalAmountMinor !== undefined) values.push(BigInt(p.principalAmountMinor));
  if (!values.length || values[0] <= 0n || values.some(v => v !== values[0]))
    throw new z.ZodError([{ code: "custom", path: ["principalAmount"], message: "Provide positive, agreeing principal aliases" }]);
  return { ...p, principalAmount: legacyMinor(values[0]) };
}
export const loanDto = <T extends object>(row: T) => assetMoneyDto(row, ["principalAmount", "monthlyPayment"]);
export const loanScheduleDto = <T extends object>(row: T) => assetMoneyDto(row, ["principalAmount", "interestAmount", "totalPayment", "remainingBalance"]);
export function loanQuery(url: URL) {
  const p: Record<string, unknown> = {};
  for (const field of ["page", "limit"]) {
    const text = url.searchParams.get(field);
    if (text !== null) {
      if (!/^[1-9]\d{0,6}$/.test(text)) throw new z.ZodError([{ code: "custom", path: [field], message: "Use a positive integer" }]);
      p[field] = Number(text);
    }
  }
  const status = url.searchParams.get("status"); if (status !== null) p.status = status;
  return loanListSchema.parse(p);
}
export async function readLoanJson(request: Request, empty = false): Promise<unknown> {
  try { const text = await request.text(); return empty && !text ? {} : JSON.parse(text); }
  catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid loan JSON body" }]); }
}
export function loanPreflight<T>(result: T): T { stringifyWire(result); return result; }
