import { createSettlementPayment } from "@/lib/api/payment-settlements";
import { paymentCreateFields } from "@/lib/api/payment-settlement-wire";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { payment, paymentAllocation, invoice, bill } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { getNextNumber } from "@/lib/api/numbering";
import { assertNotLocked } from "@/lib/api/period-lock";
import {
  createPaymentJournalEntry,
  reverseJournalEntry,
} from "@/lib/api/journal-automation";
import { decimalToCents } from "@/lib/money";
import { wrapTool } from "@/lib/mcp/errors";
import { listPayments, getPayment } from "@/lib/api/payment-reads";
import { paymentListFields } from "@/lib/api/payment-read-wire";
import { AuthError } from "@/lib/api/auth-context";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for standalone payment records — a single cash
 * movement (money received from a customer or paid to a supplier) that settles
 * one or more invoices (type "received", AR) or bills (type "made", AP) via
 * allocations. These are the same records as the /api/v1/payments REST routes.
 *
 * pay_invoice / pay_bill use the same settlement service for one document.
 * Bank transfers use record_bank_transfer. Settlement creates the payment,
 * its allocations, the document balance/status updates, AND the GL journal
 * entry (DR Bank / CR AR for received; DR AP / CR Bank for made), all in one
 * atomic transaction, exactly like the REST routes.
 *
 * Settlement money uses integer document-currency minor units (USD cents),
 * with additive amountMinor strings. The legacy exception is record_payment_batch,
 * whose allocation `amount` is a DECIMAL number of currency units (e.g. 12.50),
 * mirroring the batch REST route which converts to cents internally. Direct DB
 * access via Drizzle (no HTTP self-calls); org-scoped via the AuthContext.
 */
export function registerPaymentTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "list_payments",
    "List organization-scoped payments with optional direction/contact filters and pagination. Returns payments, total count, page and limit. Payment/allocation amount is an integer in existing currency minor units (USD cents); amountMinor is the exact string alias. Includes contact creditLimitMinor. Signed safe-integer history and noncash credit/debit-note carriers retain their units. Unsupported ranges or tenant references fail explicitly.",
    paymentListFields,
    params => wrapTool(ctx, async () => listPayments(ctx, params))
  );

  server.tool(
    "get_payment",
    "Get one organization-scoped payment by UUID with contact, bank account and allocations. Returns {payment}; numeric minor-unit money (USD cents) keeps its type and adds amountMinor, creditLimitMinor, balanceMinor and nullable lowBalanceThresholdMinor. Includes noncash paired allocations without summing or converting them. Missing/deleted payments return 404; unsupported ranges or tenant references fail explicitly.",
    { paymentId: z.string().uuid().describe("UUID of the payment in the authenticated organization") },
    params => wrapTool(ctx, async () => {
      const result = await getPayment(ctx, params.paymentId);
      if (!result) throw new AuthError("Payment not found", 404);
      return result;
    })
  );

  server.tool(
    "create_payment",
    "Create one cash payment with fully covering, distinct invoice (received) or bill (made) allocations for one contact/currency. amount is a positive safe integer in document minor units (USD cents); amountMinor is a canonical matching string, also supported on allocations. Checks manage:payments, recognition/carrying FX, bank ownership/currency, period locks and outstanding balances. Atomically posts cash/control/realised FX, updates documents and audits; optional idempotencyKey replays the original result. Returns {payment} with numeric money and amountMinor aliases. Unapplied cash and unqualified historical carrying values fail before commit.",
    paymentCreateFields,
    params => wrapTool(ctx, () => createSettlementPayment(ctx, params))
  );

  server.tool(
    "record_payment_batch",
    "Record ONE standalone payment that settles multiple documents in a batch for a single contact. UNLIKE the other payment tools, each allocation `amount` here is a DECIMAL number of currency units (e.g. 12.50, NOT cents) — it is converted to cents internally, and the payment total is the sum of those allocations. A 'received' batch can only settle invoices (AR); a 'made' batch only bills (AP); all settled documents must share one currency. Atomically: inserts the payment + allocation rows, updates each document's amountPaid/amountDue and status ('paid' or 'partial'), posts the GL journal entry (DR Bank / CR AR for received; DR AP / CR Bank for made), and links it. NOTE: this batch path does NOT enforce a period lock and does NOT cap the total against a separate amount (the total IS the allocations). Returns the created payment with its contact and allocations (amounts in integer cents).",
    {
      contactId: z
        .string()
        .min(1)
        .describe("Customer (for received) or supplier (for made) contact UUID"),
      type: z
        .enum(["received", "made"])
        .describe(
          "'received' = money in from a customer (settles invoices/AR); 'made' = money out to a supplier (settles bills/AP)"
        ),
      date: z.string().min(1).describe("Payment date (YYYY-MM-DD); the journal entry posts on this date"),
      method: z
        .enum(["bank_transfer", "cash", "check", "card", "other"])
        .optional()
        .default("bank_transfer")
        .describe("How the money moved (defaults to bank_transfer)"),
      bankAccountId: z
        .string()
        .optional()
        .describe("UUID of the bank account the cash moved through (optional)"),
      reference: z
        .string()
        .optional()
        .describe("External reference (check number, transfer ref, etc.)"),
      allocations: z
        .array(
          z.object({
            documentId: z
              .string()
              .min(1)
              .describe("UUID of the invoice or bill being settled"),
            documentType: z
              .enum(["invoice", "bill"])
              .describe(
                "Type of document being settled: 'invoice' for received payments, 'bill' for made payments"
              ),
            amount: z
              .number()
              .positive()
              .describe(
                "Amount applied to this document as a DECIMAL number of currency units (e.g. 12.50), NOT cents; converted to cents internally"
              ),
          })
        )
        .min(1)
        .describe("How the batch payment is split across the documents it settles (at least one)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payments");

        // A "received" batch settles invoices (AR); a "made" batch settles
        // bills (AP). Reject inconsistent allocations so the journal posts to
        // the correct control account and realised-FX direction.
        const expectedDocType = params.type === "received" ? "invoice" : "bill";
        if (params.allocations.some((a) => a.documentType !== expectedDocType)) {
          throw new Error(
            `${params.type} payments can only settle ${expectedDocType}s`
          );
        }

        // Calculate total amount from allocations (convert decimal to cents)
        const totalAmount = params.allocations.reduce(
          (sum, a) => sum + decimalToCents(a.amount),
          0
        );

        // Generate payment number
        const paymentNumber = await getNextNumber(
          ctx.organizationId,
          "payment",
          "payment_number",
          "PAY"
        );

        // Load each allocated document up front (read-only), computing the new
        // balance/status and capturing currency + issue date for the journal
        // entry's base-currency conversion and realised FX. Reads + the
        // shared-currency guard stay OUTSIDE the transaction; the actual writes
        // happen inside the single transaction below.
        const journalAllocations: {
          amount: number;
          currencyCode: string;
          issueDate: string;
        }[] = [];
        const documentUpdates: {
          documentType: "invoice" | "bill";
          documentId: string;
          amountPaid: number;
          amountDue: number;
          status: "paid" | "partial";
        }[] = [];
        for (const alloc of params.allocations) {
          const allocCents = decimalToCents(alloc.amount);

          if (alloc.documentType === "invoice") {
            const existing = await db.query.invoice.findFirst({
              where: and(
                eq(invoice.id, alloc.documentId),
                eq(invoice.organizationId, ctx.organizationId)
              ),
            });
            if (existing) {
              const newAmountPaid = existing.amountPaid + allocCents;
              const newAmountDue = existing.amountDue - allocCents;
              const newStatus = newAmountDue <= 0 ? "paid" : "partial";
              documentUpdates.push({
                documentType: "invoice",
                documentId: alloc.documentId,
                amountPaid: newAmountPaid,
                amountDue: Math.max(0, newAmountDue),
                status: newStatus,
              });
              journalAllocations.push({
                amount: allocCents,
                currencyCode: existing.currencyCode,
                issueDate: existing.issueDate,
              });
            }
          } else if (alloc.documentType === "bill") {
            const existing = await db.query.bill.findFirst({
              where: and(
                eq(bill.id, alloc.documentId),
                eq(bill.organizationId, ctx.organizationId)
              ),
            });
            if (existing) {
              const newAmountPaid = existing.amountPaid + allocCents;
              const newAmountDue = existing.amountDue - allocCents;
              const newStatus = newAmountDue <= 0 ? "paid" : "partial";
              documentUpdates.push({
                documentType: "bill",
                documentId: alloc.documentId,
                amountPaid: newAmountPaid,
                amountDue: Math.max(0, newAmountDue),
                status: newStatus,
              });
              journalAllocations.push({
                amount: allocCents,
                currencyCode: existing.currencyCode,
                issueDate: existing.issueDate,
              });
            }
          }
        }

        // All settled documents must share one currency for a single journal
        // entry.
        const batchCurrencies = new Set(
          journalAllocations.map((a) => a.currencyCode)
        );
        if (batchCurrencies.size > 1) {
          throw new Error("All settled documents must share the same currency");
        }

        // Atomic write sequence: the payment row, its allocations, the document
        // balance/status updates, the GL journal entry, and the payment ->
        // journalEntry link must all COMMIT TOGETHER or ROLL BACK TOGETHER. A
        // thrown MissingExchangeRateError (or any error) inside the transaction
        // rolls everything back, so we never leave orphaned payments or
        // documents marked paid without a ledger entry.
        const { created } = await db.transaction(async (tx) => {
          // Create one payment record
          const [created] = await tx
            .insert(payment)
            .values({
              organizationId: ctx.organizationId,
              contactId: params.contactId,
              paymentNumber,
              type: params.type,
              date: params.date,
              amount: totalAmount,
              method: params.method,
              reference: params.reference || null,
              bankAccountId: params.bankAccountId || null,
              createdBy: ctx.userId,
            })
            .returning();

          // Create allocation records
          await tx.insert(paymentAllocation).values(
            params.allocations.map((a) => ({
              paymentId: created.id,
              documentType: a.documentType,
              documentId: a.documentId,
              amount: decimalToCents(a.amount),
            }))
          );

          // Apply each allocated document's new balance + status.
          for (const upd of documentUpdates) {
            if (upd.documentType === "invoice") {
              await tx
                .update(invoice)
                .set({
                  amountPaid: upd.amountPaid,
                  amountDue: upd.amountDue,
                  status: upd.status,
                  updatedAt: new Date(),
                })
                .where(eq(invoice.id, upd.documentId));
            } else {
              await tx
                .update(bill)
                .set({
                  amountPaid: upd.amountPaid,
                  amountDue: upd.amountDue,
                  status: upd.status,
                  updatedAt: new Date(),
                })
                .where(eq(bill.id, upd.documentId));
            }
          }

          if (batchCurrencies.size === 1) {
            await tx
              .update(payment)
              .set({ currencyCode: [...batchCurrencies][0] })
              .where(eq(payment.id, created.id));
          }

          // Create journal entry (posts inside the same transaction)
          const journalEntry = await createPaymentJournalEntry(
            { organizationId: ctx.organizationId, userId: ctx.userId },
            {
              type: params.type === "received" ? "invoice" : "bill",
              reference: paymentNumber,
              amount: totalAmount,
              date: params.date,
              allocations:
                journalAllocations.length > 0 ? journalAllocations : undefined,
            },
            tx
          );

          // Link journal entry to payment
          if (journalEntry) {
            await tx
              .update(payment)
              .set({ journalEntryId: journalEntry.id, updatedAt: new Date() })
              .where(eq(payment.id, created.id));
          }

          return { created };
        });

        // Return payment with allocations
        const result = await db.query.payment.findFirst({
          where: eq(payment.id, created.id),
          with: { contact: true, allocations: true },
        });

        return { payment: result };
      })
  );

  server.tool(
    "delete_payment",
    "Delete (soft-delete) a standalone payment and fully UNWIND it: reverses every allocation on its invoices/bills (restoring amountDue / reducing amountPaid and reverting status), reverses the payment's own GL journal entry (so the bank and AR/AP control accounts come back in line), then soft-deletes the payment — all atomically. A zero-cash carrier payment with no journalEntryId has nothing to reverse on the GL. Fails if the payment's date is in a locked period. Returns success.",
    {
      paymentId: z.string().describe("The UUID of the payment to delete"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payments");

        const existing = await db.query.payment.findFirst({
          where: and(
            eq(payment.id, params.paymentId),
            eq(payment.organizationId, ctx.organizationId),
            notDeleted(payment.deletedAt)
          ),
          with: { allocations: true },
        });

        if (!existing) throw new Error("Payment not found");

        await assertNotLocked(ctx.organizationId, existing.date);

        // Do the doc unwind, the GL reversal, and the soft-delete atomically, so
        // a deleted payment can't leave its bank/AR/AP movement posted (orphaned
        // cash that overstates the bank and never reconciles).
        await db.transaction(async (tx) => {
          // Reverse allocations on documents
          for (const alloc of existing.allocations) {
            if (alloc.documentType === "invoice") {
              const doc = await tx.query.invoice.findFirst({
                where: and(
                  eq(invoice.id, alloc.documentId),
                  eq(invoice.organizationId, ctx.organizationId)
                ),
              });
              if (doc) {
                const newAmountPaid = Math.max(0, doc.amountPaid - alloc.amount);
                const newAmountDue = doc.amountDue + alloc.amount;
                const newStatus =
                  newAmountPaid <= 0
                    ? doc.status === "paid" || doc.status === "partial"
                      ? "sent"
                      : doc.status
                    : "partial";
                await tx
                  .update(invoice)
                  .set({
                    amountPaid: newAmountPaid,
                    amountDue: newAmountDue,
                    status: newStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(invoice.id, alloc.documentId));
              }
            } else if (alloc.documentType === "bill") {
              const doc = await tx.query.bill.findFirst({
                where: and(
                  eq(bill.id, alloc.documentId),
                  eq(bill.organizationId, ctx.organizationId)
                ),
              });
              if (doc) {
                const newAmountPaid = Math.max(0, doc.amountPaid - alloc.amount);
                const newAmountDue = doc.amountDue + alloc.amount;
                const newStatus =
                  newAmountPaid <= 0
                    ? doc.status === "paid" || doc.status === "partial"
                      ? "received"
                      : doc.status
                    : "partial";
                await tx
                  .update(bill)
                  .set({
                    amountPaid: newAmountPaid,
                    amountDue: newAmountDue,
                    status: newStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(bill.id, alloc.documentId));
              }
            }
          }

          // Reverse the payment's own GL entry (DR Bank/CR AR, or DR AP/CR Bank)
          // so the bank and the control accounts come back in line. A zero-cash
          // carrier payment (credit-note application) has no journalEntryId —
          // nothing to reverse there.
          if (existing.journalEntryId) {
            await reverseJournalEntry(
              { organizationId: ctx.organizationId, userId: ctx.userId },
              {
                entryId: existing.journalEntryId,
                date: existing.date,
                description: `Reversal of payment ${existing.paymentNumber}`,
                reference: existing.paymentNumber,
                sourceType: "payment_void",
                sourceId: existing.id,
              },
              tx
            );
          }

          // Soft-delete the payment
          await tx
            .update(payment)
            .set(softDelete())
            .where(eq(payment.id, params.paymentId));
        });

        return { success: true };
      })
  );
}
