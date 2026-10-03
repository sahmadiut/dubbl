import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  salesReceipt,
  salesReceiptLine,
  bankAccount,
  chartAccount,
  journalEntry,
  journalLine,
} from "@/lib/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { getNextNumber } from "@/lib/api/numbering";
import { decimalToMinorUnits } from "@/lib/money";
import { assertNotLocked } from "@/lib/api/period-lock";
import { preloadTaxRates, calcTax } from "@/lib/api/tax-calculator";
import { checkMultiCurrency } from "@/lib/api/check-limit";
import { resolveDocumentCurrency } from "@/lib/currency/resolve-currency";
import { wrapTool } from "@/lib/mcp/errors";
import {
  getNextEntryNumber,
  resolveBaseRate,
  toBaseLines,
  assertBaseRateAvailable,
  ensureControlAccount,
  createCogsJournalEntry,
} from "@/lib/api/journal-automation";
import { ensureBankLedgerAccount } from "@/lib/api/bank-ledger";
import type { AuthContext } from "@/lib/api/auth-context";

/**
 * MCP tools for cash sales (sales receipts).
 * Customer credits are registered separately in customer-credits.ts.
 *
 * All monetary amounts in RESULTS are integer cents. Tool INPUTS take unit
 * prices and quantities as decimal numbers (e.g. 12.50, 1.5); credit amounts
 * are integer cents. Direct DB access via Drizzle (no HTTP self-calls).
 */
export function registerSalesReceiptTools(server: McpServer, ctx: AuthContext) {
  // ---------------------------------------------------------------- Sales receipts

  server.tool(
    "list_sales_receipts",
    "List cash-sale sales receipts with optional filters. A sales receipt settles immediately to a bank/deposit account and never touches Accounts Receivable. Amounts (subtotal, taxTotal, total) are in integer cents.",
    {
      status: z
        .enum(["draft", "paid", "void"])
        .optional()
        .describe("Filter by sales-receipt status"),
      contactId: z.string().optional().describe("Filter by customer contact UUID"),
      startDate: z.string().optional().describe("Filter by date from (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Filter by date to (YYYY-MM-DD)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe("Number of receipts to return (max 100)"),
      page: z.number().int().min(1).optional().default(1).describe("Page number"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const conditions = [
          eq(salesReceipt.organizationId, ctx.organizationId),
          notDeleted(salesReceipt.deletedAt),
        ];
        if (params.status) conditions.push(eq(salesReceipt.status, params.status));
        if (params.contactId) conditions.push(eq(salesReceipt.contactId, params.contactId));
        if (params.startDate) conditions.push(gte(salesReceipt.date, params.startDate));
        if (params.endDate) conditions.push(lte(salesReceipt.date, params.endDate));

        const offset = (params.page - 1) * params.limit;
        const receipts = await db.query.salesReceipt.findMany({
          where: and(...conditions),
          orderBy: desc(salesReceipt.createdAt),
          limit: params.limit,
          offset,
          with: { contact: true },
        });
        const [countResult] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(salesReceipt)
          .where(and(...conditions));

        return { salesReceipts: receipts, total: Number(countResult?.count || 0) };
      })
  );

  server.tool(
    "get_sales_receipt",
    "Get a single sales receipt by ID with line items, contact, bank/deposit account, and journal entry. All amounts are in integer cents.",
    {
      salesReceiptId: z.string().describe("The UUID of the sales receipt"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const found = await db.query.salesReceipt.findFirst({
          where: and(
            eq(salesReceipt.id, params.salesReceiptId),
            eq(salesReceipt.organizationId, ctx.organizationId),
            notDeleted(salesReceipt.deletedAt)
          ),
          with: {
            contact: true,
            lines: { with: { account: true, taxRate: true } },
            bankAccount: true,
            depositAccount: true,
            journalEntry: true,
          },
        });
        if (!found) throw new Error("Sales receipt not found");
        return { salesReceipt: found };
      })
  );

  server.tool(
    "create_sales_receipt",
    "Create a draft cash-sale sales receipt with line items. Unit prices and quantities are decimal numbers (e.g. 12.50, 1.5). discountPercent is basis points (1000 = 10%). Lines are tax-EXCLUSIVE — tax is added on top. The system calculates totals and assigns a receipt number. Use post_sales_receipt to post it to the ledger. Provide bankAccountId or depositAccountId for where the cash lands (can also be set at post time).",
    {
      contactId: z.string().describe("Customer contact UUID"),
      date: z.string().describe("Sale date (YYYY-MM-DD)"),
      reference: z.string().optional().describe("External reference"),
      notes: z.string().optional().describe("Notes"),
      currencyCode: z
        .string()
        .optional()
        .describe("Currency code; defaults to contact/org currency"),
      bankAccountId: z
        .string()
        .optional()
        .describe("Bank account UUID the cash lands in (preferred)"),
      depositAccountId: z
        .string()
        .optional()
        .describe("Deposit chart-account UUID, if not using a bank account"),
      lines: z
        .array(
          z.object({
            description: z.string().describe("Line item description"),
            quantity: z.number().optional().default(1).describe("Quantity (decimal)"),
            unitPrice: z
              .number()
              .optional()
              .default(0)
              .describe("Unit price (decimal, e.g. 12.50)"),
            accountId: z.string().optional().describe("Revenue account UUID"),
            taxRateId: z.string().optional().describe("Tax rate UUID"),
            discountPercent: z
              .number()
              .int()
              .min(0)
              .max(10000)
              .optional()
              .default(0)
              .describe("Discount in basis points (1000 = 10%)"),
            costCenterId: z.string().optional().describe("Cost center UUID"),
            projectId: z.string().optional().describe("Project UUID (job costing)"),
            inventoryItemId: z
              .string()
              .optional()
              .describe("Inventory item UUID; relieves stock and posts COGS when posted"),
            warehouseId: z
              .string()
              .optional()
              .describe("Warehouse UUID to issue stock from"),
          })
        )
        .min(1)
        .describe("Sales-receipt line items"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:invoices");
        await assertNotLocked(ctx.organizationId, params.date);

        const currencyCode = await resolveDocumentCurrency(
          ctx.organizationId,
          params.currencyCode,
          params.contactId
        );
        await checkMultiCurrency(ctx.organizationId, currencyCode);

        const receiptNumber = await getNextNumber(
          ctx.organizationId,
          "sales_receipt",
          "receipt_number",
          "SR"
        );

        const taxRateIds = params.lines.map((l) => l.taxRateId).filter(Boolean) as string[];
        const ratesMap = await preloadTaxRates(taxRateIds);

        let subtotal = 0;
        const processedLines = params.lines.map((l, i) => {
          const grossAmount = decimalToMinorUnits(l.quantity * l.unitPrice, currencyCode);
          const discountAmount = l.discountPercent
            ? Math.round((grossAmount * l.discountPercent) / 10000)
            : 0;
          const amount = grossAmount - discountAmount;
          subtotal += amount;
          const taxRateId = l.taxRateId ?? null;
          const taxAmount = taxRateId ? calcTax(amount, ratesMap.get(taxRateId) ?? 0) : 0;
          return {
            description: l.description,
            quantity: Math.round(l.quantity * 100),
            unitPrice: decimalToMinorUnits(l.unitPrice, currencyCode),
            accountId: l.accountId ?? null,
            taxRateId,
            discountPercent: l.discountPercent,
            taxAmount,
            amount,
            costCenterId: l.costCenterId ?? null,
            projectId: l.projectId ?? null,
            inventoryItemId: l.inventoryItemId ?? null,
            warehouseId: l.warehouseId ?? null,
            sortOrder: i,
          };
        });

        const taxTotal = processedLines.reduce((s, l) => s + l.taxAmount, 0);
        const total = subtotal + taxTotal;

        const [created] = await db
          .insert(salesReceipt)
          .values({
            organizationId: ctx.organizationId,
            contactId: params.contactId,
            receiptNumber,
            date: params.date,
            reference: params.reference ?? null,
            notes: params.notes ?? null,
            subtotal,
            taxTotal,
            total,
            currencyCode,
            bankAccountId: params.bankAccountId ?? null,
            depositAccountId: params.depositAccountId ?? null,
            createdBy: ctx.userId,
          })
          .returning();

        await db.insert(salesReceiptLine).values(
          processedLines.map((l) => ({ salesReceiptId: created.id, ...l }))
        );

        return { salesReceipt: created };
      })
  );

  server.tool(
    "post_sales_receipt",
    "Post a draft sales receipt to the ledger. Posts DR cash (the bank account's linked ledger account, the chosen deposit account, or Undeposited Funds 1250) / CR revenue per line / CR Output VAT 2200 — skipping Accounts Receivable — plus COGS for any stock lines. Sets status to 'paid'. Foreign-currency receipts require an exchange rate.",
    {
      salesReceiptId: z.string().describe("The UUID of the sales receipt to post"),
      bankAccountId: z
        .string()
        .optional()
        .describe("Override/set the bank account the cash lands in"),
      depositAccountId: z
        .string()
        .optional()
        .describe("Override/set the deposit chart account, if not using a bank account"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "approve:invoices");

        const found = await db.query.salesReceipt.findFirst({
          where: and(
            eq(salesReceipt.id, params.salesReceiptId),
            eq(salesReceipt.organizationId, ctx.organizationId),
            notDeleted(salesReceipt.deletedAt)
          ),
          with: { lines: true },
        });
        if (!found) throw new Error("Sales receipt not found");
        if (found.status !== "draft") throw new Error("Only draft sales receipts can be posted");

        await assertNotLocked(ctx.organizationId, found.date);

        const bankAccountId = params.bankAccountId ?? found.bankAccountId;
        const depositAccountId = params.depositAccountId ?? found.depositAccountId;

        let cashAccountId: string | null = null;
        if (bankAccountId) {
          const acct = await db.query.bankAccount.findFirst({
            where: and(
              eq(bankAccount.id, bankAccountId),
              eq(bankAccount.organizationId, ctx.organizationId),
              notDeleted(bankAccount.deletedAt)
            ),
            columns: {
              id: true,
              accountName: true,
              accountType: true,
              currencyCode: true,
              chartAccountId: true,
            },
          });
          if (!acct) throw new Error("Bank account not found");
          // Connect the bank account to its ledger account automatically (older
          // accounts self-heal on first use) so posting never dead-ends.
          cashAccountId = await ensureBankLedgerAccount(ctx.organizationId, acct);
        } else if (depositAccountId) {
          const acct = await db.query.chartAccount.findFirst({
            where: and(
              eq(chartAccount.id, depositAccountId),
              eq(chartAccount.organizationId, ctx.organizationId)
            ),
            columns: { id: true },
          });
          if (!acct) throw new Error("Deposit account not found");
          cashAccountId = acct.id;
        }

        await assertBaseRateAvailable(ctx.organizationId, found.currencyCode, found.date);
        const { currency, rate, base } = await resolveBaseRate(
          ctx.organizationId,
          found.currencyCode,
          found.date
        );

        const updated = await db.transaction(async (tx) => {
          if (!cashAccountId) {
            const undeposited = await ensureControlAccount(
              ctx.organizationId,
              "undepositedFunds",
              base,
              tx
            );
            if (!undeposited) throw new Error("Could not resolve a cash account");
            cashAccountId = undeposited.id;
          }

          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: found.date,
              description: `Sales receipt ${found.receiptNumber}`,
              reference: found.receiptNumber,
              status: "posted",
              sourceType: "sales_receipt",
              sourceId: found.id,
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          const lines: (typeof journalLine.$inferInsert)[] = [];
          for (const line of found.lines) {
            if (line.accountId && line.amount > 0) {
              lines.push({
                journalEntryId: entry.id,
                accountId: line.accountId,
                description: `Sales receipt ${found.receiptNumber}`,
                debitAmount: 0,
                creditAmount: line.amount,
              });
            }
          }
          if (found.taxTotal > 0) {
            const outputVat = await ensureControlAccount(
              ctx.organizationId,
              "outputVat",
              base,
              tx
            );
            if (outputVat) {
              lines.push({
                journalEntryId: entry.id,
                accountId: outputVat.id,
                description: `Tax on ${found.receiptNumber}`,
                debitAmount: 0,
                creditAmount: found.taxTotal,
              });
            }
          }
          const cashTotal = lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
          if (cashTotal > 0) {
            lines.unshift({
              journalEntryId: entry.id,
              accountId: cashAccountId!,
              description: `Sales receipt ${found.receiptNumber}`,
              debitAmount: cashTotal,
              creditAmount: 0,
            });
            await tx.insert(journalLine).values(toBaseLines(lines, currency, rate));
          }

          const stockLines = found.lines.filter((l) => l.inventoryItemId);
          if (stockLines.length > 0) {
            await createCogsJournalEntry(
              { organizationId: ctx.organizationId, userId: ctx.userId },
              {
                reference: found.receiptNumber,
                date: found.date,
                currencyCode: found.currencyCode,
                lines: stockLines.map((l) => ({
                  inventoryItemId: l.inventoryItemId as string,
                  quantity: l.quantity,
                  warehouseId: l.warehouseId,
                })),
              },
              tx
            );
          }

          const [row] = await tx
            .update(salesReceipt)
            .set({
              status: "paid",
              journalEntryId: entry.id,
              bankAccountId: bankAccountId ?? found.bankAccountId,
              depositAccountId: depositAccountId ?? found.depositAccountId,
              updatedAt: new Date(),
            })
            .where(eq(salesReceipt.id, found.id))
            .returning();
          return row;
        });

        return { salesReceipt: updated };
      })
  );

  server.tool(
    "void_sales_receipt",
    "Void a sales receipt. If it was posted, reverses its ledger entry (swapping debit/credit) and restocks any inventory it relieved; if still a draft, just marks it void.",
    {
      salesReceiptId: z.string().describe("The UUID of the sales receipt to void"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "approve:invoices");

        const found = await db.query.salesReceipt.findFirst({
          where: and(
            eq(salesReceipt.id, params.salesReceiptId),
            eq(salesReceipt.organizationId, ctx.organizationId),
            notDeleted(salesReceipt.deletedAt)
          ),
          with: { lines: true },
        });
        if (!found) throw new Error("Sales receipt not found");
        if (found.status === "void") throw new Error("Already voided");

        await assertNotLocked(ctx.organizationId, found.date);

        const updated = await db.transaction(async (tx) => {
          if (found.journalEntryId) {
            const original = await tx.query.journalEntry.findFirst({
              where: and(
                eq(journalEntry.id, found.journalEntryId),
                eq(journalEntry.organizationId, ctx.organizationId)
              ),
              with: { lines: true },
            });
            if (original && !original.reversedByEntryId) {
              const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
              const [reversal] = await tx
                .insert(journalEntry)
                .values({
                  organizationId: ctx.organizationId,
                  entryNumber,
                  date: found.date,
                  description: `Void sales receipt ${found.receiptNumber}`,
                  reference: found.receiptNumber,
                  status: "posted",
                  sourceType: "sales_receipt_void",
                  sourceId: found.id,
                  reversesEntryId: original.id,
                  postedAt: new Date(),
                  createdBy: ctx.userId,
                })
                .returning();
              if (original.lines.length > 0) {
                await tx.insert(journalLine).values(
                  original.lines.map((l) => ({
                    journalEntryId: reversal.id,
                    accountId: l.accountId,
                    description: `Void sales receipt ${found.receiptNumber}`,
                    debitAmount: l.creditAmount,
                    creditAmount: l.debitAmount,
                    currencyCode: l.currencyCode,
                    exchangeRate: l.exchangeRate,
                    costCenterId: l.costCenterId,
                    projectId: l.projectId,
                  }))
                );
              }
              await tx
                .update(journalEntry)
                .set({ reversedByEntryId: reversal.id, updatedAt: new Date() })
                .where(eq(journalEntry.id, original.id));
            }

            const stockLines = found.lines.filter((l) => l.inventoryItemId);
            if (stockLines.length > 0) {
              await createCogsJournalEntry(
                { organizationId: ctx.organizationId, userId: ctx.userId },
                {
                  reference: found.receiptNumber,
                  date: found.date,
                  currencyCode: found.currencyCode,
                  lines: stockLines.map((l) => ({
                    inventoryItemId: l.inventoryItemId as string,
                    quantity: l.quantity,
                    warehouseId: l.warehouseId,
                  })),
                },
                tx,
                { reverse: true }
              );
            }
          }

          const [row] = await tx
            .update(salesReceipt)
            .set({ status: "void", voidedAt: new Date(), updatedAt: new Date() })
            .where(eq(salesReceipt.id, found.id))
            .returning();
          return row;
        });

        return { salesReceipt: updated };
      })
  );
}
