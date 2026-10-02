import { z } from "zod";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, WireCompatibilityError } from "@/lib/money/wire";

/** Contact limits retain the existing stored cents/minor-unit integer; never rescale. */
export const contactCreditFields = {
  creditLimit: legacyMinorSchema.min(0).nullable().optional()
    .describe("Optional nonnegative safe integer credit limit in existing currency minor units (USD cents); null clears the limit"),
  creditLimitMinor: exactMinorSchema.refine(value => !value.startsWith("-"), "Credit limit must be nonnegative")
    .nullable().optional().describe("Optional canonical nonnegative int64 minor-unit string; null clears the limit; must agree with creditLimit when both are supplied"),
};

const creditInput = z.object(contactCreditFields).superRefine((value, ctx) => {
  if (value.creditLimit === undefined || value.creditLimitMinor === undefined) return;
  if (value.creditLimit === null || value.creditLimitMinor === null) {
    if (value.creditLimit !== value.creditLimitMinor) {
      ctx.addIssue({ code: "custom", message: "creditLimit and creditLimitMinor disagree", path: ["creditLimitMinor"] });
    }
  } else if (Number.isSafeInteger(value.creditLimit) && exactMinorSchema.safeParse(value.creditLimitMinor).success
    && BigInt(value.creditLimit) !== BigInt(value.creditLimitMinor)) {
    ctx.addIssue({ code: "custom", message: "creditLimit and creditLimitMinor disagree", path: ["creditLimitMinor"] });
  }
});

/** Resolve/guard before any mutation while the ORM and business consumers use Number. */
export function contactCreditInput(input: unknown): { creditLimit?: number | null } {
  const parsed = creditInput.parse(input);
  if (parsed.creditLimitMinor === null) return { creditLimit: null };
  if (parsed.creditLimitMinor !== undefined) return { creditLimit: legacyMinor(BigInt(parsed.creditLimitMinor)) };
  return parsed.creditLimit === undefined ? {} : { creditLimit: parsed.creditLimit };
}

export function contactDto<T extends { creditLimit: number | null }>(value: T) {
  if (value.creditLimit !== null && !Number.isSafeInteger(value.creditLimit)) throw new WireCompatibilityError();
  return { ...value, creditLimitMinor: value.creditLimit === null ? null : BigInt(value.creditLimit).toString() };
}

/** PostgreSQL sum(bigint) is numeric: request text, add with bigint, then guard compatibility. */
export function contactBalanceDto(owesYou: string, youOwe: string, customerOverdue: string, supplierOverdue: string) {
  const amounts = { owesYou: BigInt(owesYou), youOwe: BigInt(youOwe), overdue: BigInt(customerOverdue) + BigInt(supplierOverdue) };
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (Object.values(amounts).some(value => value < -limit || value > limit)) throw new WireCompatibilityError();
  return {
    owesYou: Number(amounts.owesYou), owesYouMinor: amounts.owesYou.toString(),
    youOwe: Number(amounts.youOwe), youOweMinor: amounts.youOwe.toString(),
    overdue: Number(amounts.overdue), overdueMinor: amounts.overdue.toString(),
  };
}
