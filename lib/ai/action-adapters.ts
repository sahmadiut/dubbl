import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { requireRole } from "@/lib/api/require-role";
import { preflightSettlement } from "@/lib/api/payment-settlements";
import { paymentPaySchema } from "@/lib/api/payment-settlement-wire";
import { PeriodLockedError } from "@/lib/api/period-lock";
import { readDocumentForRendering } from "@/lib/documents/render-service";
import { WireCompatibilityError } from "@/lib/money/wire";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { checkEmailLimit, LimitExceededError } from "@/lib/api/check-limit";
import { outputDocumentKind, outputTranslator } from "@/i18n/output";
import { journalPostPreviewSchema, previewJournalPost, previewJournalDelete, JOURNAL_POST_ADAPTER_VERSION } from "./action-preview";
import { previewBusinessPolicy, PreviewPolicyError } from "./business-policy-preview";

const id = z.string().uuid().describe("Existing organization-owned resource UUID.");
const expected = journalPostPreviewSchema.shape.expectedResourceVersion;
export const settlementArgumentsSchema = z.object({
  documentType: z.enum(["invoice", "bill"]).describe("invoice records received cash; bill records made cash. No transfer, prepayment, refund, batch or provider action."),
  documentId: id,
  amountMinor: z.string().max(16).regex(/^[1-9][0-9]*$/).refine(v => v.length <= 16 && /^[1-9][0-9]*$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER)).describe("Positive exact document-currency minor integer string within the shared settlement safe-number ceiling. USD cents; IRR rials. No currency conversion of this input."),
  date: paymentPaySchema.shape.date,
  method: paymentPaySchema.shape.method,
  bankAccountId: id.optional().describe("Existing active scoped bank UUID in document currency with a saved ledger link. Omit to use existing GL 1100; preview never creates accounts."),
  reference: z.string().max(2000).optional().describe("Optional external reference displayed exactly; no idempotency or approval authority."),
}).strict();
export const settlementPreviewSchema = settlementArgumentsSchema.extend({ expectedResourceVersion: expected }).strict();
export const emailArgumentsSchema = z.object({
  documentId: id.describe("Existing invoice UUID. Recipient, number, dates, currency and amount derive from the saved document and contact; no overrides, links, attachments or custom message."),
}).strict();
export const emailActionPreviewSchema = emailArgumentsSchema.extend({ expectedResourceVersion: expected }).strict();

const itemFields = {
  itemId: id.describe("Stable proposal item UUID, unique within the batch."),
  dependsOn: z.array(id).max(9).describe("Exact prerequisite item UUIDs. Duplicates, missing/self references and cycles are rejected; selection requires dependency closure."),
};
export const actionItemSchema = z.discriminatedUnion("action", [
  z.object({ ...itemFields, action: z.literal("post_entry").describe("Observe manual journal posting; never execute."), arguments: journalPostPreviewSchema.omit({ expectedResourceVersion: true }).describe("Exact journal posting arguments.") }).strict(),
  z.object({ ...itemFields, action: z.literal("delete_draft_journal").describe("Observe permanent deletion of a qualified unlinked manual draft and its lines."), arguments: journalPostPreviewSchema.omit({ expectedResourceVersion: true }).describe("Exact draft deletion arguments.") }).strict(),
  z.object({ ...itemFields, action: z.literal("settle_document").describe("Observe one invoice/bill cash settlement with qualified saved recognition and existing ledger accounts."), arguments: settlementArgumentsSchema.describe("Full exact cash-settlement arguments.") }).strict(),
  z.object({ ...itemFields, action: z.literal("email_invoice").describe("Observe one invoice email to its saved contact, with no attachment, overrides or custom message."), arguments: emailArgumentsSchema.describe("Exact derived-content invoice-email arguments.") }).strict(),
]);
export type ActionItem = z.infer<typeof actionItemSchema>;
export function adapterVersion(action: ActionItem["action"]) { return action === "post_entry" || action === "delete_draft_journal" ? JOURNAL_POST_ADAPTER_VERSION : 1; }
export function actionPermissions(action: ActionItem["action"]) { return ["view:data", action === "post_entry" ? "post:entries" : action === "delete_draft_journal" ? "edit:entries" : action === "settle_document" ? "manage:payments" : "manage:invoices"]; }
// One resource may appear only once, even across action variants. Effects on a
// common invoice/journal require a fresh later observation, not speculative state.
export function actionResource(item: ActionItem) {
  return "entryId" in item.arguments ? `journal:${item.arguments.entryId.toLowerCase()}` : `${"documentType" in item.arguments ? item.arguments.documentType : "invoice"}:${item.arguments.documentId.toLowerCase()}`;
}
function unavailable(code: string) { return { code, preview: null, recovery: code === "PREVIEW_DENIED" || code === "PREVIEW_POLICY_INVALID" ? ["contact_administrator"] : code === "PREVIEW_STALE" ? ["refresh_preview"] : ["inspect_record"] }; }
function invalid(): never { throw new WireCompatibilityError("Unsupported preview record"); }
const encode = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? String(item) : item);
function bounded(value: unknown) { if (Buffer.byteLength(encode(value), "utf8") > 32768) throw new PreviewPolicyError("PREVIEW_TOO_LARGE"); }
const hash = (value: unknown) => createHash("sha256").update(encode(value)).digest("hex");
async function actor(ctx: AuthContext, action: ActionItem["action"]) {
  const current = await authorizeExecution(executionIdentity(ctx), ctx.organizationId, "use:ai");
  for (const permission of actionPermissions(action)) requireRole(current, permission);
  return current;
}
async function observe<T>(ctx: AuthContext, action: ActionItem["action"], read: (ctx: AuthContext) => Promise<T>) {
  let result;
  try { result = await read(await actor(ctx, action)); }
  catch (err) {
    if (err instanceof AuthError) result = unavailable(err.status === 403 || err.status === 401 ? "PREVIEW_DENIED" : err.status === 404 ? "PREVIEW_NOT_FOUND" : "PREVIEW_INVALID_RECORD");
    else if (err instanceof LimitExceededError) result = unavailable("PREVIEW_LIMIT_REACHED");
    else if (err instanceof PreviewPolicyError) result = unavailable(err.code);
    else if (err instanceof PeriodLockedError) result = unavailable("PREVIEW_PERIOD_LOCKED");
    else if (err instanceof WireCompatibilityError || err instanceof z.ZodError || err instanceof RangeError || err instanceof MissingExchangeRateError) result = unavailable("PREVIEW_INVALID_RECORD");
    else throw err;
  }
  // Revoke disclosure after every asynchronous path, including invalid records.
  try { await actor(ctx, action); } catch (err) { if (err instanceof AuthError) return unavailable("PREVIEW_DENIED"); throw err; }
  return result;
}
const window = () => { const observedAt = new Date(); return { observedAt: observedAt.toISOString(), expiresAt: new Date(observedAt.getTime() + 300000).toISOString() }; };
type Amount = { currencyCode: string; debitAmountMinor: string; creditAmountMinor: string };

export async function previewSettlement(ctx: AuthContext, input: unknown) {
  const { expectedResourceVersion, ...args } = settlementPreviewSchema.parse(input);
  return observe(ctx, "settle_document", current => db.transaction(async tx => {
    const [org] = await tx.select().from(organization).where(and(eq(organization.id, current.organizationId), isNull(organization.deletedAt)));
    if (!org) throw new AuthError("Organization not found", 404);
    const base = currencyCodeSchema.parse(org.defaultCurrency ?? "USD"), amount = Number(args.amountMinor);
    const value = await preflightSettlement(tx, current, { ...args, amount, type: args.documentType === "invoice" ? "received" : "made", allocations: [{ documentType: args.documentType, documentId: args.documentId, amount }] }, base, true);
    const doc = value.docs[0].row;
    const businessApproval = await previewBusinessPolicy(tx, current, args.documentType, doc);
    bounded(value);
    const resourceVersion = hash({ adapter: 1, actor: current.userId, organizationId: current.organizationId, base, args, value, businessApproval });
    if (expectedResourceVersion && resourceVersion !== expectedResourceVersion) return unavailable("PREVIEW_STALE");
    const received = args.documentType === "invoice";
    const leg = (account: typeof value.control, debit: bigint, credit: bigint) => ({ account: { id: account.id, code: account.code, name: account.name }, currencyCode: base, debitAmountMinor: String(debit), creditAmountMinor: String(credit) });
    const lines = [leg(value.cashAccount, received ? BigInt(value.cash) : 0n, received ? 0n : BigInt(value.cash)), leg(value.control, received ? 0n : BigInt(value.carrying), received ? BigInt(value.carrying) : 0n),
      ...(value.fxAccount ? [leg(value.fxAccount, value.gain < 0n ? BigInt(value.difference) : 0n, value.gain > 0n ? BigInt(value.difference) : 0n)] : [])];
    const total = lines.reduce((sum, line) => sum + BigInt(line.debitAmountMinor), 0n);
    const preview = { schemaVersion: 1, action: "settle_document" as const, labelKey: received ? "receive_invoice_payment" : "make_bill_payment", ...window(), resourceVersion,
      target: { type: args.documentType, id: doc.id, reference: "invoiceNumber" in doc ? doc.invoiceNumber : doc.billNumber, href: `/${received ? "invoices" : "bills"}/${doc.id}` },
      before: { status: doc.status, amountPaidMinor: String(doc.amountPaid), amountDueMinor: String(doc.amountDue), currencyCode: doc.currencyCode },
      after: { status: amount === doc.amountDue ? "paid" : "partial", amountPaidMinor: String(BigInt(doc.amountPaid) + BigInt(amount)), amountDueMinor: String(BigInt(doc.amountDue) - BigInt(amount)), currencyCode: doc.currencyCode },
      date: args.date, issueDate: doc.issueDate, reference: args.reference ?? null, method: args.method, bankAccountId: args.bankAccountId ?? null,
      payment: { amountMinor: args.amountMinor, currencyCode: doc.currencyCode, direction: received ? "received" : "made" },
      fx: { ...value.fx, direction: "quote_per_base", sourceCurrencyCode: doc.currencyCode, targetCurrencyCode: base, recognitionRateExact: value.docs[0].rateExact, cashBaseMinor: String(value.cash), carryingBaseMinor: String(value.carrying), gainBaseMinor: String(value.gain) },
      lines, amounts: [{ currencyCode: base, debitAmountMinor: String(total), creditAmountMinor: String(total) }] as Amount[], recipients: [],
      effects: ["records_cash_settlement", "creates_payment_and_allocation", "posts_balanced_settlement_journal", "changes_document_outstanding_balance", "posted_history_requires_reversal"],
      businessApproval, authority: "preview_only", canApprove: false, recovery: ["inspect_record", "refresh_preview"] };
    bounded(preview); return { code: "PREVIEW_ONLY", preview, recovery: ["inspect_record", "refresh_preview"] };
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));
}

export async function previewInvoiceEmail(ctx: AuthContext, input: unknown) {
  const { expectedResourceVersion, ...args } = emailActionPreviewSchema.parse(input);
  return observe(ctx, "email_invoice", current => db.transaction(async tx => {
    const value = await readDocumentForRendering(current, "invoice", args.documentId, undefined, tx);
    const doc = value.document, found = value.snapshot.found;
    if (!("invoiceNumber" in found) || !["sent", "partial", "paid", "overdue"].includes(found.status)) return unavailable("PREVIEW_UNSUPPORTED");
    const email = doc.contactEmail;
    // Only a single plain saved mailbox; reject header injection, lists, display
    // addresses and saved/live disagreement. No model-controlled recipient.
    if (!email || !z.string().email().max(254).safeParse(email).success || /[\s,;<>\x00-\x1f\x7f]/.test(email) || email !== found.contact.email) invalid();
    if (value.snapshot.org.contactEmail && (!z.string().email().max(254).safeParse(value.snapshot.org.contactEmail).success || /[\s,;<>\x00-\x1f\x7f]/.test(value.snapshot.org.contactEmail))) invalid();
    const emailLimit = await checkEmailLimit(current.organizationId, tx);
    const businessApproval = await previewBusinessPolicy(tx, current, "invoice", found);
    bounded(value);
    const subject = outputTranslator()(`${outputDocumentKind("invoice")}Preview`, { documentNumber: doc.documentNumber, organizationName: value.snapshot.org.name });
    if (subject.length > 2000 || /[\x00-\x1f\x7f]/.test(subject)) invalid();
    const content = { organizationName: value.snapshot.org.name, contactName: doc.contactName, documentType: "invoice", documentNumber: doc.documentNumber,
      amountMinor: doc.totalMinor, currencyCode: doc.currencyCode, issueDate: doc.issueDate, dueDate: doc.secondDate, personalMessage: null, attachPdf: false, viewUrl: null };
    const resourceVersion = hash({ adapter: 1, actor: current.userId, organizationId: current.organizationId, args, value, businessApproval, emailLimit, subject, content });
    if (expectedResourceVersion && resourceVersion !== expectedResourceVersion) return unavailable("PREVIEW_STALE");
    const preview = { schemaVersion: 1, action: "email_invoice" as const, labelKey: "email_invoice", ...window(), resourceVersion,
      target: { type: "invoice", id: found.id, reference: doc.documentNumber, href: `/invoices/${found.id}` },
      before: { status: found.status, delivery: "not_requested" }, after: { status: found.status, delivery: "attempt_one_email" },
      date: doc.issueDate, dueDate: doc.secondDate, recipients: [{ email, name: doc.contactName }], replyTo: value.snapshot.org.contactEmail,
      subject, content, documentAmounts: { totalMinor: doc.totalMinor, amountPaidMinor: doc.amountPaidMinor, amountDueMinor: doc.amountDueMinor, currencyCode: doc.currencyCode }, amounts: [] as Amount[],
      effects: ["discloses_invoice_summary_to_saved_contact", "external_delivery_cannot_be_recalled", "records_delivery_attempt", "does_not_change_invoice_status"],
      businessApproval, authority: "preview_only", canApprove: false, recovery: ["inspect_record", "refresh_preview"] };
    bounded(preview); return { code: "PREVIEW_ONLY", preview, recovery: ["inspect_record", "refresh_preview"] };
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));
}

export function observeAction(ctx: AuthContext, item: ActionItem, expectedResourceVersion?: string) {
  const args = { ...item.arguments, ...(expectedResourceVersion ? { expectedResourceVersion } : {}) };
  switch (item.action) {
    case "post_entry": return previewJournalPost(ctx, args);
    case "delete_draft_journal": return previewJournalDelete(ctx, args);
    case "settle_document": return previewSettlement(ctx, args);
    case "email_invoice": return previewInvoiceEmail(ctx, args);
  }
}
