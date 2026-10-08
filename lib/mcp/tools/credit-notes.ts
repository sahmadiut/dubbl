import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { creditListFields, creditMcpCreateFields, creditMcpUpdateFields, creditApplyFields } from "@/lib/api/credit-wire";
import { listCredits, getCreditNote, createCreditNote, updateCreditNote, deleteCreditNote, sendCreditNote, applyCredit, voidCreditNote, creditNoteSummary } from "@/lib/api/credits";

export function registerCreditNoteTools(server: McpServer, ctx: AuthContext) {
  const id = { creditNoteId: z.string().uuid().describe("Organization-owned credit-note UUID") };
  server.registerTool("list_credit_notes", {
    description: "List customer credit notes. Returns creditNotes, total, page and limit; numeric money in currency minor units (USD cents) plus *Minor strings.",
    inputSchema: z.strictObject(creditListFields),
  }, params => wrapTool(ctx, async () => { const result = await listCredits(ctx, params); return { creditNotes: result.rows, total: result.total, page: params.page, limit: params.limit }; }));
  server.registerTool("get_credit_note", {
    description: "Get a credit note with contact and lines. Numeric money in minor units plus *Minor strings; quantities are stored hundredths and discounts basis points.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, () => getCreditNote(ctx, params.creditNoteId)));
  server.registerTool("create_credit_note", {
    description: "Create a draft credit note. Numeric unitPrice is integer minor units (USD cents); unitPriceMinor is an exact minor string and unitPriceExact decimal major units. Returns creditNote with numeric amounts and *Minor strings.",
    inputSchema: z.strictObject(creditMcpCreateFields),
  }, params => wrapTool(ctx, () => createCreditNote(ctx, params, "mcp")));
  server.registerTool("update_credit_note", {
    description: "Edit a draft credit note, optionally replacing all lines. Numeric prices are minor units; exact aliases must agree. Returns creditNote with numeric money and *Minor strings.",
    inputSchema: z.strictObject({ ...id, ...creditMcpUpdateFields }),
  }, ({ creditNoteId, ...params }) => wrapTool(ctx, () => updateCreditNote(ctx, creditNoteId, params, "mcp")));
  server.registerTool("delete_credit_note", {
    description: "Delete a draft credit note and its lines atomically; returns success.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, () => deleteCreditNote(ctx, params.creditNoteId)));
  server.registerTool("send_credit_note", {
    description: "Recognize a draft credit note and proportionally restock a linked invoice atomically. Returns creditNote and journalEntryId; monetary values are minor numbers with *Minor strings.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, () => sendCreditNote(ctx, params.creditNoteId)));
  server.registerTool("apply_credit_note", {
    description: "Offset a sent credit note against the same customer's same-currency invoice. amount is integer minor units, amountMinor an exact string. Posts no second AR journal. Returns creditNote and invoice with numeric money and *Minor strings.",
    inputSchema: z.strictObject({ ...id, ...creditApplyFields }),
  }, ({ creditNoteId, ...params }) => wrapTool(ctx, () => applyCredit(ctx, creditNoteId, params)));
  server.registerTool("void_credit_note", {
    description: "Void a credit note atomically, reverse saved recognition, reissue returned inventory, and unwind carrier allocations/invoice balances. Returns creditNote with numeric minor amounts and *Minor strings.",
    inputSchema: z.strictObject(id),
  }, params => wrapTool(ctx, () => voidCreditNote(ctx, params.creditNoteId)));
  server.registerTool("get_credit_note_summary", {
    description: "Summarize notes in a single currency. Returns totals and statusBreakdown with numeric minor amounts and exact *Minor strings; mixed currencies or unsafe sums reject.",
    inputSchema: z.strictObject({}),
  }, () => wrapTool(ctx, () => creditNoteSummary(ctx)));
}
