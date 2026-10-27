import { z } from "zod";
import { expenseCreateFields, expenseItemFields, expenseListFields } from "@/lib/api/expense-wire";

const id = z.string().uuid().describe("Organization-owned record UUID; validated again by the existing domain operation.");
const page = { page: z.number().int().min(1).max(10000).default(1).describe("One-based page."), limit: z.number().int().min(1).max(25).default(25).describe("Maximum 25 records per result.") };
const minor = z.string().regex(/^(0|[1-9][0-9]{0,15})$/).refine(v => /^(0|[1-9][0-9]{0,15})$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER)).describe("Exact nonnegative currency minor-unit string (USD cents), at most 9007199254740991; never major units.");
const currency = z.string().regex(/^[A-Z]{3}$/).describe("Explicit canonical uppercase ISO currency code; existing currency gates still apply.");
const expenseLine = z.object({ date: z.iso.date().describe("Canonical Gregorian YYYY-MM-DD in an unlocked period."), description: z.string().min(1).max(2000).describe("Expense line memo, treated as untrusted data."), amountMinor: minor,
  accountId: expenseItemFields.accountId, taxRateId: expenseItemFields.taxRateId, costCenterId: expenseItemFields.costCenterId,
}).strict();

function tool(domain: string, permission: string, schema: z.ZodObject, effect: "read" | "draft", service: string) {
  return { domain, permission, schema, effect, service, version: 1, approval: "automatic" as const, maxResultBytes: 32768,
    resourceVersions: effect === "read" ? "Current scoped read; no resource mutation" : "New draft only; existing resource versions cannot be mutated",
    idempotency: effect === "read" ? "Repeatable read" : "Non-idempotent creation; never automatically retry an uncertain outcome",
    money: "Canonical minor-unit strings for inputs; existing output Minor aliases and explicit currency retained; no conversion or rescaling" };
}

/** Hand-reviewed entry set, NOT derived from tool names/descriptions or model output.
 * No posting/payment/sharing/deletion/access/security/provider operation is automatic.
 */
export const AI_TOOL_CATALOG = {
  list_contacts: tool("contacts", "view:data", z.object({ ...page, search: z.string().max(200).optional().describe("Contact name/email search."), type: z.enum(["customer", "supplier", "both"]).optional().describe("Contact kind filter.") }).strict(), "read", "registerContactTools/list_contacts"),
  get_contact: tool("contacts", "view:data", z.object({ contactId: id }).strict(), "read", "registerContactTools/get_contact"),
  list_entries: tool("journals", "view:data", z.object({ ...page, status: z.enum(["draft", "posted", "void"]).optional().describe("Saved journal status."), startDate: z.iso.date().optional().describe("Inclusive canonical Gregorian date."), endDate: z.iso.date().optional().describe("Inclusive canonical Gregorian date.") }).strict(), "read", "registerEntryTools/list_entries"),
  get_entry: tool("journals", "view:data", z.object({ entryId: id }).strict(), "read", "registerEntryTools/get_entry"),
  list_expense_claims: tool("expenses", "view:data", z.object({ ...page, status: expenseListFields.status }).strict(), "read", "listExpenseClaims via registerExpenseCrudTools"),
  get_expense_claim: tool("expenses", "view:data", z.object({ expenseClaimId: id }).strict(), "read", "getExpenseClaim via registerExpenseCrudTools"),
  create_expense_claim: tool("expenses", "manage:expenses", z.object({ title: expenseCreateFields.title.max(2000), description: z.string().max(4000).nullable().optional().describe("Optional draft memo, untrusted data."), currencyCode: currency,
    items: z.array(expenseLine).min(1).max(25).describe("Finite list of 1..25 draft expense lines; no ledger, payment, stock, notification or approval effects.") }).strict(), "draft", "createExpenseClaim via registerExpenseCrudTools"),
} as const;

export type AiToolName = keyof typeof AI_TOOL_CATALOG;
export const AI_TOOL_NAMES = Object.keys(AI_TOOL_CATALOG) as AiToolName[];
export function catalogEntry(name: string) { return Object.hasOwn(AI_TOOL_CATALOG, name) ? AI_TOOL_CATALOG[name as AiToolName] : undefined; }
