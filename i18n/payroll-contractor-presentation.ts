import { payrollJson } from "@/lib/money/payroll-ui";

export interface Contractor {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  hourlyRate: number | null;
  currency: string | null;
  isActive: boolean;
  createdAt?: string;
}
export interface ContractorPayment {
  id: string;
  amount: number;
  currency: string | null;
  description: string | null;
  invoiceNumber: string | null;
  status: "pending" | "paid" | "void";
  paidAt: string | null;
}
export interface ContractorDetail extends Contractor {
  taxId: string | null;
  bankAccountNumber: string | null;
  payments: ContractorPayment[];
}
type Responses = {
  list: { data: Contractor[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
  detail: { contractor: ContractorDetail };
  saved: { contractor: Contractor };
  created: { contractor: { id: string } };
  payment: { payment: ContractorPayment };
  deleted: { success: true };
};
const invalid = () => new Error("Invalid contractor response");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown) { if (typeof value !== "string") throw invalid(); }
function id(value: unknown) { text(value); if (!(value as string).trim()) throw invalid(); }
function nullableText(value: unknown) { if (value !== null) text(value); }
function money(row: Record<string, unknown>, field: string, nullable = false) {
  // payrollJson checks the safe integer, sign, currency and canonical alias agreement.
  if (nullable && row[field] === null && row[field + "Minor"] === null) return;
  if (typeof row[field] !== "number" || typeof row[field + "Minor"] !== "string") throw invalid();
}
function contractor(value: unknown) {
  const row = object(value); id(row.id); text(row.name);
  for (const key of ["email", "company", "currency"]) nullableText(row[key]);
  if (typeof row.isActive !== "boolean") throw invalid();
  if (row.createdAt !== undefined) text(row.createdAt);
  money(row, "hourlyRate", true);
  return row;
}
function payment(value: unknown) {
  const row = object(value); id(row.id); money(row, "amount");
  if ((row.amount as number) <= 0 || !["pending", "paid", "void"].includes(row.status as string)) throw invalid();
  for (const key of ["currency", "description", "invoiceNumber", "paidAt"]) nullableText(row[key]);
}

/** Check success envelopes and displayed fields before UI state adoption. */
export async function payrollContractorJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw new Error("Contractor request failed");
  const body = object(await payrollJson(response));
  if (kind === "list") {
    if (!Array.isArray(body.data)) throw invalid();
    body.data.forEach(contractor);
    const p = object(body.pagination);
    for (const key of ["total", "page", "limit", "totalPages"]) {
      if (!Number.isSafeInteger(p[key]) || (p[key] as number) < 0) throw invalid();
    }
    if ((p.page as number) < 1 || (p.limit as number) < 1 || (p.limit as number) > 100 ||
      p.totalPages !== Math.ceil((p.total as number) / (p.limit as number)) || body.data.length > (p.limit as number)) throw invalid();
  } else if (kind === "created") {
    id(object(body.contractor).id);
  } else if (kind === "detail" || kind === "saved") {
    const c = contractor(body.contractor);
    if (kind === "detail") {
      nullableText(c.taxId); nullableText(c.bankAccountNumber);
      if (!Array.isArray(c.payments)) throw invalid();
      c.payments.forEach(payment);
    }
  } else if (kind === "payment") payment(body.payment);
  else if (body.success !== true) throw invalid();
  return body as unknown as Responses[K];
}
