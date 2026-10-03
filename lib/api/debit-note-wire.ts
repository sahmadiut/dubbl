import { z } from "zod";
import { creditCreateFields, creditMcpCreateFields, creditUpdateFields, creditMcpUpdateFields,
  creditAmountFields, creditListFields, creditTotals, creditNoteDto, creditRelations, creditBalances,
  creditListQuery, readCreditJson } from "./credit-wire";

const create = z.object(creditCreateFields).omit({ invoiceId: true }).shape;
const mcpCreate = z.object(creditMcpCreateFields).omit({ invoiceId: true }).shape;
const update = z.object(creditUpdateFields).omit({ invoiceId: true }).shape;
const mcpUpdate = z.object(creditMcpUpdateFields).omit({ invoiceId: true }).shape;
const contactId = create.contactId.describe("Organization-owned supplier contact UUID");
const billId = z.string().uuid().nullable().optional().describe("Optional original bill UUID; same supplier and currency");
const lineFields = {
  ...create.lines.element.shape,
  description: create.lines.element.shape.description.describe("Nonempty supplier debit-note line description"),
  unitPrice: create.lines.element.shape.unitPrice.describe("Legacy decimal major-unit price (USD dollars); omitted price is zero; aliases must agree"),
  accountId: create.lines.element.shape.accountId.describe("Optional organization-owned expense account UUID; nonzero expense posting requires an account"),
};
const lines = z.array(z.object(lineFields).strict()).min(1).max(1000).describe("1 through 1000 tax-exclusive debit-note lines; omitted prices are zero");
const mcpLines = z.array(z.object({ ...lineFields, unitPrice: mcpCreate.lines.element.shape.unitPrice }).strict())
  .min(1).max(1000).describe("Debit-note lines; numeric unitPrice is integer minor units (USD cents); omitted prices are zero");
export const debitNoteCreateFields = { ...create, contactId, billId, lines };
export const debitNoteMcpCreateFields = { ...mcpCreate, contactId, billId, lines: mcpLines };
export const debitNoteUpdateFields = { ...update, contactId: contactId.optional().describe("Optional replacement supplier UUID"), billId,
  lines: lines.optional().describe("Optional complete replacement debit-note lines; numeric prices in decimal major units") };
export const debitNoteMcpUpdateFields = { ...mcpUpdate, contactId: debitNoteUpdateFields.contactId, billId,
  lines: mcpLines.optional().describe("Optional complete replacement debit-note lines; numeric prices in integer minor units") };
export const debitNoteApplyFields = { billId: z.string().uuid().describe("Recognized outstanding same-supplier, same-currency bill UUID"), ...creditAmountFields };
export const debitNoteListFields = { ...creditListFields,
  status: z.enum(["draft", "sent", "applied", "void"]).optional().describe("Optional debit-note status"),
  contactId: contactId.optional().describe("Optional supplier contact UUID filter"),
  sortBy: z.enum(["date", "total", "number", "created"]).default("created").describe("Sort by issue date, total, debit-note number or creation time"),
};
export function debitNoteListQuery(url: URL) { return z.object(debitNoteListFields).strict().parse(creditListQuery(url)); }
export { creditTotals as debitNoteTotals, creditNoteDto as debitNoteDto, creditRelations as debitNoteRelations,
  creditBalances as debitNoteBalances, readCreditJson as readDebitNoteJson };
