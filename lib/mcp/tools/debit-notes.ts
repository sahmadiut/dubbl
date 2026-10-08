import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { debitNoteListFields, debitNoteMcpCreateFields, debitNoteMcpUpdateFields, debitNoteApplyFields } from "@/lib/api/debit-note-wire";
import { listDebitNotes, getDebitNote, createDebitNote, updateDebitNote, deleteDebitNote, sendDebitNote, applyDebitNote, voidDebitNote } from "@/lib/api/debit-notes";
export function registerDebitNoteTools(server: McpServer, ctx: AuthContext) {
  const id = { debitNoteId: z.string().uuid().describe("Organization-owned supplier debit-note UUID") };
  server.registerTool("list_debit_notes", {
    description: "List supplier debit notes; returns debitNotes, total, page and limit. Numeric money is currency minor units (USD cents), with exact *Minor strings.", inputSchema: z.strictObject(debitNoteListFields) },
    params => wrapTool(ctx, async () => { const result = await listDebitNotes(ctx, params); return { debitNotes: result.rows, total: result.total, page: params.page, limit: params.limit }; }));
  server.tool("get_debit_note", "Get a supplier debit note with contact, lines and journal. Money is numeric minor units with *Minor strings; quantities are stored hundredths.", id,
    params => wrapTool(ctx, () => getDebitNote(ctx, params.debitNoteId)));
  server.registerTool("create_debit_note", {
    description: "Create a draft supplier debit note. Numeric unitPrice is integer minor units (USD cents); unitPriceMinor is an integer string, unitPriceExact decimal major units. Quantity is decimal and discountPercent basis points. Returns debitNote with numeric money and *Minor strings.", inputSchema: z.strictObject(debitNoteMcpCreateFields) },
    params => wrapTool(ctx, () => createDebitNote(ctx, params, "mcp")));
  server.registerTool("update_debit_note", {
    description: "Edit a draft supplier debit note, optionally replacing all lines. Numeric prices are minor units; aliases must agree. Returns debitNote with numeric money and *Minor strings.", inputSchema: z.strictObject({ ...id, ...debitNoteMcpUpdateFields }) },
    ({ debitNoteId, ...params }) => wrapTool(ctx, () => updateDebitNote(ctx, debitNoteId, params, "mcp")));
  server.tool("delete_debit_note", "Soft-delete a draft supplier debit note, retaining its lines; returns success.", id,
    params => wrapTool(ctx, () => deleteDebitNote(ctx, params.debitNoteId)));
  server.tool("send_debit_note", "Recognize a draft supplier debit note atomically using exact saved FX. Linked service receipts support ordinary allowances; stock supports complete matching non-GRNI returns only. Returns debitNote with numeric minor money and *Minor strings; no email is sent.", id,
    params => wrapTool(ctx, () => sendDebitNote(ctx, params.debitNoteId)));
  server.registerTool("apply_debit_note", {
    description: "Apply sent credit to a recognized same-supplier, same-currency bill with matching saved carrying FX. amount is positive integer minor units, amountMinor an exact string. Returns debitNote and bill; allocations are atomic and no second AP journal is posted.", inputSchema: z.strictObject({ ...id, ...debitNoteApplyFields }) },
    ({ debitNoteId, ...params }) => wrapTool(ctx, () => applyDebitNote(ctx, debitNoteId, params)));
  server.tool("void_debit_note", "Void a supplier debit note atomically, reverse saved journal amounts/FX, restore returned stock and unwind paired carrier allocations/bill balances. Returns debitNote with numeric minor money and *Minor strings. Unqualified legacy history is rejected.", id,
    params => wrapTool(ctx, () => voidDebitNote(ctx, params.debitNoteId)));
}
