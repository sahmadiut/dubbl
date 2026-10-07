import { z } from "zod";
import { reportDateSchema, reportMinor } from "./statement-wire";
import { periodInputError, periodRange } from "./period-statement-wire";

export const cashFlowSchema = z.object({
  startDate: reportDateSchema.optional().describe("Inclusive Gregorian start; defaults to January 1 of the current UTC year"),
  endDate: reportDateSchema.optional().describe("Inclusive Gregorian end; defaults to today in UTC"),
  method: z.enum(["indirect", "direct"]).optional().describe("Indirect by default; direct uses the existing cash-income heuristic, not payment tracing"),
  basis: z.enum(["accrual", "cash"]).optional().describe("Accrual by default; cash uses the existing cash-source/bank-account heuristic"),
}).strict();
export const cashFlowExportSchema = cashFlowSchema.extend({
  format: z.enum(["pdf", "xlsx"]).describe("PDF or XLSX file; amounts displayed with organization currency scale"),
});

export function cashFlowParameters(input: unknown) {
  const params = cashFlowSchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  return { ...periodRange(params.startDate ?? `${today.slice(0, 4)}-01-01`, params.endDate ?? today),
    method: params.method ?? "indirect", basis: params.basis ?? "accrual" };
}

export function cashFlowQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  const allowed = [...Object.keys(cashFlowSchema.shape), "format"];
  if ([...query.keys()].some(key => !allowed.includes(key)) || allowed.some(key => query.getAll(key).length > 1)) {
    throw periodInputError("Unsupported or duplicate cash-flow parameter");
  }
  const input = cashFlowSchema.parse(Object.fromEntries([...query].filter(([key]) => key !== "format")));
  return { input, format: z.enum(["json", "pdf", "xlsx"]).parse((query.get("format") ?? "json").toLowerCase()) };
}

type Dual<T> = T extends bigint ? number : T extends (infer U)[] ? Dual<U>[] : T extends object ?
  { [K in keyof T]: Dual<T[K]> } & { [K in keyof T as T[K] extends bigint ? `${K & string}Minor` : never]: string } : T;

/** Project only final report amounts; SQL sums and intermediate operands may be larger. */
export function cashFlowDual<T>(input: T): Dual<T> {
  const project = (value: unknown): unknown => {
    if (typeof value === "bigint") return reportMinor(value);
    if (Array.isArray(value)) return value.map(project);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => typeof item === "bigint"
        ? [[key, reportMinor(item)], [`${key}Minor`, item.toString()]] : [[key, project(item)]]));
    }
    return value;
  };
  return project(input) as Dual<T>;
}
