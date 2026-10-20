import { payrollJson } from "@/lib/money/payroll-ui";

export const selfSheetStatuses = ["draft", "submitted", "approved", "rejected"] as const;
export const selfLeaveTypes = ["vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other"] as const;
export interface SelfProfile {
  id: string; name: string; email: string | null; employeeNumber: string;
  position: string | null; salary: number; currency: string;
  bankAccountNumber: string | null; ptoBalanceHours: number;
}
export interface SelfPayslip {
  id: string; employeeId: string; currency: string; grossAmount: number; netAmount: number;
  generatedAt: string; payrollRun: { payPeriodStart: string; payPeriodEnd: string } | null;
}
export interface SelfLeaveBalance {
  id: string; employeeId: string; balance: number; usedHours: number;
  policy: { name: string; leaveType: typeof selfLeaveTypes[number] } | null;
}
export interface SelfTimesheet {
  id: string; employeeId: string; periodStart: string; periodEnd: string;
  status: typeof selfSheetStatuses[number]; totalHours: number;
}
interface Responses {
  profile: { employee: SelfProfile }; payslips: { data: SelfPayslip[] };
  leave: { data: SelfLeaveBalance[] }; timesheets: { data: SelfTimesheet[] };
}
const invalid = () => new Error("Invalid payroll self-service response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function nullableText(v: unknown) { if (v !== null) text(v); }
function hours(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > Number.MAX_SAFE_INTEGER || Object.is(v, -0) || Math.fround(v) !== v) throw invalid();
}
function date(v: unknown) {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\d$/.test(v) || v.startsWith("0000") || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw invalid();
}
function period(row: Record<string, unknown>, start: string, end: string) {
  date(row[start]); date(row[end]); if ((row[start] as string) > (row[end] as string)) throw invalid();
}
function money(row: Record<string, unknown>, key: string) {
  // payrollJson checks canonical safe integer cents and matching Minor aliases.
  if (typeof row[key] !== "number" || typeof row[key + "Minor"] !== "string") throw invalid();
}
/** Check displayed fields and self identity before adopting state; diagnostics remain internal. */
export async function payrollSelfServiceJson<K extends keyof Responses>(response: Response, kind: K, employeeId?: string): Promise<Responses[K]> {
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if (kind === "profile") {
    const row = object(body.employee); id(row.id); text(row.name); text(row.employeeNumber); id(row.currency);
    nullableText(row.email); nullableText(row.position); nullableText(row.bankAccountNumber);
    money(row, "salary"); hours(row.ptoBalanceHours);
    if (employeeId !== undefined && row.id !== employeeId) throw invalid();
  } else {
    if (!Array.isArray(body.data)) throw invalid();
    const seen = new Set();
    for (const value of body.data) {
      const row = object(value); id(row.id); id(row.employeeId);
      if (seen.has(row.id) || employeeId !== undefined && row.employeeId !== employeeId) throw invalid();
      seen.add(row.id);
      if (kind === "payslips") {
        id(row.currency); money(row, "grossAmount"); money(row, "netAmount");
        if (typeof row.generatedAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(row.generatedAt) || !Number.isFinite(Date.parse(row.generatedAt))) throw invalid();
        if (row.payrollRun !== null) period(object(row.payrollRun), "payPeriodStart", "payPeriodEnd");
      } else if (kind === "leave") {
        hours(row.balance); hours(row.usedHours);
        if (row.policy !== null) {
          const p = object(row.policy); text(p.name);
          if (!selfLeaveTypes.includes(p.leaveType as typeof selfLeaveTypes[number])) throw invalid();
        }
      } else {
        period(row, "periodStart", "periodEnd"); hours(row.totalHours);
        if (!selfSheetStatuses.includes(row.status as typeof selfSheetStatuses[number])) throw invalid();
      }
    }
  }
  return body as unknown as Responses[K];
}
export function payrollSelfServiceOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
