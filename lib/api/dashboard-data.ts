import { db } from "@/lib/db";
import { invoice, bill, bankAccount, bankTransaction, bankReconciliation, inventoryItem, reminderRule, organization } from "@/lib/db/schema";
import { eq, and, sql, lt, notInArray, isNull, asc } from "drizzle-orm";
import { z } from "zod";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { reportDateSchema } from "@/lib/reports/statement-wire";
import { dashboardCurrency, dashboardMoney, dashboardQuerySchema, dashboardSelectedCurrency, dashboardStoredMinor, dashboardWidgetType } from "./dashboard-wire";

type DashboardTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function orgCurrency(tx: DashboardTx, ctx: AuthContext) {
  const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
  if (!org) throw new AuthError("Organization not found", 404);
  return org.defaultCurrency ?? "USD";
}

async function documents(tx: DashboardTx, ctx: AuthContext, kind: "accounts_receivable" | "accounts_payable", filter?: string, today?: string) {
  const table = kind === "accounts_receivable" ? invoice : bill;
  const rows = await tx.select({ amountDue: sql<string>`coalesce(${table.amountDue}, 0)::text`, currency: table.currencyCode, status: table.status,
    dueDate: table.dueDate })
    .from(table).where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt),
      filter ? eq(table.currencyCode, filter) : undefined,
      today ? notInArray(table.status, ["draft", "void", "paid"]) : undefined,
      today ? lt(table.dueDate, today) : undefined)).orderBy(asc(table.id));
  if (today && rows.some(row => !reportDateSchema.safeParse(row.dueDate).success)) {
    throw new WireCompatibilityError("Unsupported stored overdue document date");
  }
  return rows;
}

function documentTotal(rows: Awaited<ReturnType<typeof documents>>, filter: string | undefined, fallback: string) {
  const currencyCode = dashboardSelectedCurrency(rows.map(row => row.currency), filter, fallback);
  const total = rows.reduce((sum, row) => sum + dashboardStoredMinor(row.amountDue), 0n);
  return { ...dashboardMoney("total", total), currencyCode, count: rows.length };
}

/** Existing widget selection semantics, using narrow projections in a read-only snapshot. */
export async function getDashboardWidget(ctx: AuthContext, typeInput: unknown, input: unknown = {}) {
  requireRole(ctx, "view:data");
  const type = dashboardWidgetType.parse(typeInput);
  const { currencyCode } = dashboardQuerySchema.parse(input);
  if (currencyCode && (type === "quick_actions" || type === "inventory_alerts")) {
    throw new z.ZodError([{ code: "custom", path: ["currencyCode"], message: "This widget has no currency filter" }]);
  }
  return db.transaction(async tx => {
    const fallback = await orgCurrency(tx, ctx);
    if (type === "accounts_receivable" || type === "accounts_payable") {
      const rows = await documents(tx, ctx, type, currencyCode);
      return { ...documentTotal(rows, currencyCode, fallback), overdueCount: rows.filter(row => row.status === "overdue").length };
    }
    if (type === "bank_balances") {
      const accounts = await tx.select({ id: bankAccount.id, name: bankAccount.accountName,
        balance: sql<string>`${bankAccount.balance}::text`, currencyCode: bankAccount.currencyCode })
        .from(bankAccount).where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt),
          currencyCode ? eq(bankAccount.currencyCode, currencyCode) : undefined)).orderBy(asc(bankAccount.id));
      return { accounts: accounts.map(row => ({ id: row.id, name: row.name, currencyCode: dashboardCurrency(row.currencyCode),
        ...dashboardMoney("balance", dashboardStoredMinor(row.balance)) })) };
    }
    if (type === "inventory_alerts") {
      const items = await tx.select({ id: inventoryItem.id, name: inventoryItem.name, code: inventoryItem.code,
        quantityOnHand: inventoryItem.quantityOnHand, reorderPoint: inventoryItem.reorderPoint })
        .from(inventoryItem).where(and(eq(inventoryItem.organizationId, ctx.organizationId), isNull(inventoryItem.deletedAt),
          eq(inventoryItem.isActive, true), sql`${inventoryItem.quantityOnHand} <= ${inventoryItem.reorderPoint}`)).orderBy(asc(inventoryItem.id));
      return { lowStockCount: items.length, items: items.slice(0, 10) };
    }
    return { actions: ["new_invoice", "new_bill", "new_entry", "new_contact"] };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Currency filters apply to overdue monetary sections; operational counts stay organization-wide. */
export async function getDashboardAlerts(ctx: AuthContext, input: unknown = {}) {
  requireRole(ctx, "view:data");
  const { currencyCode } = dashboardQuerySchema.parse(input);
  const today = new Date().toISOString().slice(0, 10);
  return db.transaction(async tx => {
    const fallback = await orgCurrency(tx, ctx);
    const overdueInvoices = documentTotal(await documents(tx, ctx, "accounts_receivable", currencyCode, today), currencyCode, fallback);
    const overdueBills = documentTotal(await documents(tx, ctx, "accounts_payable", currencyCode, today), currencyCode, fallback);
    const [uncategorized] = await tx.select({ count: sql<string>`count(*)::text` }).from(bankTransaction)
      .innerJoin(bankAccount, eq(bankTransaction.bankAccountId, bankAccount.id))
      .where(and(eq(bankAccount.organizationId, ctx.organizationId), isNull(bankAccount.deletedAt),
        isNull(bankTransaction.accountId), eq(bankTransaction.status, "unreconciled")));
    const accounts = await tx.select({ bankAccountId: bankAccount.id, bankAccountName: bankAccount.accountName,
      lastReconDate: sql<string | null>`max(${bankReconciliation.endDate})::text` })
      .from(bankAccount).leftJoin(bankReconciliation, and(eq(bankReconciliation.bankAccountId, bankAccount.id), eq(bankReconciliation.status, "completed")))
      .where(and(eq(bankAccount.organizationId, ctx.organizationId), eq(bankAccount.isActive, true), isNull(bankAccount.deletedAt)))
      .groupBy(bankAccount.id, bankAccount.accountName).orderBy(asc(bankAccount.id));
    const needsRecon = accounts.filter(row => {
      if (!row.lastReconDate) return true;
      if (!reportDateSchema.safeParse(row.lastReconDate).success) throw new WireCompatibilityError("Unsupported stored reconciliation date");
      return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${row.lastReconDate}T00:00:00Z`)) / 86400000 > 30;
    });
    const [reminders] = await tx.select({ count: sql<string>`count(*)::text` }).from(reminderRule)
      .where(and(eq(reminderRule.organizationId, ctx.organizationId), eq(reminderRule.enabled, true), isNull(reminderRule.deletedAt)));
    return { overdueInvoices, overdueBills,
      uncategorizedTransactions: Number(dashboardStoredMinor(uncategorized.count)),
      accountsNeedingReconciliation: needsRecon,
      activeReminderRules: Number(dashboardStoredMinor(reminders.count)) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
