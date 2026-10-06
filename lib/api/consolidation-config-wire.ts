import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const consolidationId = z.string().uuid().describe("Consolidation group, organization or rule UUID");
const name = z.string().trim().min(1).max(1000);
export const consolidationGroupCreateSchema = z.object({
  name: name.describe("Nonempty group name, at most 1000 characters"),
  presentationCurrency: currencyCodeSchema.optional().describe("ISO presentation currency, defaults USD; no ledger conversion or rescaling"),
}).strict();
export const consolidationGroupUpdateSchema = consolidationGroupCreateSchema.partial().refine(v => Object.keys(v).length > 0, "At least one group field is required");
export const consolidationMemberSchema = z.object({
  orgId: consolidationId.describe("Organization UUID in which the caller has current membership"),
  label: z.string().max(1000).nullable().optional().describe("Optional display label, null for organization name"),
  functionalCurrency: currencyCodeSchema.nullable().optional().describe("Optional ISO functional currency override, null uses organization currency; report configuration only"),
}).strict();
export const consolidationMemberRemoveSchema = z.object({ orgId: consolidationId.describe("Member organization UUID to unlink") }).strict();
export const consolidationRuleSchema = z.object({
  name: name.describe("Nonempty elimination rule name, at most 1000 characters"),
  kind: z.enum(["ar_ap", "sales_cogs", "investment_equity", "custom"]).describe("Elimination kind; investment_equity remains a report stub"),
  debitAccountMatch: z.string().max(100).nullable().optional().describe("Debit account-code prefix, null for no explicit match"),
  creditAccountMatch: z.string().max(100).nullable().optional().describe("Credit account-code prefix, null for no explicit match"),
  description: z.string().max(10000).nullable().optional().describe("Optional rule explanation, null clears"),
}).strict();
export function savedConsolidationCurrency(value: string) {
  if (!currencyCodeSchema.safeParse(value).success || currencyCodeSchema.parse(value) !== value)
    throw new WireCompatibilityError("Saved consolidation currency is unsupported or noncanonical");
  return value;
}
export function consolidationConfigDto<T>(row: T) { stringifyWire(row); return row; }
export async function readConsolidationJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid consolidation JSON body" }]); }
}
