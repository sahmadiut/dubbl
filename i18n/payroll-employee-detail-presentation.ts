import { payrollJson } from "@/lib/money/payroll-ui";

export interface EmployeeDetail {
  id: string;
  name: string;
  email: string | null;
  employeeNumber: string;
  position: string | null;
  salary: number;
  payFrequency: string;
  taxRate: number;
  bankAccountNumber: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  compensationType: string;
  hourlyRate: number | null;
  memberId: string | null;
  member?: { user: { name: string | null; email: string } } | null;
  department: string | null;
  ptoBalanceHours: number | null;
  currency: string | null;
  compensationBandId: string | null;
}

export interface EmployeeDeduction {
  id: string;
  deductionType: { name: string; category: string; defaultAmount: number | null; defaultPercent: number | null };
  timing: string;
  amount: number | null;
  percent: number | null;
  isActive: boolean;
}

export interface TaxConfig {
  id: string;
  filingStatus: string;
  federalAllowances: number;
  stateAllowances: number;
  additionalWithholding: number | null;
}

export interface LeaveBalance {
  id: string;
  balance: number;
  usedHours: number;
  policy: { name: string; leaveType: string } | null;
}

export interface CompensationBand {
  id: string;
  name: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  currency: string;
}

type DetailResponses = {
  employee: { employee: EmployeeDetail };
  deductions: { data: EmployeeDeduction[] };
  tax: { taxConfig: TaxConfig };
  leave: { data: LeaveBalance[] };
  band: { band: CompensationBand };
  deleted: { success: true };
};
const invalid = () => new Error("Invalid payroll employee detail response");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): asserts value is string {
  if (typeof value !== "string") throw invalid();
}
function nullableText(value: unknown) { if (value !== null) text(value); }
function finite(value: unknown) { if (typeof value !== "number" || !Number.isFinite(value)) throw invalid(); }
function integer(value: unknown, max = 2147483647) {
  finite(value);
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > max) throw invalid();
}
function choice(value: unknown, values: readonly string[]) {
  if (typeof value !== "string" || !values.includes(value)) throw invalid();
}
function money(row: Record<string, unknown>, fields: string[], nullable = false) {
  // payrollJson verifies safe integer cents and matching canonical aliases.
  for (const field of fields) {
    if (nullable && row[field] === null && row[field + "Minor"] === null) continue;
    if (typeof row[field] !== "number" || typeof row[field + "Minor"] !== "string") throw invalid();
  }
}
function date(value: unknown) {
  text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) throw invalid();
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw invalid();
}
const filingStatuses = ["single", "married_joint", "married_separate", "head_of_household"];
const leaveTypes = ["vacation", "sick", "personal", "parental", "bereavement", "unpaid", "other"];

/** Check the real REST/MCP envelopes and displayed fields before adopting state. */
export async function payrollEmployeeDetailJson<K extends keyof DetailResponses>(response: Response, kind: K): Promise<DetailResponses[K]> {
  if (!response.ok) throw new Error("Payroll employee detail request failed");
  const body = object(await payrollJson(response));
  if (kind === "employee") {
    const e = object(body.employee);
    for (const key of ["id", "name", "employeeNumber"]) text(e[key]);
    for (const key of ["email", "position", "bankAccountNumber", "compensationBandId", "currency"]) nullableText(e[key]);
    if (typeof e.isActive !== "boolean") throw invalid();
    choice(e.payFrequency, ["weekly", "biweekly", "monthly"]);
    choice(e.compensationType, ["salary", "hourly", "milestone", "commission"]);
    integer(e.taxRate, 10000);
    date(e.startDate);
    if (e.endDate !== null) date(e.endDate);
    money(e, ["salary"]);
    money(e, ["hourlyRate"], true);
    if (e.member != null) {
      const user = object(object(e.member).user);
      nullableText(user.name); text(user.email);
    }
  } else if (kind === "tax") {
    const tc = object(body.taxConfig);
    text(tc.id); choice(tc.filingStatus, filingStatuses);
    integer(tc.federalAllowances); integer(tc.stateAllowances);
    money(tc, ["additionalWithholding"], true);
  } else if (kind === "band") {
    const band = object(body.band);
    for (const key of ["id", "name", "currency"]) text(band[key]);
    money(band, ["minSalary", "midSalary", "maxSalary"]);
  } else if (kind === "deleted") {
    if (body.success !== true) throw invalid();
  } else {
    if (!Array.isArray(body.data)) throw invalid();
    for (const value of body.data) {
      const row = object(value); text(row.id);
      if (kind === "deductions") {
        const type = object(row.deductionType);
        text(type.name); choice(type.category, ["pre_tax", "post_tax"]);
        choice(row.timing, ["recurring", "one_time"]);
        if (typeof row.isActive !== "boolean") throw invalid();
        money(row, ["amount"], true); money(type, ["defaultAmount"], true);
        for (const percent of [row.percent, type.defaultPercent]) if (percent !== null) finite(percent);
      } else {
        finite(row.balance); finite(row.usedHours);
        if (row.policy !== null) {
          const policy = object(row.policy); text(policy.name); choice(policy.leaveType, leaveTypes);
        }
      }
    }
  }
  return body as unknown as DetailResponses[K];
}
