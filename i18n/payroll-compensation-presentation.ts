import { payrollJson } from "@/lib/money/payroll-ui";

export const compensationStatuses = ["draft", "in_progress", "completed", "cancelled"] as const;
export interface CompensationBand {
  id: string; name: string; level: string | null; currency: string;
  minSalary: number; midSalary: number; maxSalary: number;
}
export interface CompensationReview {
  id: string; name: string; effectiveDate: string;
  status: typeof compensationStatuses[number]; totalBudget: number | null; currency: string;
  _count: { entries: number };
}
export interface CompensationReviewDetail extends CompensationReview {
  entries: { id: string; currentSalary: number; proposedSalary: number;
    adjustmentPercent: number | null; reason: string | null; approved: boolean | null;
    employee: { name: string; employeeNumber: string } | null }[];
  totals: { currentSalary: number; proposedSalary: number; difference: number };
}
interface Responses {
  bands: { data: CompensationBand[] }; reviews: { data: CompensationReview[]; currency: string };
  band: { band: CompensationBand }; review: { review: CompensationReview };
  detail: { review: CompensationReviewDetail };
}
const invalid = () => new Error("Invalid compensation response");
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown) { if (typeof v !== "string") throw invalid(); }
function id(v: unknown) { text(v); if (!(v as string).trim()) throw invalid(); }
function money(row: Record<string, unknown>, key: string, nullable = false) {
  // payrollJson checks exact aliases, safe cents, ranges and supported currencies.
  if (nullable && row[key] === null && row[key + "Minor"] === null) return;
  if (typeof row[key] !== "number" || typeof row[key + "Minor"] !== "string") throw invalid();
}
function date(v: unknown) {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\d$/.test(v) || v.startsWith("0000") || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw invalid();
}
function band(value: unknown) {
  const row = object(value); id(row.id); text(row.name); id(row.currency);
  if (row.level !== null) text(row.level);
  for (const key of ["minSalary", "midSalary", "maxSalary"]) money(row, key);
}
function review(value: unknown) {
  const row = object(value); id(row.id); text(row.name); id(row.currency); date(row.effectiveDate);
  if (!compensationStatuses.includes(row.status as typeof compensationStatuses[number])) throw invalid();
  money(row, "totalBudget", true);
  const count = object(row._count).entries;
  if (!Number.isSafeInteger(count) || (count as number) < 0 || Object.is(count, -0)) throw invalid();
  return row;
}
function unique(rows: unknown[], check: (v: unknown) => void) {
  const seen = new Set();
  for (const value of rows) {
    check(value); const key = object(value).id;
    if (seen.has(key)) throw invalid(); seen.add(key);
  }
}
/** Validate the displayed envelope before state adoption; diagnostics stay internal. */
export async function payrollCompensationJson<K extends keyof Responses>(response: Response, kind: K, reviewId?: string): Promise<Responses[K]> {
  if (!response.ok) throw invalid();
  const body = object(await payrollJson(response));
  if (kind === "bands" || kind === "reviews") {
    if (!Array.isArray(body.data)) throw invalid();
    unique(body.data, kind === "bands" ? band : review);
    if (kind === "reviews") id(body.currency);
  } else if (kind === "band") band(body.band);
  else {
    const row = review(body.review);
    if (reviewId !== undefined && row.id !== reviewId) throw invalid();
    if (kind === "detail") {
      if (!Array.isArray(row.entries)) throw invalid();
      unique(row.entries, value => {
        const entry = object(value); id(entry.id);
        money(entry, "currentSalary"); money(entry, "proposedSalary");
        if (entry.reason !== null) text(entry.reason);
        if (entry.approved !== null && typeof entry.approved !== "boolean") throw invalid();
        const percent = entry.adjustmentPercent;
        if (percent !== null && (typeof percent !== "number" || !Number.isFinite(percent) || percent < -100 || percent > 1000 || Math.fround(percent) !== percent)) throw invalid();
        if (entry.employee !== null) { const e = object(entry.employee); text(e.name); text(e.employeeNumber); }
      });
      const totals = object(row.totals);
      for (const key of ["currentSalary", "proposedSalary", "difference"]) money(totals, key);
      const current = row.entries.reduce<bigint>((sum, e) => sum + BigInt(object(e).currentSalary as number), 0n);
      const proposed = row.entries.reduce<bigint>((sum, e) => sum + BigInt(object(e).proposedSalary as number), 0n);
      if (BigInt(totals.currentSalary as number) !== current || BigInt(totals.proposedSalary as number) !== proposed || BigInt(totals.difference as number) !== proposed - current || object(row._count).entries !== row.entries.length) throw invalid();
    }
  }
  return body as unknown as Responses[K];
}
export function compensationOrganization() {
  try { return localStorage.getItem("activeOrgId") || null; } catch { return null; }
}
