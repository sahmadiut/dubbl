import { payrollJson } from "@/lib/money/payroll-ui";

export const summaryFields = ["totalRuns", "totalGross", "totalDeductions", "totalNet", "activeEmployees", "avgCostPerRun"] as const;
export interface PayrollSummary {
  currency: string; totalRuns: number; totalGross: number; totalDeductions: number;
  totalNet: number; activeEmployees: number; avgCostPerRun: number;
}
export interface PayrollProjection {
  currency: string; month: string; gross: number; tax: number; net: number; headcount: number;
}
export interface PayrollScenario {
  currency: string;
  current: { monthlyGross: number; projectedTotal: number; headcount: number };
  projected: { monthlyGross: number; projectedTotal: number; headcount: number };
  difference: { monthlyGross: number; projectedTotal: number };
}
interface TaxRow { employeeId: string; employeeName: string; currency: string; totalGross: number; totalTax: number }
interface LaborRow { department: string; employeeCount: number; currency: string; totalGross: number; totalNet: number }
interface YoyRow { month: string; runCount: number; currency: string; totalGross: number; totalNet: number }
interface Responses {
  summary: { summary: PayrollSummary };
  projection: { currency: string; data: PayrollProjection[]; totals: { gross: number; tax: number; net: number } };
  scenario: PayrollScenario;
  "tax-liability": { data: TaxRow[]; totalTax: number; currency: string };
  "labor-cost": { data: LaborRow[] };
  yoy: { data: YoyRow[] };
}
const invalid = () => new Error("Invalid payroll analytics response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function currency(v: unknown) { text(v); if (!v) throw invalid(); }
function count(v: unknown) { if (!Number.isSafeInteger(v) || (v as number) < 0 || Object.is(v, -0)) throw invalid(); }
function month(v: unknown) { if (typeof v !== "string" || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw invalid(); }
function money(row: Record<string, unknown>, keys: readonly string[]) {
  // payrollJson validates safe integer cents, canonical aliases and currencies.
  for (const key of keys) if (typeof row[key] !== "number" || typeof row[key + "Minor"] !== "string") throw invalid();
}
/** Check the whole displayed envelope before state adoption. Never show diagnostics. */
export async function payrollAnalyticsJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if ("error" in body) throw invalid();
  if (kind === "summary") {
    const row = object(body.summary); currency(row.currency); count(row.totalRuns); count(row.activeEmployees);
    money(row, ["totalGross", "totalDeductions", "totalNet", "avgCostPerRun"]);
  } else if (kind === "scenario") {
    currency(body.currency);
    for (const key of ["current", "projected", "difference"]) {
      const row = object(body[key]); money(row, ["monthlyGross", "projectedTotal"]);
      if (key !== "difference") count(row.headcount);
    }
    const current = object(body.current), projected = object(body.projected), difference = object(body.difference);
    for (const key of ["monthlyGross", "projectedTotal"]) if (BigInt(projected[key] as number) - BigInt(current[key] as number) !== BigInt(difference[key] as number)) throw invalid();
  } else {
    if (!Array.isArray(body.data)) throw invalid();
    const seen = new Set();
    for (const value of body.data) {
      const row = object(value); currency(row.currency);
      money(row, kind === "projection" ? ["gross", "tax", "net"] : kind === "tax-liability" ? ["totalGross", "totalTax"] : ["totalGross", "totalNet"]);
      if (kind === "projection" || kind === "yoy") month(row.month);
      if (kind === "projection") { count(row.headcount); if (row.currency !== body.currency) throw invalid(); }
      if (kind === "yoy") count(row.runCount);
      if (kind === "labor-cost") { text(row.department); count(row.employeeCount); }
      if (kind === "tax-liability") { text(row.employeeId); if (!row.employeeId) throw invalid(); text(row.employeeName); if (row.currency !== body.currency) throw invalid(); }
      const key = kind === "tax-liability" ? row.employeeId : kind === "labor-cost" ? JSON.stringify([row.department, row.currency]) : row.month;
      if (seen.has(key)) throw invalid(); seen.add(key);
    }
    if (kind === "projection") { currency(body.currency); money(object(body.totals), ["gross", "tax", "net"]); }
    if (kind === "tax-liability") { currency(body.currency); money(body, ["totalTax"]); }
  }
  return body as unknown as Responses[K];
}
export function analyticsOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
