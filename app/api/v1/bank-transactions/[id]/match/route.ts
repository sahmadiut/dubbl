import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  bankTransaction,
  bankAccount,
  bill,
  invoice,
  payment,
  paymentAllocation,
  journalEntry,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { notDeleted } from "@/lib/db/soft-delete";
import { getBankMatchSuggestions } from "@/lib/api/bank-match-reads";
import { jsonResponse } from "@/lib/api/json-response";
import { createPaymentJournalEntry } from "@/lib/api/journal-automation";
import { getNextNumber } from "@/lib/api/numbering";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await getAuthContext(request); return jsonResponse(await getBankMatchSuggestions(ctx, (await params).id)); }
  catch (err) { return handleError(err); }
}

// POST: Reconcile a bank transaction to an existing or open record.
//
//   matchType "invoice" / "bill" (or legacy: pass invoiceId/billId)
//       Records a NEW payment + allocation + journal entry, updates the
//       document, and marks the transaction reconciled.
//   matchType "existing_payment"
//       Links to an ALREADY-RECORDED payment on this bank (no new JE): sets
//       payment.bankTransactionId, copies the payment's journalEntryId onto the
//       transaction, marks it reconciled.
//   matchType "existing_journal"
//       Links to an ALREADY-POSTED journal entry hitting this bank's GL (no new
//       JE): sets the transaction's journalEntryId, marks it reconciled.
const matchSchema = z
  .object({
    matchType: z
      .enum(["invoice", "bill", "existing_payment", "existing_journal"])
      .optional(),
    billId: z.string().min(1).optional(),
    invoiceId: z.string().min(1).optional(),
    paymentId: z.string().min(1).optional(),
    journalEntryId: z.string().min(1).optional(),
    amount: z.number().int().min(1).optional(), // cents — required for invoice/bill
    date: z.string().min(1).optional(),
    method: z
      .enum(["bank_transfer", "cash", "check", "card", "other"])
      .default("bank_transfer"),
  })
  .refine(
    (d) =>
      d.matchType ||
      d.billId ||
      d.invoiceId ||
      d.paymentId ||
      d.journalEntryId,
    { message: "A matchType or one of billId/invoiceId/paymentId/journalEntryId is required" }
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:banking");

    const body = await request.json();
    const parsed = matchSchema.parse(body);

    // Verify transaction
    const transaction = await db.query.bankTransaction.findFirst({
      where: eq(bankTransaction.id, id),
    });
    if (!transaction) return notFound("Bank transaction");

    const account = await db.query.bankAccount.findFirst({
      where: and(
        eq(bankAccount.id, transaction.bankAccountId),
        eq(bankAccount.organizationId, ctx.organizationId),
        notDeleted(bankAccount.deletedAt)
      ),
    });
    if (!account) return notFound("Bank transaction");

    if (transaction.status === "reconciled") {
      return NextResponse.json({ error: "Transaction already reconciled" }, { status: 400 });
    }

    // Resolve the effective match type (matchType wins; else infer from ids).
    const matchType =
      parsed.matchType ??
      (parsed.invoiceId
        ? "invoice"
        : parsed.billId
          ? "bill"
          : parsed.paymentId
            ? "existing_payment"
            : parsed.journalEntryId
              ? "existing_journal"
              : undefined);

    // ----------------------------------------------------------------------
    // Link to an EXISTING payment — it already carries its own journal entry,
    // so we just attach it to this bank line and reconcile (no new posting).
    // ----------------------------------------------------------------------
    if (matchType === "existing_payment") {
      if (!parsed.paymentId) {
        return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
      }
      const found = await db.query.payment.findFirst({
        where: and(
          eq(payment.id, parsed.paymentId),
          eq(payment.organizationId, ctx.organizationId),
          isNull(payment.deletedAt)
        ),
      });
      if (!found) return notFound("Payment");
      if (found.bankTransactionId && found.bankTransactionId !== id) {
        return NextResponse.json(
          { error: "Payment is already linked to another bank transaction" },
          { status: 400 }
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({ bankTransactionId: id, bankAccountId: account.id, updatedAt: new Date() })
          .where(eq(payment.id, found.id));

        await tx
          .update(bankTransaction)
          .set({
            status: "reconciled",
            journalEntryId: found.journalEntryId || null,
            contactId: found.contactId || transaction.contactId || null,
          })
          .where(eq(bankTransaction.id, id));
      });

      await db.insert(auditLog).values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "matched_existing_payment",
        entityType: "bank_transaction",
        entityId: id,
        changes: { paymentId: found.id, journalEntryId: found.journalEntryId || null },
      });

      return NextResponse.json({
        matchType: "existing_payment",
        paymentId: found.id,
        journalEntryId: found.journalEntryId || null,
      });
    }

    // ----------------------------------------------------------------------
    // Link to an EXISTING posted journal entry — already posted, so just point
    // the bank line at it and reconcile (no new posting).
    // ----------------------------------------------------------------------
    if (matchType === "existing_journal") {
      if (!parsed.journalEntryId) {
        return NextResponse.json({ error: "journalEntryId is required" }, { status: 400 });
      }
      const found = await db.query.journalEntry.findFirst({
        where: and(
          eq(journalEntry.id, parsed.journalEntryId),
          eq(journalEntry.organizationId, ctx.organizationId),
          isNull(journalEntry.deletedAt)
        ),
      });
      if (!found) return notFound("Journal entry");
      if (found.status !== "posted") {
        return NextResponse.json(
          { error: "Only posted journal entries can be matched" },
          { status: 400 }
        );
      }

      // Don't allow linking a journal that's already reconciled to another line.
      const already = await db.query.bankTransaction.findFirst({
        where: and(
          eq(bankTransaction.journalEntryId, found.id),
          ne(bankTransaction.id, id)
        ),
      });
      if (already) {
        return NextResponse.json(
          { error: "Journal entry is already matched to another bank transaction" },
          { status: 400 }
        );
      }

      await db
        .update(bankTransaction)
        .set({ status: "reconciled", journalEntryId: found.id })
        .where(eq(bankTransaction.id, id));

      await db.insert(auditLog).values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "matched_existing_journal",
        entityType: "bank_transaction",
        entityId: id,
        changes: { journalEntryId: found.id },
      });

      return NextResponse.json({
        matchType: "existing_journal",
        journalEntryId: found.id,
      });
    }

    // ----------------------------------------------------------------------
    // Record a NEW payment against an open invoice or bill (existing behavior).
    // ----------------------------------------------------------------------
    const isInvoiceMatch = matchType === "invoice";
    const documentId = (isInvoiceMatch ? parsed.invoiceId : parsed.billId)!;
    if (!documentId) {
      return NextResponse.json(
        { error: isInvoiceMatch ? "invoiceId is required" : "billId is required" },
        { status: 400 }
      );
    }
    if (!parsed.amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    const paymentDate = parsed.date || transaction.date;
    // The bank line's amount is in the bank account's currency. Recording a
    // payment here books that raw amount in the DOCUMENT's currency, so a
    // currency mismatch (e.g. a USD line against a EUR invoice) would mark the
    // document paid by the wrong figure and post incorrect GL. Require a match.
    const bankCurrency = transaction.currencyCode || account.currencyCode;

    if (isInvoiceMatch) {
      // Match to invoice (incoming payment)
      const found = await db.query.invoice.findFirst({
        where: and(
          eq(invoice.id, documentId),
          eq(invoice.organizationId, ctx.organizationId),
          notDeleted(invoice.deletedAt)
        ),
      });
      if (!found) return notFound("Invoice");
      if (found.status === "draft" || found.status === "void") {
        return NextResponse.json({ error: "Cannot record payment for this invoice status" }, { status: 400 });
      }
      if (found.currencyCode !== bankCurrency) {
        return NextResponse.json(
          { error: `This invoice is in ${found.currencyCode} but the bank account is in ${bankCurrency}. Match it to a document in the same currency.` },
          { status: 400 }
        );
      }

      const paymentNumber = await getNextNumber(ctx.organizationId, "payment", "payment_number", "PAY");

      const newAmountPaid = found.amountPaid + parsed.amount;
      const newAmountDue = found.total - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? "paid" : "partial";

      const { created } = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(payment)
          .values({
            organizationId: ctx.organizationId,
            contactId: found.contactId,
            paymentNumber,
            type: "received",
            date: paymentDate,
            amount: parsed.amount!,
            currencyCode: found.currencyCode,
            method: parsed.method,
            bankAccountId: account.id,
            bankTransactionId: id,
            createdBy: ctx.userId,
          })
          .returning();

        await tx.insert(paymentAllocation).values({
          paymentId: created.id,
          documentType: "invoice",
          documentId,
          amount: parsed.amount!,
        });

        const je = await createPaymentJournalEntry(
          { organizationId: ctx.organizationId, userId: ctx.userId },
          {
            type: "invoice",
            reference: paymentNumber,
            amount: parsed.amount!,
            date: paymentDate,
            allocations: [
              {
                amount: parsed.amount!,
                currencyCode: found.currencyCode,
                issueDate: found.issueDate,
              },
            ],
          },
          tx
        );
        if (je) {
          await tx.update(payment).set({ journalEntryId: je.id }).where(eq(payment.id, created.id));
        }

        await tx
          .update(invoice)
          .set({
            amountPaid: newAmountPaid,
            amountDue: Math.max(0, newAmountDue),
            status: newStatus,
            paidAt: newStatus === "paid" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(invoice.id, documentId));

        await tx
          .update(bankTransaction)
          .set({ status: "reconciled", journalEntryId: je?.id || null })
          .where(eq(bankTransaction.id, id));

        return { created };
      });

      await db.insert(auditLog).values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "matched_invoice",
        entityType: "bank_transaction",
        entityId: id,
        changes: { invoiceId: documentId, paymentId: created.id, amount: parsed.amount },
      });

      return NextResponse.json({
        payment: { id: created.id, paymentNumber },
        invoiceStatus: newStatus,
      });
    }

    // Match to bill (outgoing payment)
    const found = await db.query.bill.findFirst({
      where: and(
        eq(bill.id, documentId),
        eq(bill.organizationId, ctx.organizationId),
        notDeleted(bill.deletedAt)
      ),
    });
    if (!found) return notFound("Bill");
    if (found.status === "draft" || found.status === "void") {
      return NextResponse.json({ error: "Cannot record payment for this bill status" }, { status: 400 });
    }
    if (found.currencyCode !== bankCurrency) {
      return NextResponse.json(
        { error: `This bill is in ${found.currencyCode} but the bank account is in ${bankCurrency}. Match it to a document in the same currency.` },
        { status: 400 }
      );
    }

    const paymentNumber = await getNextNumber(ctx.organizationId, "payment", "payment_number", "PAY");

    // Settle against the outstanding balance (amountDue), not total - paid, so
    // reverse-charge bills (payable < total) can still reach "paid".
    const newAmountPaid = found.amountPaid + parsed.amount;
    const newAmountDue = found.amountDue - parsed.amount;
    const newStatus = newAmountDue <= 0 ? "paid" : "partial";

    const { created } = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(payment)
        .values({
          organizationId: ctx.organizationId,
          contactId: found.contactId,
          paymentNumber,
          type: "made",
          date: paymentDate,
          amount: parsed.amount!,
          currencyCode: found.currencyCode,
          method: parsed.method,
          bankAccountId: account.id,
          bankTransactionId: id,
          createdBy: ctx.userId,
        })
        .returning();

      await tx.insert(paymentAllocation).values({
        paymentId: created.id,
        documentType: "bill",
        documentId,
        amount: parsed.amount!,
      });

      const journalEntryRow = await createPaymentJournalEntry(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        {
          type: "bill",
          reference: paymentNumber,
          amount: parsed.amount!,
          date: paymentDate,
          allocations: [
            {
              amount: parsed.amount!,
              currencyCode: found.currencyCode,
              issueDate: found.issueDate,
            },
          ],
        },
        tx
      );
      if (journalEntryRow) {
        await tx.update(payment).set({ journalEntryId: journalEntryRow.id }).where(eq(payment.id, created.id));
      }

      await tx
        .update(bill)
        .set({
          amountPaid: newAmountPaid,
          amountDue: Math.max(0, newAmountDue),
          status: newStatus,
          paidAt: newStatus === "paid" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(bill.id, documentId));

      await tx
        .update(bankTransaction)
        .set({ status: "reconciled", journalEntryId: journalEntryRow?.id || null })
        .where(eq(bankTransaction.id, id));

      return { created };
    });

    await db.insert(auditLog).values({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "matched_bill",
      entityType: "bank_transaction",
      entityId: id,
      changes: { billId: documentId, paymentId: created.id, amount: parsed.amount },
    });

    return NextResponse.json({
      payment: { id: created.id, paymentNumber },
      billStatus: newStatus,
    });
  } catch (err) {
    return handleError(err);
  }
}
