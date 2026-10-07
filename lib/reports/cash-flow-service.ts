import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { buildCashFlowExact, type CashFlowStatement } from "./cash-flow";
import { cashFlowDual, cashFlowParameters } from "./cash-flow-wire";
import { cashFlowExportStatement } from "./cash-flow-export";

export type CashFlowData = ReturnType<typeof cashFlowDual<CashFlowStatement>>;

/** REST and MCP share one read-only repeatable-read snapshot and final projection. */
export async function getCashFlow(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = cashFlowParameters(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const currencyCode = org.defaultCurrency ?? "USD";
    try { if (currencyMetadata(currencyCode).code !== currencyCode) throw new Error(); }
    catch { throw new WireCompatibilityError("Unsupported organization report currency"); }
    const cf = await buildCashFlowExact(ctx.organizationId, params, { ...params, database: tx });
    const op = cf.operatingActivities;
    const line = (accountName: string, amount: bigint, accountCode = "") => ({ accountName, accountCode, amount });
    // Calculate flat derived amounts before projecting; subtracting two safe Numbers can overflow.
    const operating = cf.method === "direct" ? [
      line("Cash receipts from customers", op.netIncome), line("Cash paid for operating expenses", op.total - op.netIncome),
    ] : [line("Net income", op.netIncome), ...(op.depreciation !== 0n ? [line("Depreciation", op.depreciation)] : []),
      line("Change in accounts receivable", op.workingCapitalChanges.accountsReceivable),
      line("Change in accounts payable", op.workingCapitalChanges.accountsPayable),
      line("Change in inventory", op.workingCapitalChanges.inventory)];
    const investing = cf.investingActivities.items.map(i => line(i.name, i.amount, i.code));
    const financing = cf.financingActivities.items.map(i => line(i.name, i.amount, i.code));
    const data = { ...cashFlowDual({ ...cf, operating, investing, financing,
      totalOperating: op.total, totalInvesting: cf.investingActivities.total,
      totalFinancing: cf.financingActivities.total, netCashFlow: cf.netCashChange }), currencyCode };
    return { data, statement: () => cashFlowExportStatement(data, data.operating, data.investing, data.financing, currencyCode) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
