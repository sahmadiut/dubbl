import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, exactRateSchema, WireCompatibilityError } from "@/lib/money/wire";
import { exactRate, fromLegacyRate, toLegacyRate, FX_DIRECTION } from "@/lib/currency/exact-rate";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { postingRatio } from "@/lib/money/posting";

const nonnegativeMinor = exactMinorSchema.refine(value => !value.startsWith("-"), "Journal amounts must be nonnegative");
export const journalLineFields = {
  accountId: z.string().uuid().describe("Organization-owned GL account UUID"),
  description: z.string().nullable().optional().describe("Optional line memo"),
  debitAmount: legacyMinorSchema.min(0).optional().describe("Legacy nonnegative stored minor-unit integer (USD cents); omitted debit defaults to zero"),
  debitAmountMinor: nonnegativeMinor.optional().describe("Canonical nonnegative int64 minor-unit string; must agree with debitAmount; currently limited to safe Number workflows"),
  creditAmount: legacyMinorSchema.min(0).optional().describe("Legacy nonnegative stored minor-unit integer (USD cents); omitted credit defaults to zero"),
  creditAmountMinor: nonnegativeMinor.optional().describe("Canonical nonnegative int64 minor-unit string; must agree with creditAmount; currently limited to safe Number workflows"),
  currencyCode: currencyCodeSchema.default("USD").describe("Existing line currency tag; amounts are never rescaled"),
  exchangeRate: z.number().int().positive().max(2147483647).optional().describe("Saved positive int32 millionths; 1000000 = 1.0; defaults to 1.0 only when both rate aliases are omitted"),
  rateExact: exactRateSchema.optional().describe("Saved quote-per-base decimal string; must fit legacy millionths exactly until domain cutover"),
  rateDirection: z.literal(FX_DIRECTION).optional().describe("Explicit quote units per base unit; never inverted by this boundary"),
  costCenterId: z.string().uuid().nullable().optional().describe("Optional organization-owned cost center UUID; null clears"),
  projectId: z.string().uuid().nullable().optional().describe("Optional organization-owned project UUID; null clears"),
};

/** Keep nested aliases intact through SDK validation; reject unsupported fields before writes. */
export const journalLineSchema = z.object(journalLineFields).strict();
export function journalLineInput(input: unknown) {
  const parsed = journalLineSchema.parse(input);
  function amount(numeric: number | undefined, exact: string | undefined, name: string) {
    if (numeric !== undefined && exact !== undefined && BigInt(numeric) !== BigInt(exact)) {
      throw new z.ZodError([{ code: "custom", path: [name + "Minor"], message: `${name} and ${name}Minor disagree` }]);
    }
    return exact === undefined ? numeric ?? 0 : legacyMinor(BigInt(exact));
  }
  const debitAmount = amount(parsed.debitAmount, parsed.debitAmountMinor, "debitAmount");
  const creditAmount = amount(parsed.creditAmount, parsed.creditAmountMinor, "creditAmount");
  const rateExact = parsed.rateExact ?? fromLegacyRate(parsed.exchangeRate ?? 1000000);
  let exchangeRate: number;
  try { exchangeRate = toLegacyRate(rateExact); } catch { throw new WireCompatibilityError("Journal rate must fit positive int32 millionths exactly"); }
  if (parsed.exchangeRate !== undefined && parsed.exchangeRate !== exchangeRate) {
    throw new z.ZodError([{ code: "custom", path: ["rateExact"], message: "exchangeRate and rateExact disagree" }]);
  }
  return { accountId: parsed.accountId, description: parsed.description, debitAmount, creditAmount,
    currencyCode: parsed.currencyCode, exchangeRate, rateExact, rateDirection: FX_DIRECTION,
    costCenterId: parsed.costCenterId, projectId: parsed.projectId };
}

type AmountLine = { debitAmount: number; creditAmount: number; currencyCode: string; exchangeRate: number };
function safeArithmetic(value: bigint) {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value < -limit || value > limit) throw new WireCompatibilityError("Journal sum or FX product exceeds the safe Number workflow range");
  return Number(value);
}
function safeSum(lines: AmountLine[], side: "debitAmount" | "creditAmount") {
  return safeArithmetic(lines.reduce((total, line) => total + BigInt(line[side]), BigInt(0)));
}

/** Guard sums/products before existing Number operations. Retain existing create-vs-edit balance policies. */
export function journalTotals(lines: AmountLine[], allowBaseBalance = false) {
  const totalDebit = safeSum(lines, "debitAmount"), totalCredit = safeSum(lines, "creditAmount");
  const multi = lines.some(line => line.currencyCode !== lines[0]?.currencyCode || line.exchangeRate !== 1000000);
  if (allowBaseBalance && multi) {
    const base = (side: "debitAmount" | "creditAmount") => safeArithmetic(lines.reduce((total, line) => {
      const product = line.exchangeRate === 1000000 ? line[side] : safeArithmetic(BigInt(line[side]) * BigInt(line.exchangeRate));
      const converted = line.exchangeRate === 1000000 ? product : postingRatio(product, 1, 1000000);
      return total + BigInt(converted);
    }, BigInt(0)));
    const difference = BigInt(base("debitAmount")) - BigInt(base("creditAmount"));
    if (difference < -BigInt(lines.length) || difference > BigInt(lines.length)) {
      throw new z.ZodError([{ code: "custom", path: ["lines"], message: "In your base currency, total debits must equal total credits." }]);
    }
  } else if (totalDebit !== totalCredit) {
    throw new z.ZodError([{ code: "custom", path: ["lines"], message: "Debits must equal credits" }]);
  }
  if (totalDebit === 0) throw new z.ZodError([{ code: "custom", path: ["lines"], message: "Entry must have non-zero amounts" }]);
  return { totalDebit, totalCredit };
}

export function journalTotalDebit(lines: AmountLine[]) {
  return safeSum(lines, "debitAmount");
}

/** Preserve REST's historical fixed /100 decimal-string alias, using exact formatting. */
export function journalLegacyDecimal(amount: number) {
  if (!Number.isSafeInteger(amount)) throw new WireCompatibilityError();
  const integer = BigInt(amount), absolute = integer < BigInt(0) ? -integer : integer;
  return `${integer < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
}

export function journalLineDto<T extends AmountLine & { rateExact?: string | null; rateMigrationStatus?: string; rateDirection?: string }>(line: T, rest = false) {
  if (!Number.isSafeInteger(line.debitAmount) || !Number.isSafeInteger(line.creditAmount)) throw new WireCompatibilityError();
  // Do not invent or repair missing/review-required historical FX on reads.
  let rateExact = line.rateExact ?? null;
  if (rateExact !== null) {
    try {
      rateExact = exactRate(rateExact);
      if (toLegacyRate(rateExact) !== line.exchangeRate || line.rateDirection !== FX_DIRECTION) throw new Error();
    } catch { throw new WireCompatibilityError("Stored journal FX aliases disagree"); }
  }
  return { ...line, debitAmount: rest ? journalLegacyDecimal(line.debitAmount) : line.debitAmount,
    creditAmount: rest ? journalLegacyDecimal(line.creditAmount) : line.creditAmount,
    debitAmountMinor: BigInt(line.debitAmount).toString(), creditAmountMinor: BigInt(line.creditAmount).toString(),
    rateExact, rateDirection: line.rateDirection ?? FX_DIRECTION,
    rateMigrationStatus: line.rateMigrationStatus ?? (rateExact === null ? "pending" : "valid") };
}
