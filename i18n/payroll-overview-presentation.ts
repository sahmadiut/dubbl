import { payrollJson } from "@/lib/money/payroll-ui";

export interface PayrollOverviewEmployee {
  id: string;
  name: string;
  employeeNumber: string;
  position: string | null;
  salary: number;
  salaryMinor: string;
  currency: string | null;
  payFrequency: string;
  isActive: boolean;
}

export const payrollOverviewStatuses = ["draft", "processing", "completed", "void", "pending_approval"] as const;
export type PayrollOverviewStatus = typeof payrollOverviewStatuses[number];
export interface PayrollOverviewRun {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: PayrollOverviewStatus;
  totalGross: number;
  totalGrossMinor: string;
  totalDeductions: number;
  totalDeductionsMinor: string;
  totalNet: number;
  totalNetMinor: string;
  baseCurrency: string | null;
}

const invalid = () => new Error("Invalid payroll overview response");
const text = (value: unknown): value is string => typeof value === "string";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function date(value: unknown) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) throw invalid();
  const parsed = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid();
}
function money(row: Record<string, unknown>, fields: string[]) {
  // payrollJson already checks safe integers, canonical matching aliases,
  // nonnegative salaries and legacy cents. Require every displayed field too.
  for (const field of fields) if (typeof row[field] !== "number" || !text(row[field + "Minor"])) throw invalid();
}

export function payrollOverviewJson(response: Response, kind: "employees"): Promise<{ data: PayrollOverviewEmployee[] }>;
export function payrollOverviewJson(response: Response, kind: "runs"): Promise<{ data: PayrollOverviewRun[] }>;
export async function payrollOverviewJson(response: Response, kind: "employees" | "runs") {
  if (!response.ok) throw new Error("Payroll overview request failed");
  const body = object(await payrollJson(response));
  if (!Array.isArray(body.data)) throw invalid();
  for (const value of body.data) {
    const row = object(value);
    if (!text(row.id)) throw invalid();
    if (kind === "employees") {
      if (![row.name, row.employeeNumber].every(text) || (row.position !== null && !text(row.position)) ||
        typeof row.isActive !== "boolean" || !["weekly", "biweekly", "monthly"].includes(row.payFrequency as string) ||
        (row.currency !== null && !text(row.currency))) throw invalid();
      money(row, ["salary"]);
    } else {
      if (!payrollOverviewStatuses.includes(row.status as PayrollOverviewStatus) ||
        (row.baseCurrency !== null && !text(row.baseCurrency))) throw invalid();
      date(row.payPeriodStart);
      date(row.payPeriodEnd);
      money(row, ["totalGross", "totalDeductions", "totalNet"]);
    }
  }
  return body as unknown as { data: PayrollOverviewEmployee[] | PayrollOverviewRun[] };
}
