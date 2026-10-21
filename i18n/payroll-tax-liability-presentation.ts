import { payrollJson } from "@/lib/money/payroll-ui";

export interface TaxPayment {
  id: string; periodStart: string; periodEnd: string;
  jurisdictionLevel: "federal" | "state" | "local";
  jurisdiction: string | null; taxKind: string | null;
  amount: number; currency: string; reference: string | null;
  notes: string | null; status: "pending" | "paid" | "void";
  paidAt: string | null; createdAt: string;
}
interface Responses {
  list: { payments: TaxPayment[] };
  created: { payment: TaxPayment; journalEntryId: string };
}
const invalid = () => new Error("Invalid payroll tax payment response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function date(v: unknown) {
  if (typeof v !== "string" || !/^(?!0000)\d{4}-\d\d-\d\d$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw invalid();
}
function instant(v: unknown) {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw invalid();
  date(v.slice(0, 10));
}
function payment(value: unknown) {
  const row = object(value); id(row.id); id(row.currency);
  date(row.periodStart); date(row.periodEnd);
  if ((row.periodEnd as string) < (row.periodStart as string)) throw invalid();
  if (!["federal", "state", "local"].includes(row.jurisdictionLevel as string) || !["pending", "paid", "void"].includes(row.status as string)) throw invalid();
  for (const key of ["jurisdiction", "taxKind", "reference", "notes"]) if (row[key] !== null) text(row[key]);
  // payrollJson checks canonical, agreeing aliases and the safe integer bridge.
  if (typeof row.amount !== "number" || row.amount <= 0 || typeof row.amountMinor !== "string") throw invalid();
  if (row.paidAt !== null) instant(row.paidAt);
  instant(row.createdAt);
  return row;
}
/** Check the entire envelope before adopting data or announcing success. */
export async function payrollTaxPaymentJson<K extends keyof Responses>(response: Response, kind: K): Promise<Responses[K]> {
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if ("error" in body) throw invalid();
  if (kind === "list") {
    if (!Array.isArray(body.payments)) throw invalid();
    const seen = new Set();
    for (const value of body.payments) {
      const row = payment(value);
      if (seen.has(row.id)) throw invalid(); seen.add(row.id);
    }
  } else {
    const row = payment(body.payment); id(body.journalEntryId);
    if (row.status !== "paid" || row.journalEntryId !== body.journalEntryId) throw invalid();
  }
  return body as unknown as Responses[K];
}
export function taxPaymentOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
