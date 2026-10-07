import { z } from "zod";
import { reportDateSchema } from "./statement-wire";
import { periodInputError, periodRange } from "./period-statement-wire";

const dimension = z.union([z.uuid(), z.enum(["none", "null", ""])]);
const dates = {
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start; defaults to January 1 of the UTC year"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end; defaults to today in UTC"),
};
export const generalLedgerSchema = z.object({
  ...dates,
  accountId: z.uuid().optional().describe("Owned non-deleted account UUID for paginated detail; omit for account summaries"),
  offset: z.number().int().min(0).max(2147483647).optional().describe("Single-account line offset, 0-2147483647; defaults to zero; summary requires zero"),
  limit: z.number().int().min(1).max(500).optional().describe("JSON lines per account, 1-500; defaults to 50; PDF/XLSX contain all qualifying lines"),
  costCenterId: dimension.optional().describe("Owned cost center UUID or none/null/empty for untagged lines; takes precedence over projectId"),
  projectId: dimension.optional().describe("Owned project UUID or none/null/empty for untagged lines; ignored if costCenterId supplied"),
}).strict();
export const accountTransactionsSchema = z.object({
  ...dates,
  accountId: z.uuid().describe("Required owned non-deleted chart account UUID; returns all qualifying lines"),
}).strict();
export type LedgerKind = "general-ledger" | "account-transactions";
export function ledgerRange(params: { startDate?: string; endDate?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return periodRange(params.startDate ?? `${today.slice(0, 4)}-01-01`, params.endDate ?? today);
}
export function ledgerQuery(request: Request, kind: LedgerKind) {
  const query = new URL(request.url).searchParams;
  const schema = kind === "general-ledger" ? generalLedgerSchema : accountTransactionsSchema;
  const allowed = [...Object.keys(schema.shape), ...(kind === "general-ledger" ? ["format"] : [])];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw periodInputError("Unsupported or duplicate ledger parameter");
  }
  const input: Record<string, unknown> = Object.fromEntries([...query].filter(([key]) => key !== "format"));
  for (const key of ["offset", "limit"]) if (query.has(key)) {
    if (!/^(0|[1-9]\d{0,9})$/.test(query.get(key)!)) throw periodInputError(`${key} must be a canonical non-negative integer`);
    input[key] = Number(query.get(key));
  }
  const format = z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase());
  if (format !== "json" && query.has("accountId")) throw periodInputError("Single-account general ledger supports JSON only");
  return { input: schema.parse(input), format };
}
