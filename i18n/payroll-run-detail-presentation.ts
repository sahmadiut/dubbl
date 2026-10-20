import { payrollJson } from "@/lib/money/payroll-ui";
import { payrollOverviewJson, type PayrollOverviewRun } from "./payroll-overview-presentation";
import { payrollRunTypes } from "./payroll-run-presentation";

export const payrollItemTypes = ["regular_salary", "hourly_pay", "overtime", "milestone_bonus", "project_bonus", "commission", "deduction", "reimbursement"] as const;
export const payrollBonusTypes = ["performance", "signing", "referral", "holiday", "spot", "retention", "other"] as const;
export const payrollApprovalStatuses = ["pending", "approved", "rejected"] as const;
export interface PayrollItemRow {
  id: string; employeeId: string; rateExact: string;
  preTaxDeductions: number | null; postTaxDeductions: number | null;
  grossAmount: number; taxAmount: number; deductions: number; netAmount: number;
  type: typeof payrollItemTypes[number] | null; description: string | null;
  currency: string | null; fxRate: number | null;
  employee: { name: string; employeeNumber: string } | null;
}
export interface PayrollRunDetail extends PayrollOverviewRun {
  approvalStatus: typeof payrollApprovalStatuses[number] | null;
  runType: typeof payrollRunTypes[number]; journalEntryId: string | null;
  processedAt: string | null; items: PayrollItemRow[];
}
export interface PayrollBonus {
  id: string; employeeId: string; bonusType: typeof payrollBonusTypes[number];
  amount: number; description: string | null;
  employee?: { name: string; currency: string | null };
}
type Responses = {
  detail: { run: PayrollRunDetail };
  bonuses: { bonuses: PayrollBonus[] };
  bonus: { bonus: PayrollBonus };
  payslips: { count: number };
};
const invalid = () => new Error("Invalid payroll run detail response");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown) { if (typeof value !== "string") throw invalid(); }
function id(value: unknown) { text(value); if (!(value as string).trim()) throw invalid(); }
function nullableText(value: unknown) { if (value !== null) text(value); }
function money(row: Record<string, unknown>, field: string, nullable = false) {
  // payrollJson checks safe integers, currencies and canonical matching aliases.
  if (nullable && row[field] === null && row[field + "Minor"] === null) return;
  if (typeof row[field] !== "number" || typeof row[field + "Minor"] !== "string") throw invalid();
}
function bonus(value: unknown) {
  const row = object(value); id(row.id); id(row.employeeId); money(row, "amount");
  if (!payrollBonusTypes.includes(row.bonusType as typeof payrollBonusTypes[number])) throw invalid();
  nullableText(row.description);
  if (row.employee !== undefined) { const e = object(row.employee); text(e.name); nullableText(e.currency); }
}

/** Validate success envelopes before adopting UI state or showing mutation success. */
export async function payrollRunDetailJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw new Error("Payroll run detail request failed");
  const body = object(await payrollJson(response));
  if (kind === "detail") {
    const row = object(body.run); id(row.id);
    await payrollOverviewJson(Response.json({ data: [row] }), "runs");
    if (!payrollRunTypes.includes(row.runType as typeof payrollRunTypes[number]) ||
      row.approvalStatus !== null && !payrollApprovalStatuses.includes(row.approvalStatus as typeof payrollApprovalStatuses[number])) throw invalid();
    if (row.journalEntryId !== null) id(row.journalEntryId);
    if (row.processedAt !== null && (typeof row.processedAt !== "string" || !Number.isFinite(Date.parse(row.processedAt)))) throw invalid();
    if (!Array.isArray(row.items)) throw invalid();
    for (const value of row.items) {
      const item = object(value); id(item.id); id(item.employeeId);
      for (const field of ["grossAmount", "taxAmount", "deductions", "netAmount"]) money(item, field);
      for (const field of ["preTaxDeductions", "postTaxDeductions"]) money(item, field, true);
      if (item.type !== null && !payrollItemTypes.includes(item.type as typeof payrollItemTypes[number])) throw invalid();
      nullableText(item.description); nullableText(item.currency);
      if (typeof item.rateExact !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item.rateExact) || !/[1-9]/.test(item.rateExact) ||
        item.fxRate !== null && (typeof item.fxRate !== "number" || !Number.isFinite(item.fxRate) || item.fxRate <= 0)) throw invalid();
      if (item.employee !== null) { const e = object(item.employee); text(e.name); text(e.employeeNumber); }
    }
  } else if (kind === "bonuses") {
    if (!Array.isArray(body.bonuses)) throw invalid();
    body.bonuses.forEach(bonus);
  } else if (kind === "bonus") bonus(body.bonus);
  else if (!Number.isSafeInteger(body.count) || (body.count as number) < 0) throw invalid();
  return body as unknown as Responses[K];
}
