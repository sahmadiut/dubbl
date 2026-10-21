import { payrollJson } from "@/lib/money/payroll-ui";
import { payrollCompensationJson, type CompensationBand } from "./payroll-compensation-presentation";

export type { CompensationBand };
export interface PayrollSettingsData {
  defaultTaxRate: number; overtimeThresholdHours: number; overtimeMultiplier: number;
  defaultCurrency: string; salaryExpenseAccountCode: string | null;
  taxPayableAccountCode: string | null; bankAccountCode: string | null; autoApprovalEnabled: boolean;
}
export interface DeductionType {
  id: string; name: string; description: string | null; category: string;
  defaultAmount: number | null; defaultPercent: number | null; isActive: boolean;
}
export interface TaxBracket {
  id: string; name: string; jurisdictionLevel: string; jurisdiction: string | null;
  minIncome: number; maxIncome: number | null; rate: number;
}
export interface ShiftDef {
  id: string; name: string; shiftType: string; startTime: string; endTime: string;
  premiumPercent: number | null; isActive: boolean;
}
export interface LeavePolicy {
  id: string; name: string; leaveType: string; accrualMethod: string;
  accrualRate: number; maxBalance: number | null; isActive: boolean;
}
export interface ApprovalChain {
  id: string; name: string; description: string | null; isActive: boolean;
  steps: { id: string; stepOrder: number; approverId: string }[];
}
interface Responses {
  settings: { settings: PayrollSettingsData }; deductions: { data: DeductionType[] };
  brackets: { data: TaxBracket[] }; shifts: { data: ShiftDef[] }; policies: { data: LeavePolicy[] };
  chains: { data: ApprovalChain[] }; bands: { data: CompensationBand[] };
  deduction: { deductionType: DeductionType }; bracket: { bracket: TaxBracket };
  shift: { shift: ShiftDef }; policy: { policy: LeavePolicy }; band: { band: CompensationBand };
  deleted: { success: true };
}
const labelKeys = {
  pre_tax: "preTax", post_tax: "postTax", federal: "federal", state: "state", local: "local",
  regular: "regular", overtime: "overtime", night: "night", weekend: "weekend", holiday: "holiday",
  vacation: "vacation", sick: "sick", personal: "personal", parental: "parental",
  bereavement: "bereavement", unpaid: "unpaid", other: "other", per_pay_period: "perPayPeriod",
  monthly: "monthly", annually: "annually", front_loaded: "frontLoaded",
} as const;
export function settingsLabelKey(value: string) {
  return Object.hasOwn(labelKeys, value) ? labelKeys[value as keyof typeof labelKeys] : "unknown";
}
const invalid = () => new Error("Invalid payroll settings response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function nullableText(v: unknown) { if (v !== null) text(v); }
function flag(v: unknown) { if (typeof v !== "boolean") throw invalid(); }
function quantity(v: unknown, max = Number.MAX_SAFE_INTEGER, min = 0) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || Object.is(v, -0) || Math.fround(v) !== v) throw invalid();
}
function bp(v: unknown) { quantity(v, 10000); if (!Number.isInteger(v)) throw invalid(); }
function money(r: Record<string, unknown>, key: string, nullable = false) {
  // payrollJson verifies safe integer cents, canonical aliases and equality.
  if (nullable && r[key] === null && r[key + "Minor"] === null) return;
  if (typeof r[key] !== "number" || typeof r[key + "Minor"] !== "string") throw invalid();
}
function row(value: unknown, kind: string) {
  const r = object(value); id(r.id); text(r.name);
  if (kind === "deductions") {
    nullableText(r.description); flag(r.isActive); text(r.category);
    money(r, "defaultAmount", true);
    if (r.defaultPercent !== null) quantity(r.defaultPercent, 100);
  } else if (kind === "brackets") {
    text(r.jurisdictionLevel); nullableText(r.jurisdiction); bp(r.rate);
    money(r, "minIncome"); money(r, "maxIncome", true);
    if (r.maxIncome !== null && (r.maxIncome as number) <= (r.minIncome as number)) throw invalid();
  } else if (kind === "shifts") {
    flag(r.isActive); text(r.shiftType);
    for (const k of ["startTime", "endTime"]) if (typeof r[k] !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r[k])) throw invalid();
    if (r.premiumPercent !== null) quantity(r.premiumPercent);
  } else if (kind === "policies") {
    flag(r.isActive); text(r.leaveType); text(r.accrualMethod); quantity(r.accrualRate);
    if (r.maxBalance !== null) quantity(r.maxBalance);
  } else {
    flag(r.isActive); nullableText(r.description);
    unique(r.steps, value => {
      const step = object(value); id(step.id); id(step.approverId);
      if (!Number.isSafeInteger(step.stepOrder) || (step.stepOrder as number) < 0) throw invalid();
    });
  }
}
function unique(value: unknown, check: (v: unknown) => void) {
  if (!Array.isArray(value)) throw invalid();
  const seen = new Set();
  for (const v of value) { check(v); const key = object(v).id; if (seen.has(key)) throw invalid(); seen.add(key); }
}
/** Check HTTP, JSON and displayed fields before adoption or success feedback. */
export async function payrollSettingsJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (kind === "bands" || kind === "band") {
    const body = await payrollCompensationJson(response, kind);
    if ("error" in body) throw invalid();
    return body as Responses[K];
  }
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if ("error" in body) throw invalid();
  if (kind === "settings") {
    const r = object(body.settings); bp(r.defaultTaxRate); quantity(r.overtimeThresholdHours, Infinity);
    quantity(r.overtimeMultiplier, Infinity, 1); id(r.defaultCurrency);
    for (const k of ["salaryExpenseAccountCode", "taxPayableAccountCode", "bankAccountCode"]) nullableText(r[k]);
    flag(r.autoApprovalEnabled);
  } else if (kind === "deleted") { if (body.success !== true) throw invalid(); }
  else if (["deductions", "brackets", "shifts", "policies", "chains"].includes(kind)) unique(body.data, v => row(v, kind));
  else {
    const [key, list] = { deduction: ["deductionType", "deductions"], bracket: ["bracket", "brackets"], shift: ["shift", "shifts"], policy: ["policy", "policies"] }[kind as "deduction" | "bracket" | "shift" | "policy"];
    row(body[key], list);
  }
  return body as unknown as Responses[K];
}
export function settingsOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
