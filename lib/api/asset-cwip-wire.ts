import { z } from "zod";
import { assetDate, assetMasterId, assetMinorPair } from "./asset-master-wire";
import { exactMinorSchema, legacyMinorSchema } from "@/lib/money/wire";

const date = assetDate.refine(v => !v.startsWith("0000"), "Use Gregorian years 0001..9999");
const common = {
  date: date.describe("Posting date, Gregorian YYYY-MM-DD, years 0001..9999; cannot precede purchase or recorded construction costs"),
  cwipAccountId: assetMasterId.optional().describe("Live active organization-owned base-currency asset account; defaults saved CWIP account or 1700; cannot redirect accumulated costs"),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/).optional().describe("Optional organization/asset/operation retry key; changed inputs conflict; use for retried cost additions"),
};
export const assetCwipCostSchema = z.object({ ...common,
  amount: legacyMinorSchema.min(1).optional().describe("Positive integer cents, max 9007199254740991; this or amountMinor required"),
  amountMinor: exactMinorSchema.refine(v => !v.startsWith("-") && v !== "0", "Cost must be positive").optional().describe("Canonical positive cents string, same safe range; must agree with amount"),
  description: z.string().max(10000).optional().describe("Optional construction cost description, max 10000 characters"),
  sourceAccountId: assetMasterId.describe("Live active organization-owned base-currency account credited for the cost; must differ from CWIP"),
}).strict();
export const assetCapitalizeSchema = z.object({ ...common,
  inServiceDate: date.optional().describe("Gregorian service date, years 0001..9999; defaults capitalization date; cannot precede capitalization"),
  assetAccountId: assetMasterId.optional().describe("Live active organization-owned base-currency asset account debited; defaults saved account or 1500; must differ from CWIP"),
}).strict();
export const cwipAmount = (p: z.infer<typeof assetCwipCostSchema>) => assetMinorPair(p.amount, p.amountMinor, "amount", true)!;
