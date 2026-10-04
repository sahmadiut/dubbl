import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankMatchId, bankMatchPaymentFields, bankDocumentMatchFields, bankDocumentSplitFields } from "@/lib/api/bank-document-match-wire";
import { matchBankDocument, splitBankDocuments, getBankInvoiceMatches } from "@/lib/api/bank-document-matches";

export function registerBankDocumentMatchTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("match_to_invoice", {
    description: "Settle an incoming statement line against a recognized outstanding invoice. amount (integer currency minor units, USD cents) and/or canonical amountMinor must cover the full bank line, in the same currency. Posts saved settlement FX/carrying value atomically with payment, allocation, document, bank links and audit. Returns transactionId, payment with numeric/exact minor amounts and invoiceStatus. Repeats fail. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId, invoiceId: bankDocumentMatchFields.invoiceId.unwrap().describe("Organization-owned invoiceId UUID"), ...bankMatchPaymentFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await matchBankDocument(ctx, transactionId, input) })));
  server.registerTool("match_to_bill", {
    description: "Settle an outgoing statement line against a recognized outstanding bill. amount (integer currency minor units, USD cents) and/or amountMinor must cover the full bank line, in the same currency. Uses outstanding payable including reverse-charge/noncash history and saved carrying FX. Returns transactionId, payment with numeric/exact minor amounts and billStatus. All writes/audit are atomic; repeats fail. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId, billId: bankDocumentMatchFields.billId.unwrap().describe("Organization-owned billId UUID"), ...bankMatchPaymentFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await matchBankDocument(ctx, transactionId, input) })));
  server.registerTool("match_to_existing_payment", {
    description: "Link an unlinked posted cash payment on the same bank/currency with exactly equal amount and direction. Amounts remain saved integer currency minor units (USD cents); no money/date overrides and no new GL posting. Noncash credit/debit/prepayment carriers fail. Returns transactionId, paymentId and saved journalEntryId; atomically saves links/audit. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId, paymentId: bankDocumentMatchFields.paymentId.unwrap().describe("Organization-owned paymentId UUID") }).strict(),
  }, ({ transactionId, paymentId }) => wrapTool(ctx, async () => {
    const result = await matchBankDocument(ctx, transactionId, { paymentId });
    const links = result as { paymentId: string; journalEntryId: string };
    return { transactionId, paymentId: links.paymentId, journalEntryId: links.journalEntryId };
  }));
  server.registerTool("match_to_existing_journal", {
    description: "Link a posted unreversed journal with an exactly matching base-currency bank GL net amount/direction. Saved amounts are integer currency minor units (USD cents); no money/date override or new posting. Foreign-currency direct journal, payment-owned, noncash and transfer journals fail; use their owning workflow. Returns transactionId, matchType, journalEntryId. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId, journalEntryId: bankDocumentMatchFields.journalEntryId.unwrap().describe("Organization-owned journalEntryId UUID") }).strict(),
  }, ({ transactionId, journalEntryId }) => wrapTool(ctx, async () => ({ transactionId, ...await matchBankDocument(ctx, transactionId, { journalEntryId }) })));
  server.registerTool("split_to_documents", {
    description: "Settle a complete incoming/outgoing bank line across 1..1000 distinct recognized invoices/bills of the same contact/currency. Positive allocation amount (integer currency minor units, USD cents) and/or amountMinor must equal the full bank magnitude; overpayments and residual cash fail. One atomic payment, saved FX/carrying journal, allocations, document updates, links and audit. Returns transactionId, payment and allocations with amount/amountMinor/newStatus. Repeats fail. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId, ...bankDocumentSplitFields }).strict(),
  }, ({ transactionId, ...input }) => wrapTool(ctx, async () => ({ transactionId, ...await splitBankDocuments(ctx, transactionId, input) })));
  server.registerTool("get_bank_invoice_matches", {
    description: "Read incoming statement invoice suggestions and up to 50 same-currency open invoices. Returns transaction, suggestedMatches and openInvoices with numeric currency minor-unit money (USD cents) and exact *Minor aliases; outgoing lines return empty lists. Requires manage:banking.",
    inputSchema: z.object({ transactionId: bankMatchId }).strict(),
  }, ({ transactionId }) => wrapTool(ctx, () => getBankInvoiceMatches(ctx, transactionId)));
}
