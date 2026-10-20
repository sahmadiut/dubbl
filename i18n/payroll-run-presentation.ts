import { payrollJson } from "@/lib/money/payroll-ui";
import { payrollOverviewJson, payrollOverviewStatuses, type PayrollOverviewRun } from "./payroll-overview-presentation";

export const payrollRunTypes = ["regular", "termination", "bonus_only", "correction", "off_cycle"] as const;
export interface PayrollRun extends PayrollOverviewRun { runType: typeof payrollRunTypes[number] | null }
export interface PayrollRunEmployee { id: string; name: string; currency: string | null }
export interface PayrollRunParent extends PayrollRun { items: { employeeId: string; currency: string | null; employee: { name: string } }[] }
interface Pagination { total: number; page: number; limit: number; totalPages: number }
type Responses = {
  list: { data: PayrollRun[]; pagination: Pagination };
  parents: { data: PayrollRunParent[]; pagination: Pagination };
  employees: { data: PayrollRunEmployee[]; pagination: Pagination };
  created: { run: { id: string; status: typeof payrollOverviewStatuses[number] } };
};
const invalid = () => new Error("Invalid payroll run response");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function id(value: unknown) { if (typeof value !== "string" || !value.trim()) throw invalid(); }
function employee(value: unknown) {
  const row = object(value); id(row.id);
  if (typeof row.name !== "string" || row.currency !== null && typeof row.currency !== "string") throw invalid();
}

/** Check displayed fields, pagination and exact aliases before adopting list/choice/navigation data. */
export async function payrollRunJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw new Error("Payroll run request failed");
  const body = object(kind === "list" || kind === "parents"
    ? await payrollOverviewJson(response, "runs") : await payrollJson(response));
  if (kind === "created") {
    const run = object(body.run); id(run.id);
    if (!payrollOverviewStatuses.includes(run.status as typeof payrollOverviewStatuses[number])) throw invalid();
  } else {
    if (!Array.isArray(body.data)) throw invalid();
    const p = object(body.pagination);
    for (const key of ["total", "page", "limit", "totalPages"]) if (!Number.isSafeInteger(p[key]) || (p[key] as number) < 0) throw invalid();
    if ((p.page as number) < 1 || (p.limit as number) < 1 || (p.limit as number) > 100 ||
      p.totalPages !== Math.ceil((p.total as number) / (p.limit as number)) || body.data.length > (p.limit as number)) throw invalid();
    for (const value of body.data) {
      if (kind === "employees") { employee(value); continue; }
      const row = object(value); id(row.id);
      if (row.runType !== null && !payrollRunTypes.includes(row.runType as typeof payrollRunTypes[number])) throw invalid();
      if (kind === "parents") {
        if (row.status !== "completed" || !Array.isArray(row.items)) throw invalid();
        for (const value of row.items) {
          const item = object(value);
          employee({ id: item.employeeId, name: object(item.employee).name, currency: item.currency });
        }
      }
    }
  }
  return body as unknown as Responses[K];
}
