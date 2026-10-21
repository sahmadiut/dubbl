import { projectCrmJson } from "@/lib/money/project-crm-ui";
import { dateOnlyToDate } from "./dates";

export interface MilestoneAssignment {
  id: string; amount: number; description: string | null; isPaid: boolean;
  member?: { user?: { name: string | null; email: string | null } } | null;
}
export interface MilestoneBilling {
  billingType: string;
  milestones?: { id: string; title: string; amount: number; invoicedAmountCents: number; remaining: number }[];
  timeEntries?: { id: string; date: string; description: string | null; minutes: number; hourlyRate: number; amount: number }[];
  fixedPrice?: number; totalInvoiced?: number; remaining?: number; invoicedPercent?: number;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid milestone response");
  return value as Record<string, unknown>;
}
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
async function read(response: Response) {
  if (!response.ok) throw new Error("Milestone operation failed");
  return record(await projectCrmJson(response));
}

/** Validate adopted joins without exposing diagnostics or changing stored cents. */
export async function milestoneAssignmentsJson(response: Response) {
  const body = await read(response);
  if (!Array.isArray(body.assignments)) throw new Error("Invalid milestone assignments");
  for (const value of body.assignments) {
    const row = record(value);
    if (!text(row.id) || !Number.isSafeInteger(row.amount) || typeof row.isPaid !== "boolean" || (row.description !== null && typeof row.description !== "string")) throw new Error("Invalid milestone assignment");
    if (row.member != null) {
      const user = record(record(row.member).user);
      for (const key of ["name", "email"]) if (user[key] !== null && typeof user[key] !== "string") throw new Error("Invalid milestone member");
    }
  }
  return body as typeof body & { assignments: MilestoneAssignment[] };
}

export async function projectMilestoneJson(response: Response, kind: "milestone" | "assignment" | "delete" = "milestone", expectedId?: string) {
  const body = await read(response);
  if (kind === "delete") {
    if (body.success !== true) throw new Error("Invalid milestone deletion");
  } else {
    const row = record(body[kind]);
    if (!text(row.id) || (expectedId && row.id !== expectedId)) throw new Error("Invalid milestone acknowledgement");
  }
  return body;
}

export async function milestoneBillingJson(response: Response, billingType: string, currency: string) {
  const body = await read(response);
  if (body.billingType !== billingType || body.currency !== currency) throw new Error("Invalid milestone billing identity");
  if (billingType === "milestone" || billingType === "hourly") {
    const values = body[billingType === "milestone" ? "milestones" : "timeEntries"];
    if (!Array.isArray(values)) throw new Error("Invalid milestone billing rows");
    for (const value of values) {
      const row = record(value);
      if (!text(row.id)) throw new Error("Invalid billing identity");
      if (billingType === "milestone") {
        if (typeof row.title !== "string" || ![row.amount, row.invoicedAmountCents, row.remaining].every(Number.isSafeInteger)) throw new Error("Invalid billing milestone");
      } else if (typeof row.date !== "string" || !dateOnlyToDate(row.date) || (row.description !== null && typeof row.description !== "string") || !Number.isInteger(row.minutes) || (row.minutes as number) < 0 || (row.minutes as number) > 2147483647 || ![row.hourlyRate, row.amount].every(Number.isSafeInteger)) throw new Error("Invalid billing time");
    }
  } else if (billingType !== "fixed" || ![body.fixedPrice, body.totalInvoiced, body.remaining].every(Number.isSafeInteger) || typeof body.invoicedPercent !== "number" || !Number.isFinite(body.invoicedPercent) || body.invoicedPercent < 0 || body.invoicedPercent > 100) throw new Error("Invalid fixed billing");
  return body as typeof body & MilestoneBilling;
}

export async function milestoneInvoiceJson(response: Response) {
  const body = await read(response), invoice = record(body.invoice);
  if (!text(invoice.id) || !text(invoice.invoiceNumber)) throw new Error("Invalid milestone invoice");
  return body as typeof body & { invoice: { id: string; invoiceNumber: string } };
}
