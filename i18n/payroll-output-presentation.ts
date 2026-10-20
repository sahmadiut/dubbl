import { payrollJson } from "@/lib/money/payroll-ui";
import { payrollRunDetailJson, type PayrollRunDetail } from "./payroll-run-detail-presentation";

export const payslipStatuses = ["generated", "sent", "viewed"] as const;
export const taxStatuses = ["draft", "generated", "sent", "filed", "corrected"] as const;
export const taxFormTypes = ["1099_nec", "1099_misc", "w2"] as const;
export const w2Fields = ["box1_wages", "box2_federal_tax", "box3_ss_wages", "box4_ss_tax", "box5_medicare_wages", "box6_medicare_tax", "box12_retirement_deferrals", "box14_other", "box17_state_income_tax", "box19_local_income_tax"] as const;
export const taxMetadata = ["currency", "employee_email", "employee_number", "recipient_company", "recipient_email"] as const;
export interface PayrollPayslip {
  id: string; employeeId: string; payrollRunId: string; payrollItemId: string;
  currency: string; status: typeof payslipStatuses[number];
  grossAmount: number; netAmount: number; taxAmount: number;
  ytdGross: number; ytdNet: number; ytdTax: number;
  deductionsBreakdown: { name: string; category: "pre_tax" | "post_tax"; amount: number }[] | null;
}
export interface PayrollTaxForm {
  id: string; recipientName: string; recipientTaxId: string | null;
  recipientType: "employee" | "contractor"; formType: typeof taxFormTypes[number];
  taxYear: number; formData: Record<string, unknown>; status: typeof taxStatuses[number];
  generation?: { id: string; status: typeof taxStatuses[number] };
}
export interface PayrollTaxGeneration {
  id: string; taxYear: number; formType: typeof taxFormTypes[number];
  status: typeof taxStatuses[number]; generatedAt: string | null; createdAt: string;
  forms: PayrollTaxForm[];
}
type Responses = {
  run: { run: PayrollRunDetail }; payslips: { payslips: PayrollPayslip[] };
  payslip: { payslip: PayrollPayslip }; generations: { data: PayrollTaxGeneration[] };
  form: PayrollTaxForm;
  generated: { generation: Omit<PayrollTaxGeneration, "forms">; formsGenerated: number };
};
const invalid = () => new Error("Invalid payroll output response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function nullableText(v: unknown) { if (v !== null) text(v); }
function member(v: unknown, values: readonly string[]) { if (!values.includes(v as string)) throw invalid(); }
function money(row: Record<string, unknown>, key: string) {
  // payrollJson validates safe cents and matching canonical Minor aliases.
  if (typeof row[key] !== "number" || typeof row[key + "Minor"] !== "string") throw invalid();
}
function timestamp(v: unknown) {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw invalid();
}
function year(v: unknown) { if (!Number.isInteger(v) || (v as number) < 1900 || (v as number) > 2099) throw invalid(); }
function slip(value: unknown) {
  const row = object(value);
  for (const key of ["id", "employeeId", "payrollRunId", "payrollItemId", "currency"]) id(row[key]);
  member(row.status, payslipStatuses);
  for (const key of ["grossAmount", "netAmount", "taxAmount", "ytdGross", "ytdNet", "ytdTax"]) money(row, key);
  if (row.deductionsBreakdown !== null) {
    if (!Array.isArray(row.deductionsBreakdown)) throw invalid();
    for (const value of row.deductionsBreakdown) {
      const d = object(value); text(d.name); member(d.category, ["pre_tax", "post_tax"]); money(d, "amount");
    }
  }
}
function form(value: unknown) {
  const row = object(value); id(row.id); text(row.recipientName); nullableText(row.recipientTaxId);
  // The service rejects populated 1099-MISC payloads; empty historical batches remain readable.
  member(row.formType, ["1099_nec", "w2"]); member(row.status, taxStatuses); year(row.taxYear);
  member(row.recipientType, ["employee", "contractor"]);
  if ((row.formType === "w2") !== (row.recipientType === "employee")) throw invalid();
  const data = object(row.formData);
  if (data.currency !== "USD") throw invalid();
  const fields: readonly string[] = row.formType === "w2" ? w2Fields : ["box1_nonemployee_compensation"];
  const metadata: readonly string[] = row.formType === "w2" ? ["employee_email", "employee_number"] : ["recipient_company", "recipient_email"];
  const allowed = new Set([...fields, ...fields.map(k => k + "Minor"), ...metadata, "currency", ...(row.formType === "w2" ? ["box13_retirement_plan"] : [])]);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) throw invalid();
    if (fields.includes(key)) money(data, key);
    if (metadata.includes(key)) nullableText(data[key]);
    if (key === "box13_retirement_plan" && typeof data[key] !== "boolean") throw invalid();
  }
  if (row.generation !== undefined) {
    const generation = object(row.generation); id(generation.id); member(generation.status, taxStatuses);
  }
}
function generation(value: unknown, forms: boolean) {
  const row = object(value); id(row.id); year(row.taxYear); member(row.formType, taxFormTypes); member(row.status, taxStatuses);
  timestamp(row.createdAt); if (row.generatedAt !== null) timestamp(row.generatedAt);
  if (forms) {
    if (!Array.isArray(row.forms)) throw invalid();
    for (const value of row.forms) {
      form(value); const f = object(value);
      if (f.taxYear !== row.taxYear || f.formType !== row.formType) throw invalid();
    }
  }
}
export async function payrollOutputJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (kind === "run") return await payrollRunDetailJson(response, "detail") as Responses[K];
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if (kind === "payslips") {
    if (!Array.isArray(body.payslips)) throw invalid();
    body.payslips.forEach(slip);
  } else if (kind === "payslip") slip(body.payslip);
  else if (kind === "generations") {
    if (!Array.isArray(body.data)) throw invalid();
    body.data.forEach(v => generation(v, true));
  } else if (kind === "form") form(body);
  else if (kind === "generated") {
    generation(body.generation, false);
    if (!Number.isSafeInteger(body.formsGenerated) || (body.formsGenerated as number) < 0) throw invalid();
  }
  return body as unknown as Responses[K];
}

/** Storage can be unavailable; callers display the same finite localized error. */
export function payrollOutputOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
