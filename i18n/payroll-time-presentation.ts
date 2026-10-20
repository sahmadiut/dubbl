import { payrollJson } from "@/lib/money/payroll-ui";

export interface TimeSheetRow {
  id: string; periodStart: string; periodEnd: string; status: string; totalHours: number;
  employee: { name: string; employeeNumber: string } | null;
}
export interface LeaveRow {
  id: string; startDate: string; endDate: string; hours: number; status: string; reason: string | null;
  employee: { name: string } | null; policy: { name: string; leaveType: string } | null;
}
interface Choice { id: string; name: string }
interface Page<T> { data: T[]; pagination: { total: number; page: number; limit: number; totalPages: number } }
interface Responses {
  timesheets: Page<TimeSheetRow>; leave: Page<LeaveRow>;
  employees: { data: Choice[] }; policies: { data: Choice[] };
  timesheetCreated: { timesheet: { id: string } };
  leaveCreated: { request: { id: string; status: string } };
  approved: { request: { id: string; status: string } };
  rejected: { request: { id: string; status: string } };
}
const invalid = () => new Error("Invalid payroll time response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function date(v: unknown) {
  if (typeof v !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v) || v.startsWith("0000") ||
    !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw invalid();
}
function hours(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > Number.MAX_SAFE_INTEGER || Object.is(v, -0) || Math.fround(v) !== v) throw invalid();
}
function row(value: unknown, leave: boolean) {
  const r = object(value); id(r.id);
  const start = leave ? "startDate" : "periodStart", end = leave ? "endDate" : "periodEnd";
  date(r[start]); date(r[end]); if ((r[end] as string) < (r[start] as string)) throw invalid();
  if (!(leave ? ["pending", "approved", "rejected", "cancelled"] : ["draft", "submitted", "approved", "rejected"]).includes(r.status as string)) throw invalid();
  hours(r[leave ? "hours" : "totalHours"]);
  if (r.employee !== null) { const e = object(r.employee); text(e.name); if (!leave) text(e.employeeNumber); }
  if (leave) {
    if ((r[start] as string).slice(0, 4) !== (r[end] as string).slice(0, 4)) throw invalid();
    if (r.reason !== null) text(r.reason);
    if (r.policy !== null) { const p = object(r.policy); text(p.name); text(p.leaveType); }
  }
}
/** Validate displayed fields before adoption; diagnostic response prose never becomes UI copy. */
export async function payrollTimeJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw new Error("Payroll time request failed");
  const body = object(await payrollJson(response));
  if (["timesheets", "leave", "employees", "policies"].includes(kind)) {
    if (!Array.isArray(body.data)) throw invalid();
    const seen = new Set();
    body.data.forEach(value => {
      const r = object(value); id(r.id); if (seen.has(r.id)) throw invalid(); seen.add(r.id);
      if (kind === "timesheets" || kind === "leave") row(r, kind === "leave");
      else text(r.name);
    });
    if (kind === "timesheets" || kind === "leave") {
      const p = object(body.pagination);
      for (const k of ["total", "page", "limit", "totalPages"]) if (!Number.isSafeInteger(p[k]) || (p[k] as number) < 0) throw invalid();
      if ((p.page as number) < 1 || (p.limit as number) < 1 || (p.limit as number) > 100 || p.totalPages !== Math.ceil((p.total as number) / (p.limit as number)) || body.data.length > (p.limit as number)) throw invalid();
    }
  } else {
    const r = object(body[kind === "timesheetCreated" ? "timesheet" : "request"]); id(r.id);
    if (kind !== "timesheetCreated" && r.status !== (kind === "leaveCreated" ? "pending" : kind)) throw invalid();
  }
  return body as unknown as Responses[K];
}

export function payrollTimeOrganization() {
  try { return typeof window === "undefined" ? null : localStorage.getItem("activeOrgId"); }
  catch { return null; }
}
